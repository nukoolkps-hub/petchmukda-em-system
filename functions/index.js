/**
 * ════════════════════════════════════════════════════════════════
 *  Firebase Cloud Functions — ระบบพนักงานห้างเพชรทองมุกดา
 * ════════════════════════════════════════════════════════════════
 *
 *  Functions:
 *  • onLeaveCreated      → เมื่อมีคนลาใหม่ → คำนวณ pool ใหม่ + แจ้ง LINE
 *  • onAdvanceCreated    → เมื่อมีคำขอเบิกใหม่ → แจ้ง admin LINE
 *  • monthlyPayrollSummary → ตอนสิ้นเดือน → สรุปเงินเดือน + ส่ง email
 *  • cleanupOldData      → ลบข้อมูลเก่า (เช่น advances ที่ approved 6 เดือนแล้ว)
 *
 *  Setup:
 *  1) ติดตั้ง CLI: npm install -g firebase-tools
 *  2) Login: firebase login
 *  3) ใน root project: firebase init functions
 *  4) เลือก: TypeScript หรือ JavaScript (ที่นี่ใช้ JS ESM)
 *  5) ใน functions/: npm install
 *  6) Deploy: firebase deploy --only functions
 *
 *  Pricing:
 *  • Free tier: 2M invocations/month, 400k GB-seconds compute
 *  • พอใช้สำหรับระบบเล็ก (พนักงาน <50 คน)
 * ════════════════════════════════════════════════════════════════
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/* ════════════════════════════════════════════════════════════════
 * 1. onAdvanceCreated — แจ้ง admin เมื่อมีคำขอเบิกใหม่
 * ════════════════════════════════════════════════════════════════
 *  Trigger: มี document ใหม่ใน /advances
 *  Action:  ส่ง LINE Push ไปหา ADMIN_LINE_USER_ID
 *
 *  หมายเหตุ: ทำซ้ำซ้อนกับ /api/advance-request ใน backend-server.js
 *  เลือกอันใดอันหนึ่ง — แนะนำใช้ Cloud Function เพราะ:
 *  ✅ ไม่ต้อง deploy backend (Railway/Render)
 *  ✅ Auto-scale, ไม่มี cold start สำหรับ light traffic
 *  ✅ Built-in monitoring + retry
 */
export const onAdvanceCreated = onDocumentCreated(
  "advances/{advanceId}",
  async (event) => {
    const advance = event.data?.data();
    if(!advance) return;

    console.log(`[onAdvanceCreated] New advance: ${event.params.advanceId}`);

    // ดึง LINE token จาก Firestore config (เก็บไว้ใน /config/secrets)
    const configDoc = await db.doc("config/secrets").get();
    const config = configDoc.data() || {};

    const lineToken = config.LINE_CHANNEL_ACCESS_TOKEN;
    const adminLineId = config.ADMIN_LINE_USER_ID;
    if(!lineToken || !adminLineId){
      console.warn("LINE config not set in /config/secrets");
      return;
    }

    // ส่ง Flex Message
    const flexMessage = {
      type: "flex",
      altText: `💸 คำขอเบิก ฿${advance.amount} — ${advance.empName}`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "💸 คำขอเบิกล่วงหน้า", weight: "bold", size: "md", color: "#7B1C1C" },
            { type: "separator", margin: "md" },
            { type: "text", text: advance.empName, weight: "bold", size: "lg", margin: "md" },
            { type: "text", text: `จำนวน: ฿${advance.amount.toLocaleString("th-TH")}`, size: "sm", margin: "sm" },
            { type: "text", text: `เหตุผล: ${advance.reason}`, size: "sm", wrap: true, color: "#7A5C3A" },
          ],
        },
      },
    };

    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lineToken}`,
      },
      body: JSON.stringify({
        to: adminLineId,
        messages: [flexMessage],
      }),
    });
  }
);

/* ════════════════════════════════════════════════════════════════
 * 2. onLeaveCreated — Log + recompute statistics
 * ════════════════════════════════════════════════════════════════
 *  Trigger: มี leave ใหม่
 *  Action:  อัพเดต /stats/{ym}/leaveCount
 */
export const onLeaveCreated = onDocumentCreated(
  "leaves/{leaveId}",
  async (event) => {
    const leave = event.data?.data();
    if(!leave?.start) return;

    const ym = leave.start.substring(0, 7); // "2026-04"
    const statsRef = db.doc(`stats/${ym}`);

    await db.runTransaction(async (tx) => {
      const stats = await tx.get(statsRef);
      const current = stats.data()?.leaveCount || 0;
      tx.set(statsRef, { leaveCount: current + 1 }, { merge: true });
    });

    console.log(`[onLeaveCreated] Updated stats for ${ym}`);
  }
);

/* ════════════════════════════════════════════════════════════════
 * 3. monthlyPayrollSummary — สรุปเงินเดือนตอนสิ้นเดือน
 * ════════════════════════════════════════════════════════════════
 *  Schedule: รันทุกวันที่ 28 เวลา 23:00 (Asia/Bangkok)
 *  Action:   สรุปยอดเงินเดือน + ส่ง LINE message ไปหา admin
 */
export const monthlyPayrollSummary = onSchedule(
  {
    schedule: "0 23 28 * *",
    timeZone: "Asia/Bangkok",
  },
  async () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    console.log(`[monthlyPayrollSummary] Running for ${ym}`);

    // ดึง salaries ของเดือนนี้ทั้งหมด
    const empsSnap = await db.collection("employees").get();
    let total = 0, count = 0;

    for(const emp of empsSnap.docs){
      const salDoc = await db.doc(`salaries/${emp.id}/months/${ym}`).get();
      if(salDoc.exists){
        const data = salDoc.data();
        // simplified: ใช้ base + pieces × rate (ไม่รวม pool ที่ซับซ้อน)
        const base = data.base || 0;
        const pieces = (data.pieces || 0) + (data.piecesNormal || 0) + (data.piecesSpecial || 0);
        total += base + pieces * 50; // approximate
        count++;
      }
    }

    // ส่ง LINE
    const configDoc = await db.doc("config/secrets").get();
    const config = configDoc.data() || {};
    if(config.ADMIN_LINE_USER_ID && config.LINE_CHANNEL_ACCESS_TOKEN){
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: config.ADMIN_LINE_USER_ID,
          messages: [{
            type: "text",
            text: `📊 สรุปเงินเดือน ${ym}\n\nพนักงาน: ${count} คน\nยอดประมาณ: ฿${total.toLocaleString("th-TH")}\n\nเปิดระบบเพื่อดูรายละเอียด`,
          }],
        }),
      });
    }
  }
);

/* ════════════════════════════════════════════════════════════════
 * 4. cleanupOldAdvances — ลบ advances ที่ approved/rejected เกิน 6 เดือน
 * ════════════════════════════════════════════════════════════════
 *  Schedule: ทุกวันที่ 1 ตอน 02:00
 */
export const cleanupOldAdvances = onSchedule(
  {
    schedule: "0 2 1 * *",
    timeZone: "Asia/Bangkok",
  },
  async () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);

    const snap = await db.collection("advances")
      .where("status", "in", ["approved", "rejected"])
      .where("submittedAt", "<", cutoff.toISOString())
      .get();

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[cleanupOldAdvances] Deleted ${snap.size} old advances`);
  }
);
