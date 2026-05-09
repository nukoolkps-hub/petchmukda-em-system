/**
 * Shared config & helpers
 */

import { getFirestore } from "firebase-admin/firestore";
import type { LineConfig } from "../types.js";

export const FIRESTORE_DATABASE_ID =
	process.env.FIRESTORE_DATABASE_ID || "petchmukda-bot";

export function getAppFirestore() {
	return getFirestore(FIRESTORE_DATABASE_ID);
}

function nonEmptyEnv(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed || undefined;
}

function getEnvLineConfig(): LineConfig {
	const config: LineConfig = {};
	const accessToken = nonEmptyEnv(process.env.LINE_CHANNEL_ACCESS_TOKEN);
	const channelSecret = nonEmptyEnv(process.env.LINE_CHANNEL_SECRET);
	const adminLineUserId = nonEmptyEnv(process.env.ADMIN_LINE_USER_ID);
	const loginChannelId = nonEmptyEnv(process.env.LINE_LOGIN_CHANNEL_ID);
	const loginChannelSecret = nonEmptyEnv(process.env.LINE_LOGIN_CHANNEL_SECRET);

	if (accessToken) config.LINE_CHANNEL_ACCESS_TOKEN = accessToken;
	if (channelSecret) config.LINE_CHANNEL_SECRET = channelSecret;
	if (adminLineUserId) config.ADMIN_LINE_USER_ID = adminLineUserId;
	if (loginChannelId) config.LINE_LOGIN_CHANNEL_ID = loginChannelId;
	if (loginChannelSecret) config.LINE_LOGIN_CHANNEL_SECRET = loginChannelSecret;

	return config;
}

/* ─── Color palette (LINE Flex Messages) ──────────────────────── */
export const COLORS = {
	maroon: "#7B1C1C",
	goldLight: "#E8C87A",
	goldPale: "#F5E6C8",
	text: "#2D1A0E",
	textMedium: "#7A5C3A",
	green: "#1A6B3A",
	greenLight: "#E8F5EE",
	red: "#C0392B",
} as const;

/* ─── Thai number formatter ───────────────────────────────────── */
export const formatThaiNumber = (n: number | string | undefined): string =>
	Number(n || 0).toLocaleString("th-TH");

/* ─── Read LINE secrets from Firestore ────────────────────────── */
export async function getLineConfig(): Promise<LineConfig> {
	const db = getAppFirestore();
	const doc = await db.doc("config/secrets").get();
	return {
		...((doc.data() as LineConfig) || {}),
		...getEnvLineConfig(),
	};
}
