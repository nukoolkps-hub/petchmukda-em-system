/**
 * scheduledImages — รูปที่ admin อัปโหลด + ตั้งวันส่ง เพื่อแนบไปกับสรุป
 * ประจำวัน 07:30 (กลุ่ม we r mukda เท่านั้น)
 *
 * Collection: `dailySummaryImages/{id}`
 *   - imageUrl: string   — Firebase Storage download URL (token-based)
 *   - date: string       — "YYYY-MM-DD" (Bangkok) วันที่ต้องการส่ง
 *   - note?: string      — ป้ายกำกับให้ admin (ไม่ส่งเข้า LINE)
 *   - sentAt?: string    — ISO timestamp เมื่อส่งจริงแล้ว (ส่งครั้งเดียว)
 *   - createdAt/createdBy
 *
 * "ส่งครั้งเดียว": scheduled path เลือกเฉพาะ doc ที่ยังไม่มี sentAt แล้ว
 * stamp sentAt หลังส่งสำเร็จ · preview (ทดสอบแจ้งเตือน) แสดงได้ทุกอันโดย
 * ไม่ stamp — admin ทดสอบซ้ำได้
 */

import type { Firestore } from "firebase-admin/firestore";

/** จำนวนรูปสูงสุดที่แนบต่อวัน — LINE push จำกัด 5 message/ครั้ง (flex + 4 รูป) */
export const MAX_IMAGES_PER_DAY = 4;

export interface ScheduledImage {
	id: string;
	imageUrl: string;
	note: string | null;
	sentAt: string | null;
}

/** ดึงรูปที่ตั้งวันส่ง == ymd (เรียงตามเวลาสร้าง) */
export async function fetchScheduledImages(
	db: Firestore,
	ymd: string,
): Promise<ScheduledImage[]> {
	const snap = await db
		.collection("dailySummaryImages")
		.where("date", "==", ymd)
		.get();
	const images = snap.docs.map((doc) => {
		const data = doc.data();
		return {
			id: doc.id,
			imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
			note: typeof data.note === "string" ? data.note : null,
			sentAt: typeof data.sentAt === "string" ? data.sentAt : null,
			createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
		};
	});
	// เรียงเก่า→ใหม่ ใน code (เลี่ยง composite index กับ where date)
	images.sort((a, b) => a.createdAt - b.createdAt);
	return images.map(({ id, imageUrl, note, sentAt }) => ({
		id,
		imageUrl,
		note,
		sentAt,
	}));
}

/** stamp sentAt = now ให้ทุก id (best-effort · ไม่ throw ถ้า fail) */
export async function markImagesSent(
	db: Firestore,
	ids: string[],
	sentAtIso: string,
): Promise<void> {
	await Promise.all(
		ids.map((id) =>
			db
				.doc(`dailySummaryImages/${id}`)
				.update({ sentAt: sentAtIso })
				.catch((err) => {
					console.error(
						`[scheduledImages] mark sent failed for ${id}:`,
						err,
					);
				}),
		),
	);
}
