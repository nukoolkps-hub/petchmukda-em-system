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
	return (doc.data() as LineConfig) || {};
}
