/**
 * cleanupOldSlips — ลบสลิปเงินเดือนใน Storage ที่เก่ากว่า 5 ปี
 * (runs 03:00 วันที่ 1 ของทุกเดือน)
 *
 * ไฟล์เก็บที่ salarySlips/{employeeId}/{YYYY-MM}.pdf
 * อ่าน YYYY-MM จากชื่อไฟล์แล้วเทียบกับ cutoff (วันนี้ − 5 ปี)
 * กฎหมายบัญชีไทยกำหนดเก็บเอกสารอย่างน้อย 5 ปี — ลบของเก่าเพื่อประหยัดพื้นที่
 */

import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const cleanupOldSlips = onSchedule(
	{ schedule: "0 3 1 * *", timeZone: "Asia/Bangkok" },
	async () => {
		const bucket = getStorage().bucket();
		const [files] = await bucket.getFiles({ prefix: "salarySlips/" });

		const cutoff = new Date();
		cutoff.setFullYear(cutoff.getFullYear() - 5);
		// "YYYY-MM" เปรียบเทียบแบบ string ได้เพราะ zero-padded
		const cutoffYearMonth = `${cutoff.getFullYear()}-${String(
			cutoff.getMonth() + 1,
		).padStart(2, "0")}`;

		let deleted = 0;
		for (const file of files) {
			const match = file.name.match(
				/salarySlips\/[^/]+\/(\d{4}-\d{2})\.pdf$/,
			);
			if (!match) continue;
			if (match[1] < cutoffYearMonth) {
				try {
					await file.delete();
					deleted++;
				} catch (err) {
					console.error(`[cleanupOldSlips] delete failed: ${file.name}`, err);
				}
			}
		}
		console.log(
			`[cleanupOldSlips] Deleted ${deleted} salary slips older than ${cutoffYearMonth}`,
		);
	},
);
