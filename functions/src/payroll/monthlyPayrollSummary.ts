/**
 * monthlyPayrollSummary — สรุปเงินเดือนตอนสิ้นเดือน (28th, 23:00 ICT)
 */

import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getLineConfig } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";

export const monthlyPayrollSummary = onSchedule(
	{ schedule: "0 23 28 * *", timeZone: "Asia/Bangkok" },
	async () => {
		const db = getFirestore();
		const now = new Date();
		const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		console.log(`[monthlyPayrollSummary] Running for ${yearMonth}`);

		const employeesSnapshot = await db.collection("employees").get();
		let total = 0;
		let count = 0;

		for (const employee of employeesSnapshot.docs) {
			const salDoc = await db
				.doc(`salaries/${employee.id}/months/${yearMonth}`)
				.get();
			const data = salDoc.data();
			if (data) {
				const base = (data.baseSalary as number) || 0;
				const pieces =
					((data.singleRatePieces as number) || 0) +
					((data.normalSalePieces as number) || 0) +
					((data.specialSalePieces as number) || 0);
				total += base + pieces * 50;
				count++;
			}
		}

		const config = await getLineConfig();
		if (config.ADMIN_LINE_USER_ID && config.LINE_CHANNEL_ACCESS_TOKEN) {
			await pushLineMessage(
				config.LINE_CHANNEL_ACCESS_TOKEN,
				config.ADMIN_LINE_USER_ID,
				{
					type: "text",
					text: `📊 สรุปเงินเดือน ${yearMonth}\n\nพนักงาน: ${count} คน\nยอดประมาณ: ฿${total.toLocaleString("th-TH")}\n\nเปิดระบบเพื่อดูรายละเอียด`,
				},
			);
		}
	},
);
