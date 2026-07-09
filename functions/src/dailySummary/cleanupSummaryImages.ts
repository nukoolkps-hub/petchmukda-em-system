/**
 * cleanupSummaryImages — ลบรูปแนบสรุปเช้าที่พ้นวันส่งแล้ว (runs 04:00 ทุกวัน)
 *
 * รูปที่ admin ตั้งเวลาไว้จะถูกส่งในวัน `date` (07:30) · หลังจากนั้น (วันถัดไป)
 * ไม่มีประโยชน์ที่จะเก็บไว้ → ลบทั้ง Firestore doc + ไฟล์ใน Storage เพื่อ
 * ประหยัดพื้นที่ + กัน collection/bucket โต
 *
 * เงื่อนไข: `date < วันนี้ (Bangkok)` — ครอบคลุมทั้งรูปที่ส่งแล้ว (ตามที่ต้องการ)
 * และรูปที่พลาดการส่ง (เช่น ตั้งไว้วันเสาร์ปกติที่ร้านปิด) ซึ่งจะไม่ถูกส่งอีก
 * รูปของวันนี้ (date == วันนี้) และอนาคต (date > วันนี้) ไม่ถูกแตะ
 *
 * รันเวลา 04:00 (ก่อน sendDailySummary 07:30) — ปลอดภัยเพราะเทียบ date < วันนี้
 * เท่านั้น รูปของวันนี้จึงยังอยู่ครบตอนส่ง
 */

import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAppFirestore } from "../helpers/config.js";
import { bangkokYmd } from "./dateUtils.js";

export const cleanupSummaryImages = onSchedule(
	{ schedule: "0 4 * * *", timeZone: "Asia/Bangkok" },
	async () => {
		const db = getAppFirestore();
		const today = bangkokYmd(new Date());

		// date < วันนี้ = พ้นวันส่งแล้ว (range query · single field · ไม่ต้อง index)
		const snap = await db
			.collection("dailySummaryImages")
			.where("date", "<", today)
			.get();

		if (snap.empty) {
			console.log("[cleanupSummaryImages] no past images to delete");
			return;
		}

		const bucket = getStorage().bucket();
		let deleted = 0;
		for (const docSnap of snap.docs) {
			// ลบไฟล์ Storage ทั้งหมดใต้ dailySummaryImages/{id}/ ก่อน แล้วค่อยลบ doc
			// (best-effort · ถ้าไฟล์ fail ยังลบ doc เพื่อไม่ให้ค้างใน UI)
			await bucket
				.deleteFiles({ prefix: `dailySummaryImages/${docSnap.id}/` })
				.catch((err) => {
					console.error(
						`[cleanupSummaryImages] storage delete failed for ${docSnap.id}:`,
						err,
					);
				});
			try {
				await docSnap.ref.delete();
				deleted++;
			} catch (err) {
				console.error(
					`[cleanupSummaryImages] doc delete failed for ${docSnap.id}:`,
					err,
				);
			}
		}
		console.log(
			`[cleanupSummaryImages] Deleted ${deleted} summary image(s) before ${today}`,
		);
	},
);
