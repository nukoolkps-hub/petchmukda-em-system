/**
 * devAuth — emulator-only fixed login users for local testing.
 */

import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { parseDevAuthPayload } from "../helpers/payload.js";

const DEV_USERS = {
	employee: {
		uid: "dev_employee",
		displayName: "ธนกร มั่นคง",
		admin: false,
	},
	admin: {
		uid: "dev_admin",
		displayName: "นภัส สุขใจ",
		admin: true,
	},
} as const;

export const devAuth = onCall(async (request) => {
	if (process.env.FUNCTIONS_EMULATOR !== "true") {
		throw new HttpsError(
			"failed-precondition",
			"Dev auth is available only in the Firebase emulator",
		);
	}

	const { role } = parseDevAuthPayload(request.data);
	const user = DEV_USERS[role];

	const auth = getAuth();
	try {
		await auth.getUser(user.uid);
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code !== "auth/user-not-found") throw error;
		await auth.createUser({ uid: user.uid, displayName: user.displayName });
	}
	await auth.setCustomUserClaims(user.uid, { admin: user.admin });

	const customToken = await auth.createCustomToken(user.uid, {
		admin: user.admin,
		provider: "dev",
		displayName: user.displayName,
	});

	return {
		customToken,
		uid: user.uid,
		admin: user.admin,
		displayName: user.displayName,
	};
});
