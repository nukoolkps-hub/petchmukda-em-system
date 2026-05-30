/**
 * cleanupOldSlips — ลบไฟล์ Storage ทุกประเภทที่เก่ากว่า 5 ปี
 * (runs 03:00 วันที่ 1 ของทุกเดือน, Asia/Bangkok)
 *
 * Path ที่ user upload เข้ามา (เทียบกับ storage.rules):
 *   - salarySlips/{employeeId}/{YYYY-MM}.pdf      (สลิปเงินเดือน — overwrite ทับชื่อเดิม)
 *   - advanceSlips/{advanceId}/slip-{ts}.jpg     (สลิปโอนเงินเบิก — สะสมต่อเรื่อง)
 *   - avatars/{employeeId}/avatar-{ts}.jpg       (รูปโปรไฟล์ — สะสมทุกครั้งเปลี่ยนรูป)
 *
 * ตัดสินอายุจาก metadata.timeCreated (เวลาอัปโหลดจริง) — ครบ 5 ปีลบ
 * กฎหมายบัญชีไทยกำหนดเก็บเอกสารอย่างน้อย 5 ปี
 *
 * NOTE: เก็บชื่อ export `cleanupOldSlips` ไว้เดิม เพื่อไม่ให้ deployed function
 *       ตัวเก่าค้าง (Firebase deploy ใช้ชื่อ export เป็น function name)
 */

import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";

const STORAGE_PREFIXES = ["salarySlips/", "advanceSlips/", "avatars/"];

export const cleanupOldSlips = onSchedule(
	{ schedule: "0 3 1 * *", timeZone: "Asia/Bangkok" },
	async () => {
		const bucket = getStorage().bucket();
		const cutoff = new Date();
		cutoff.setFullYear(cutoff.getFullYear() - 5);

		let scanned = 0;
		let deleted = 0;
		for (const prefix of STORAGE_PREFIXES) {
			const [files] = await bucket.getFiles({ prefix });
			for (const file of files) {
				scanned++;
				const created = file.metadata.timeCreated;
				if (!created) continue;
				if (new Date(created) < cutoff) {
					try {
						await file.delete();
						deleted++;
					} catch (err) {
						console.error(
							`[cleanupOldSlips] delete failed: ${file.name}`,
							err,
						);
					}
				}
			}
		}
		console.log(
			`[cleanupOldSlips] Scanned ${scanned}, deleted ${deleted} files created before ${cutoff.toISOString()}`,
		);
	},
);
