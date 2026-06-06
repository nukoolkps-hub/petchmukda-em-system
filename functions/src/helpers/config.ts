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

/* ─── Read LINE secrets from Firestore ──────────────────────────
   trim field names + string values — กัน user/admin พิมพ์ space
   ติดมาตอนสร้าง field ใน Firestore Console (เคยมีเคส
   "ANTHROPIC_API_KEY " ที่ trailing space ทำให้อ่านไม่เจอ)         */
export async function getLineConfig(): Promise<LineConfig> {
	const db = getAppFirestore();
	const doc = await db.doc("config/secrets").get();
	const raw = doc.data();
	if (!raw) return {};
	const cleaned: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		const trimmedKey = key.trim();
		cleaned[trimmedKey] = typeof value === "string" ? value.trim() : value;
	}
	return cleaned as LineConfig;
}

/* ─── Notification toggle (admin UI: LINE BOT > การแจ้งเตือน) ─────
   อ่าน config/notifications doc — default semantic: missing field /
   !== false → enabled. เฉพาะ === false เท่านั้นที่ skip                 */
export async function isNotificationEnabled(
	field:
		| "dailySummaryEnabled"
		| "advanceRequestEnabled"
		| "advanceApprovalEnabled",
): Promise<boolean> {
	try {
		const doc = await getAppFirestore().doc("config/notifications").get();
		return (doc.data() as Record<string, unknown> | undefined)?.[field] !== false;
	} catch (err) {
		console.warn(
			"[isNotificationEnabled] read failed, defaulting to enabled:",
			err,
		);
		return true; // fail-safe: ส่งต่อ ไม่ block
	}
}

/* ─── Check if LINE user ID is in admin list ─────────────────── */
export function isConfiguredAdminLineUser(
	lineUserId: string,
	configValue: string | undefined,
): boolean {
	return (
		configValue
			?.split(/[,\s]+/)
			.map((value) => value.trim())
			.filter(Boolean)
			.includes(lineUserId) || false
	);
}
