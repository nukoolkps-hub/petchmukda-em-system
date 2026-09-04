/**
 * revokeStaleAdminClaimsScheduled — กวาด admin custom claim ที่ค้างจาก user
 * ที่ไม่อยู่ใน ADMIN_LINE_USER_ID แล้ว (เคย bootstrap / setAdmin ไว้)
 *
 * รัน 04:30 ทุกวัน — เดิมทำใน lineAuth ทุกครั้งที่ admin login (listUsers 1000
 * + setCustomUserClaims/revokeRefreshTokens ทีละคน) ซึ่งทำให้การ login ช้า
 * หลายวินาทีโดยที่ user ต้องรอหน้า loading · ย้ายมาเป็น scheduled แทน:
 * ex-admin ถือ claim ค้างได้ไม่เกิน 1 วัน (lineAuth ยัง revoke ให้ทันทีเมื่อ
 * คนนั้น login เองด้วย — ดู path ไม่ใช่ admin ใน lineAuth.ts)
 */

import { type Auth, getAuth } from "firebase-admin/auth";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { APP_TIMEZONE } from "../dailySummary/config.js";
import { getLineConfig } from "../helpers/config.js";

/**
 * กวาด admin custom claim จาก user ที่ไม่ได้อยู่ใน ADMIN_LINE_USER_ID
 * รองรับสูงสุด 1000 users ต่อ batch (เพียงพอสำหรับร้านเล็ก) · คืนจำนวนที่ถอน
 */
export async function revokeStaleAdminClaims(
	auth: Auth,
	configValue: string | undefined,
): Promise<number> {
	const allowedAdminIds = new Set(
		configValue
			?.split(/[,\s]+/)
			.map((value) => value.trim())
			.filter(Boolean) || [],
	);

	const { users } = await auth.listUsers(1000);
	let revokedCount = 0;
	for (const user of users) {
		const claims = (user.customClaims || {}) as {
			admin?: boolean;
			[key: string]: unknown;
		};
		if (claims.admin === true && !allowedAdminIds.has(user.uid)) {
			const { admin: _droppedAdmin, ...rest } = claims;
			await auth.setCustomUserClaims(user.uid, rest);
			// บังคับให้ refresh token ครั้งต่อไป → token เก่าที่ยังถือ admin: true
			// ใช้ Firestore rules แบบ admin ไม่ได้อีกหลังหมดอายุ (~1 ชม.)
			await auth.revokeRefreshTokens(user.uid);
			revokedCount++;
			console.log(
				`[revokeStaleAdminClaims] revoked admin claim from ${user.uid}`,
			);
		}
	}
	return revokedCount;
}

export const revokeStaleAdminClaimsScheduled = onSchedule(
	{ schedule: "30 4 * * *", timeZone: APP_TIMEZONE },
	async () => {
		const config = await getLineConfig();
		if (!config.ADMIN_LINE_USER_ID) {
			// ยังไม่ตั้ง admin เลย → ไม่กวาด (กันถอน claim ของคนที่ bootstrap อยู่)
			console.log("[revokeStaleAdminClaims] ADMIN_LINE_USER_ID not set — skip");
			return;
		}
		const revoked = await revokeStaleAdminClaims(
			getAuth(),
			config.ADMIN_LINE_USER_ID,
		);
		console.log(
			`[revokeStaleAdminClaims] cleaned up ${revoked} stale admin(s)`,
		);
	},
);
