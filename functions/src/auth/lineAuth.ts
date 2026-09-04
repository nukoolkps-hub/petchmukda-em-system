/**
 * lineAuth — LINE Login → Firebase Custom Token
 */

import { type Auth, getAuth, type UserRecord } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
	getAppFirestore,
	getLineConfig,
	isConfiguredAdminLineUser,
} from "../helpers/config.js";
import { parseLineAuthPayload } from "../helpers/payload.js";

const UNPROVISIONED_LINE_USER_MESSAGE = "บัญชี LINE นี้ยังไม่ได้ถูกเพิ่มโดยผู้ดูแลระบบ";

/** atomically validate + consume OAuth state · single-use (delete in same txn)
 *  · CSRF defense ฝั่ง server (เพิ่มจาก client sessionStorage check) */
async function consumeLoginState(db: Firestore, state: string): Promise<void> {
	const stateRef = db.collection("loginStates").doc(state);
	await db.runTransaction(async (tx) => {
		const snap = await tx.get(stateRef);
		if (!snap.exists) {
			throw new HttpsError(
				"permission-denied",
				"Invalid or already-used state",
			);
		}
		const data = snap.data() as { createdAt?: number; expiresAt?: number };
		const now = Date.now();
		if (typeof data.expiresAt === "number" && now > data.expiresAt) {
			tx.delete(stateRef);
			throw new HttpsError("permission-denied", "Expired state");
		}
		// single-use — ลบทันทีใน txn เดียวกัน · request ที่ replay มาด้วย state
		// เดิมจะเห็น "not exists" และโดน reject
		tx.delete(stateRef);
	});
}

export const lineAuth = onCall(async (request) => {
	const { code, redirectUri, state } = parseLineAuthPayload(request.data);

	// CSRF defense: validate + consume state ก่อนยุ่งกับ LINE API · กัน
	// attacker forge OAuth callback ไปที่ victim browser
	await consumeLoginState(getAppFirestore(), state);

	const config = await getLineConfig();
	if (!config.LINE_LOGIN_CHANNEL_ID || !config.LINE_LOGIN_CHANNEL_SECRET) {
		throw new HttpsError(
			"failed-precondition",
			"LINE Login not configured in /config/secrets",
		);
	}

	// 1. Exchange code → LINE access_token
	const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			client_id: config.LINE_LOGIN_CHANNEL_ID,
			client_secret: config.LINE_LOGIN_CHANNEL_SECRET,
		}),
	});
	const tokenData = (await tokenRes.json()) as { access_token?: string };
	if (!tokenData.access_token) {
		throw new HttpsError("unauthenticated", "Invalid LINE code");
	}

	// 2. Get LINE profile
	const profileRes = await fetch("https://api.line.me/v2/profile", {
		headers: { Authorization: `Bearer ${tokenData.access_token}` },
	});
	const profile = (await profileRes.json()) as {
		userId?: string;
		displayName?: string;
		pictureUrl?: string;
	};
	if (!profile.userId) {
		throw new HttpsError("unauthenticated", "Failed to get LINE profile");
	}

	const auth = getAuth();
	if (isConfiguredAdminLineUser(profile.userId, config.ADMIN_LINE_USER_ID)) {
		const user = await ensureLineAuthUser(
			auth,
			profile.userId,
			profile.displayName,
			profile.pictureUrl,
		);
		// เขียน claim เฉพาะเมื่อยังไม่มี — ประหยัด 1 round-trip ต่อ login
		const existingClaims = (user.customClaims || {}) as { admin?: boolean };
		if (existingClaims.admin !== true) {
			await auth.setCustomUserClaims(profile.userId, {
				...existingClaims,
				admin: true,
			});
		}

		// การกวาด admin claim ที่ค้างจากคนที่ไม่อยู่ใน ADMIN_LINE_USER_ID แล้ว
		// ย้ายไป scheduled function `revokeStaleAdminClaimsScheduled` (ทุกวัน
		// 04:30) — เดิมทำตรงนี้ทุกครั้งที่ admin login (listUsers 1000 + revoke
		// ทีละคน) ทำให้ user รอหน้า loading นานเกิน 10s จน auto-reload ตัดหน้า

		const customToken = await auth.createCustomToken(profile.userId, {
			admin: true,
			provider: "line",
			...(profile.displayName ? { displayName: profile.displayName } : {}),
			...(profile.pictureUrl ? { pictureUrl: profile.pictureUrl } : {}),
		});

		return {
			customToken,
			profile: {
				userId: profile.userId,
				displayName: profile.displayName,
				pictureUrl: profile.pictureUrl,
			},
		};
	}

	try {
		const existing = await auth.getUser(profile.userId);
		// ถ้า claim admin ค้างจากการตั้งครั้งก่อน (เช่นเคยอยู่ใน ADMIN_LINE_USER_ID
		// หรือเคย bootstrap/setAdmin) แต่ตอนนี้ไม่ใช่ admin แล้ว → revoke ทิ้ง
		const existingClaims = existing.customClaims || {};
		if ((existingClaims as { admin?: boolean }).admin === true) {
			const { admin: _droppedAdmin, ...rest } = existingClaims as {
				admin?: boolean;
				[key: string]: unknown;
			};
			await auth.setCustomUserClaims(profile.userId, rest);
			// บังคับให้ refresh token ครั้งต่อไป → token เก่าที่ยังถือ admin: true
			// จะใช้งาน Firestore rules แบบ admin ไม่ได้อีกหลังหมดอายุ (~1 ชม.)
			await auth.revokeRefreshTokens(profile.userId);
		}
	} catch (error) {
		if ((error as { code?: string }).code === "auth/user-not-found") {
			throw new HttpsError(
				"permission-denied",
				UNPROVISIONED_LINE_USER_MESSAGE,
			);
		}
		throw error;
	}

	const employeeSnapshot = await getAppFirestore()
		.collection("employees")
		.where("lineUserId", "==", profile.userId)
		.limit(1)
		.get();
	if (employeeSnapshot.empty) {
		throw new HttpsError("permission-denied", UNPROVISIONED_LINE_USER_MESSAGE);
	}

	// 3. Create Firebase Custom Token for a provisioned LINE user
	const customToken = await auth.createCustomToken(profile.userId, {
		provider: "line",
		...(profile.displayName ? { displayName: profile.displayName } : {}),
		...(profile.pictureUrl ? { pictureUrl: profile.pictureUrl } : {}),
	});

	return {
		customToken,
		profile: {
			userId: profile.userId,
			displayName: profile.displayName,
			pictureUrl: profile.pictureUrl,
		},
	};
});

async function ensureLineAuthUser(
	auth: Auth,
	uid: string,
	displayName: string | undefined,
	photoURL: string | undefined,
): Promise<UserRecord> {
	const profileUpdate = {
		...(displayName ? { displayName } : {}),
		...(photoURL ? { photoURL } : {}),
	};

	// round-trip เดียว: updateUser คืน UserRecord (รวม customClaims) อยู่แล้ว —
	// ไม่ต้อง getUser → updateUser → getUser (3 เที่ยว) เหมือนเดิม
	try {
		if (Object.keys(profileUpdate).length === 0) return await auth.getUser(uid);
		return await auth.updateUser(uid, profileUpdate);
	} catch (error) {
		if ((error as { code?: string }).code !== "auth/user-not-found") {
			throw error;
		}
		return auth.createUser({ uid, ...profileUpdate });
	}
}
