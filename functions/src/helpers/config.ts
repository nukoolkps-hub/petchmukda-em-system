/**
 * Shared config & helpers
 */

import { getFirestore } from "firebase-admin/firestore";
import type { LineConfig } from "../types.js";

/* ─── Color palette (LINE Flex Messages) ──────────────────────── */
export const COLOR = {
  maroon: "#7B1C1C",
  goldLt: "#E8C87A",
  goldPale: "#F5E6C8",
  text: "#2D1A0E",
  textMid: "#7A5C3A",
  green: "#1A6B3A",
  greenLt: "#E8F5EE",
  red: "#C0392B",
} as const;

/* ─── Thai number formatter ───────────────────────────────────── */
export const TH_NUM = (n: number | string | undefined): string =>
  Number(n || 0).toLocaleString("th-TH");

/* ─── Read LINE secrets from Firestore ────────────────────────── */
export async function getLineConfig(): Promise<LineConfig> {
  const db = getFirestore();
  const doc = await db.doc("config/secrets").get();
  return (doc.data() as LineConfig) || {};
}
