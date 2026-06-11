/**
 * fetchGoldPrice — ดึงราคาทองคำแท่ง 96.5% (สมาคมค้าทองคำ)
 *
 * Schedule: ทุก 15 นาที (เวลาไทย) — เขียน /config/goldPrice ใน Firestore
 *
 * Source chain (ลองตามลำดับ — ตัวแรกที่สำเร็จชนะ):
 * 1. ฮั่วเซงเฮง apicheckpricev3.huasengheng.com /api/values/getprice/
 *    ตอบ XML <ArrayOfGoldPriceStruct> 3 แถว: HSH / REF / JEWEL
 *    → ใช้แถว REF (ราคาอ้างอิงสมาคม) + <Sell> · ตัวเลขมี comma → strip
 *    หมายเหตุ: เว็บ HSH มี bot protection — ต้องส่ง browser-like headers
 * 2. goldprice.mukdagold.com /api/price2 (เว็บราคาทองของร้านเอง — สมาคม)
 *    ตอบ JSON { buyPrice, sellPrice, priceChanged, date, time }
 *
 * Manual trigger: callable function fetchGoldPriceNow (admin only)
 *
 * Observability: fail ทั้ง 2 source → เขียน lastFetchError + lastFetchErrorAt
 * ลง doc เดียวกัน (ไม่แตะ pricePerBaht) — admin เห็น warning ใน panel
 *
 * กัน write churn: ถ้า sellPrice + source timestamp เท่าเดิม → skip
 * Sanity check: 10,000 ≤ sellPrice ≤ 200,000 ฿/บาท
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAppFirestore } from "../helpers/config.js";

const HSH_URL = "https://apicheckpricev3.huasengheng.com/api/values/getprice/";
const MUKDA_URL = "https://goldprice.mukdagold.com/api/price2";
const SANE_MIN = 10000;
const SANE_MAX = 200000;

// บาง upstream (เช่น HSH) มี bot protection — default UA ของ node fetch
// ("node") โดนปฏิเสธ 403 ได้ → ปลอมเป็นเบราว์เซอร์
const BROWSER_HEADERS: Record<string, string> = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	Accept: "application/xml, text/xml, application/json, */*",
	"Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
};

const FETCH_TIMEOUT_MS = 10000;

interface PriceData {
	sellPrice: number;
	buyPrice: number;
	priceChanged: number;
	sourceDate: string;
	sourceTime: string;
	source: string; // "hsh-ref" | "mukda-price2"
	label: string; // updatedBy ที่โชว์ใน UI
}

