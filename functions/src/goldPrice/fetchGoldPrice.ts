/**
 * fetchGoldPrice — ดึงราคาทองคำแท่ง 96.5% (สมาคมค้าทองคำ) จากฮั่วเซงเฮง
 *
 * Schedule: ทุก 15 นาที (เวลาไทย) — เขียน /config/goldPrice ใน Firestore
 * Source:   apicheckpricev3.huasengheng.com /api/values/getprice/
 *           ตอบเป็น XML: <ArrayOfGoldPriceStruct> มี 3 แถว —
 *           GoldType HSH (ราคาฮั่วเซงเฮง) / REF (ราคาสมาคม) / JEWEL (รูปพรรณ)
 *           → ใช้แถว REF + field <Sell> = ราคาทองคำแท่งบาทละ (ขาย, สมาคม)
 *           ตัวเลขมี comma ("63,950") → strip ก่อน parse
 *
 * Manual trigger: callable function fetchGoldPriceNow (admin only)
 *
 * กัน write churn: ถ้า sellPrice + TimeUpdate เท่าเดิม → skip (ไม่เขียน)
 * Sanity check: 10,000 ≤ sellPrice ≤ 200,000 ฿/บาท
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAppFirestore } from "../helpers/config.js";

const SOURCE_URL = "https://apicheckpricev3.huasengheng.com/api/values/getprice/";
const SOURCE_LABEL = "auto · สมาคมค้าทองคำ (ฮั่วเซงเฮง)";
const SANE_MIN = 10000;
const SANE_MAX = 200000;

interface GoldStruct {
	goldType: string;
	goldCode: string;
	buy: number;
	sell: number;
	sellChange: number;
	timeUpdate: string; // ISO "2026-06-11T17:00:28"
}

interface StoreResult {
	stored: boolean;
	price: number;
	reason?: string;
	source: { date: string; time: string };
}

/** "63,950" → 63950 · ค่าว่าง/nil → NaN */
function parsePrice(s: string | undefined): number {
	if (!s) return Number.NaN;
	return Number(s.replace(/,/g, ""));
}

function tagValue(block: string, tag: string): string {
	const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
	return m?.[1] ?? "";
}

/** parse XML <ArrayOfGoldPriceStruct> → struct list (regex — ไม่ต้องพึ่ง XML lib) */
function parseGoldStructs(xml: string): GoldStruct[] {
	const blocks = xml.match(/<GoldPriceStruct>[\s\S]*?<\/GoldPriceStruct>/g) || [];
	return blocks.map((b) => ({
		goldType: tagValue(b, "GoldType"),
		goldCode: tagValue(b, "GoldCode"),
		buy: parsePrice(tagValue(b, "Buy")),
		sell: parsePrice(tagValue(b, "Sell")),
		sellChange: parsePrice(tagValue(b, "SellChange")),
		timeUpdate: tagValue(b, "TimeUpdate"),
	}));
}

async function fetchAndStore(): Promise<StoreResult> {
	const res = await fetch(SOURCE_URL);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} from ${SOURCE_URL}`);
	}
	const xml = await res.text();
	const structs = parseGoldStructs(xml);

	// REF = ราคาอ้างอิงสมาคมค้าทองคำ (ไม่ใช่ราคา HSH เอง)
	const ref = structs.find((s) => s.goldType === "REF");
	if (!ref) {
		throw new Error(
			`GoldType REF not found (got: ${structs.map((s) => s.goldType).join(", ") || "none"})`,
		);
	}

	const sellPrice = ref.sell;
	if (
		!Number.isFinite(sellPrice) ||
		sellPrice < SANE_MIN ||
		sellPrice > SANE_MAX
	) {
		throw new Error(`Invalid REF sellPrice: ${ref.sell}`);
	}

	// TimeUpdate ISO "2026-06-11T17:00:28" → date/time แยกเก็บ (ใช้เทียบ dirty)
	const [sourceDate = "", sourceTime = ""] = ref.timeUpdate.split("T");

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
			source: "hsh-ref",
			sourceDate,
			sourceTime,
			buyPrice: Number.isFinite(ref.buy) ? ref.buy : 0,
			priceChanged: Number.isFinite(ref.sellChange) ? ref.sellChange : 0,
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
