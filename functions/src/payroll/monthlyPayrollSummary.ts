/**
 * monthlyPayrollSummary — สรุปเงินเดือนตอนสิ้นเดือน (28th, 23:00 ICT)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getLineConfig } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";

export const monthlyPayrollSummary = onSchedule(
  { schedule: "0 23 28 * *", timeZone: "Asia/Bangkok" },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    console.log(`[monthlyPayrollSummary] Running for ${ym}`);

    const empsSnap = await db.collection("employees").get();
    let total = 0;
    let count = 0;

    for (const emp of empsSnap.docs) {
      const salDoc = await db.doc(`salaries/${emp.id}/months/${ym}`).get();
      if (salDoc.exists) {
        const data = salDoc.data()!;
        const base = (data.base as number) || 0;
        const pieces =
          ((data.pieces as number) || 0) +
          ((data.piecesNormal as number) || 0) +
          ((data.piecesSpecial as number) || 0);
        total += base + pieces * 50;
        count++;
      }
    }

    const config = await getLineConfig();
    if (config.ADMIN_LINE_USER_ID && config.LINE_CHANNEL_ACCESS_TOKEN) {
      await pushLineMessage(config.LINE_CHANNEL_ACCESS_TOKEN, config.ADMIN_LINE_USER_ID, {
        type: "text",
        text: `📊 สรุปเงินเดือน ${ym}\n\nพนักงาน: ${count} คน\nยอดประมาณ: ฿${total.toLocaleString("th-TH")}\n\nเปิดระบบเพื่อดูรายละเอียด`,
      });
    }
  },
);
