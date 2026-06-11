/**
 * fetchGoldPrice — ดึงราคาทองคำไทยจาก goldprice.mukdagold.com
 *
 * Schedule: ทุก 15 นาที (เวลาไทย) — เขียน /config/goldPrice ใน Firestore
 * Source:   /api/price2 (สมาคมค้าทองคำ — ใหม่)
 * Returns:  { buyPrice, sellPrice, priceChanged, date, time }
 *           ใช้ sellPrice = ราคาทองคำแท่งบาทละ (ราคาขาย)
 *
 * Manual trigger: callable function fetchGoldPriceNow (admin only)
 *
 * กัน write churn: ถ้า sellPrice เท่าราคาเดิม → skip (ไม่เขียน)
 * Sanity check: 10,000 ≤ sellPrice ≤ 200,000 ฿/บาท
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAppFirestore } from "../helpers/config.js";

const SOURCE_URL = "https://goldprice.mukdagold.com/api/price2";
const SOURCE_LABEL = "auto · สมาคมค้าทองคำ";
const SANE_MIN = 10000;
const SANE_MAX = 200000;

interface GoldApiResponse {
	buyPrice: number;
	sellPrice: number;
	priceChanged: number;
	date: string; // "DD/MM/YYYY" (พ.ศ.)
	time: string; // "HH:MM"
}

interface StoreResult {
	stored: boolean;
	price: number;
	reason?: string;
	source: { date: string; time: string };
}

async function fetchAndStore(): Promise<StoreResult> {
	const res = await fetch(SOURCE_URL);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} from ${SOURCE_URL}`);
	}
	const data = (await res.json()) as Partial<GoldApiResponse>;
	const sellPrice = Number(data.sellPrice);

	if (
		!Number.isFinite(sellPrice) ||
		sellPrice < SANE_MIN ||
		sellPrice > SANE_MAX
	) {
		throw new Error(`Invalid sellPrice: ${data.sellPrice}`);
	}

	const sourceDate = String(data.date || "");
	const sourceTime = String(data.time || "");

	const db = getAppFirestore();
	const docRef = db.collection("config").doc("goldPrice");
	const snap = await docRef.get();
	const current = (snap.exists ? snap.data() : {}) as Record<string, unknown>;

	// ถ้าราคาเท่าของเดิม + GTA datestamp เดิม → skip
	// (กัน Firestore write churn ตอน GTA ยังไม่ update ตลอดวัน)
	if (
		current?.pricePerBaht === sellPrice &&
		current?.sourceDate === sourceDate &&
		current?.sourceTime === sourceTime
	) {
		return {
			stored: false,
			price: sellPrice,
			reason: "no change",
			source: { date: sourceDate, time: sourceTime },
		};
	}

	await docRef.set(
		{
			pricePerBaht: sellPrice,
			updatedAt: Date.now(),
			updatedBy: SOURCE_LABEL,
			source: "price2",
			sourceDate,
			sourceTime,
			buyPrice: Number(data.buyPrice) || 0,
			priceChanged: Number(data.priceChanged) || 0,
		},
		{ merge: true },
	);

	return {
		stored: true,
		price: sellPrice,
		source: { date: sourceDate, time: sourceTime },
	};
}

/** Scheduled: ทุก 15 นาที */
export const fetchGoldPriceScheduled = onSchedule(
	{ schedule: "*/15 * * * *", timeZone: "Asia/Bangkok" },
	async () => {
		try {
			const result = await fetchAndStore();
			console.log(
				`[fetchGoldPrice] ${result.stored ? "stored" : "skipped"} ` +
					`price=${result.price} source=${result.source.date} ${result.source.time}` +
					(result.reason ? ` (${result.reason})` : ""),
			);
		} catch (err) {
			console.error("[fetchGoldPrice] failed:", err);
		}
	},
);

/** Manual trigger: admin คลิกปุ่ม "ดึงราคาตอนนี้" ใน admin panel */
export const fetchGoldPriceNow = onCall(async (request) => {
	if (!request.auth) {
		throw new HttpsError("unauthenticated", "ต้อง login ก่อน");
	}
	if (!(request.auth.token as { admin?: boolean }).admin) {
		throw new HttpsError("permission-denied", "Admin only");
	}
	try {
		const result = await fetchAndStore();
		return {
			ok: true,
			stored: result.stored,
			price: result.price,
			reason: result.reason,
			sourceDate: result.source.date,
			sourceTime: result.source.time,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[fetchGoldPriceNow] failed:", err);
		throw new HttpsError("internal", `ดึงราคาไม่สำเร็จ: ${msg}`);
	}
});