interface StoreResult {
	stored: boolean;
	price: number;
	reason?: string;
	source: { date: string; time: string };
	via: string;
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

function assertSane(sellPrice: number, context: string): void {
	if (
		!Number.isFinite(sellPrice) ||
		sellPrice < SANE_MIN ||
		sellPrice > SANE_MAX
	) {
		throw new Error(`Invalid sellPrice (${context}): ${sellPrice}`);
	}
}

async function fetchWithTimeout(url: string): Promise<Response> {
	const res = await fetch(url, {
		headers: BROWSER_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} from ${url}`);
	}
	return res;
}

/** Source 1: ฮั่วเซงเฮง — XML, ใช้แถว GoldType=REF (ราคาสมาคม) */
async function fetchFromHsh(): Promise<PriceData> {
	const res = await fetchWithTimeout(HSH_URL);
	const xml = await res.text();

	const blocks = xml.match(/<GoldPriceStruct>[\s\S]*?<\/GoldPriceStruct>/g) || [];
	const structs = blocks.map((b) => ({
		goldType: tagValue(b, "GoldType"),
		buy: parsePrice(tagValue(b, "Buy")),
		sell: parsePrice(tagValue(b, "Sell")),
		sellChange: parsePrice(tagValue(b, "SellChange")),
		timeUpdate: tagValue(b, "TimeUpdate"),
	}));

	// REF = ราคาอ้างอิงสมาคมค้าทองคำ (ไม่ใช่ราคา HSH เอง)
	const ref = structs.find((s) => s.goldType === "REF");
	if (!ref) {
		throw new Error(
			`GoldType REF not found (got: ${structs.map((s) => s.goldType).join(", ") || "none"})`,
		);
	}
	assertSane(ref.sell, "HSH REF");

	// TimeUpdate ISO "2026-06-11T17:00:28" → date/time แยกเก็บ (ใช้เทียบ dirty)
	const [sourceDate = "", sourceTime = ""] = ref.timeUpdate.split("T");
	return {
		sellPrice: ref.sell,
		buyPrice: Number.isFinite(ref.buy) ? ref.buy : 0,
		priceChanged: Number.isFinite(ref.sellChange) ? ref.sellChange : 0,
		sourceDate,
		sourceTime,
		source: "hsh-ref",
		label: "auto · สมาคมค้าทองคำ (ฮั่วเซงเฮง)",
	};
}

/** Source 2 (fallback): เว็บราคาทองของร้านเอง — JSON สมาคม */
async function fetchFromMukda(): Promise<PriceData> {
	const res = await fetchWithTimeout(MUKDA_URL);
	const data = (await res.json()) as {
		buyPrice?: number;
		sellPrice?: number;
		priceChanged?: number;
		date?: string;
		time?: string;
	};
	const sellPrice = Number(data.sellPrice);
	assertSane(sellPrice, "mukda price2");
	return {
		sellPrice,
		buyPrice: Number(data.buyPrice) || 0,
		priceChanged: Number(data.priceChanged) || 0,
		sourceDate: String(data.date || ""),
		sourceTime: String(data.time || ""),
		source: "mukda-price2",
		label: "auto · สมาคมค้าทองคำ (mukdagold)",
	};
}

/** ลอง source ตามลำดับ — ตัวแรกที่สำเร็จชนะ · fail หมด → โยน error รวม */
async function fetchFromAnySource(): Promise<PriceData> {
	const errors: string[] = [];
	for (const [name, fn] of [
		["HSH", fetchFromHsh],
		["mukda", fetchFromMukda],
	] as const) {
		try {
			return await fn();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`${name}: ${msg}`);
			console.warn(`[fetchGoldPrice] source ${name} failed: ${msg}`);
		}
	}
	throw new Error(errors.join(" · "));
}

async function fetchAndStore(): Promise<StoreResult> {
	const db = getAppFirestore();
	const docRef = db.collection("config").doc("goldPrice");

	let data: PriceData;
	try {
		data = await fetchFromAnySource();
	} catch (err) {
		// เก็บ error ลง doc (ไม่แตะ pricePerBaht) — panel โชว์ warning ให้ admin
		const msg = err instanceof Error ? err.message : String(err);
		await docRef.set(
			{ lastFetchError: msg, lastFetchErrorAt: Date.now() },
			{ merge: true },
		);
		throw err;
	}

	const snap = await docRef.get();
	const current = (snap.exists ? snap.data() : {}) as Record<string, unknown>;

	// ถ้าราคาเท่าของเดิม + source timestamp เดิม → skip
	// (กัน Firestore write churn ตอนสมาคมยังไม่ขยับราคา)
	if (
		current?.pricePerBaht === data.sellPrice &&
		current?.sourceDate === data.sourceDate &&
		current?.sourceTime === data.sourceTime
	) {
		// เคลียร์ error เก่า (fetch รอบนี้สำเร็จแล้ว)
		if (current?.lastFetchError) {
			await docRef.set(
				{ lastFetchError: "", lastFetchErrorAt: 0 },
				{ merge: true },
			);
		}
		return {
			stored: false,
			price: data.sellPrice,
			reason: "no change",
			source: { date: data.sourceDate, time: data.sourceTime },
			via: data.source,
		};
	}

	await docRef.set(
		{
			pricePerBaht: data.sellPrice,
			updatedAt: Date.now(),
			updatedBy: data.label,
			source: data.source,
			sourceDate: data.sourceDate,
			sourceTime: data.sourceTime,
			buyPrice: data.buyPrice,
			priceChanged: data.priceChanged,
			lastFetchError: "",
			lastFetchErrorAt: 0,
		},
		{ merge: true },
	);

	return {
		stored: true,
		price: data.sellPrice,
		source: { date: data.sourceDate, time: data.sourceTime },
		via: data.source,
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
					`price=${result.price} via=${result.via} ` +
					`source=${result.source.date} ${result.source.time}` +
					(result.reason ? ` (${result.reason})` : ""),
			);
		} catch (err) {
			console.error("[fetchGoldPrice] all sources failed:", err);
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
			via: result.via,
			sourceDate: result.source.date,
			sourceTime: result.source.time,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[fetchGoldPriceNow] failed:", err);
		throw new HttpsError("internal", `ดึงราคาไม่สำเร็จ: ${msg}`);
	}
});
