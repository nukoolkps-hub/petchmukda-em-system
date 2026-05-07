/**
 * lineAuth — LINE Login → Firebase Custom Token
 */

import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getLineConfig } from "../helpers/config.js";
import { parseLineAuthPayload } from "../helpers/payload.js";

export const lineAuth = onCall(async (request) => {
	const { code, redirectUri } = parseLineAuthPayload(request.data);

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

	// 3. Create Firebase Custom Token
	const customToken = await getAuth().createCustomToken(profile.userId, {
		provider: "line",
		displayName: profile.displayName,
		pictureUrl: profile.pictureUrl,
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
