/**
 * setAdmin — ตั้ง Custom Claims (admin role)
 */

import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { SetAdminData } from "../types.js";

export const setAdmin = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");

	// Verify caller is admin
	if (!(request.auth.token as { admin?: boolean }).admin) {
		throw new HttpsError("permission-denied", "Caller is not admin");
	}

	const { uid, isAdmin } = request.data as SetAdminData;
	if (!uid) throw new HttpsError("invalid-argument", "Missing uid");

	await getAuth().setCustomUserClaims(uid, { admin: !!isAdmin });
	return { ok: true, message: `User ${uid} admin status: ${!!isAdmin}` };
});
