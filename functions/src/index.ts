/**
 * Firebase Cloud Functions — ห้างเพชรทองมุกดา ระบบพนักงาน
 * Barrel file: re-exports all functions so Firebase discovers them.
 */

import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
// Default SA (compute) สำหรับ function ทั่วไป — auth.createCustomToken ใช้
// signBlob ได้กับ default SA. ส่วน function ที่ต้องใช้ Google Calendar
// (sendDailySummary, lineWebhook) override เป็น appspot SA แยกเฉพาะตัว
// เพราะ user แชร์ calendar ให้ appspot SA ไว้แล้ว — กัน 1 ทาง break อีกทาง
setGlobalOptions({ region: "asia-southeast1" });

export { cleanupOldAdvances } from "./advance/cleanupOldAdvances.js";
// Advance requests
export { notifyAdvanceRequest } from "./advance/notifyRequest.js";
export { processAdvanceNotifications } from "./advance/processAdvanceNotifications.js";
// Firestore triggers are not exported because this project's Firestore
// database is in asia-southeast3, which is not currently supported by
// Cloud Functions/Eventarc.

// Authentication
export { bootstrapAdmin } from "./auth/bootstrapAdmin.js";
export { devAuth } from "./auth/devAuth.js";
export { lineAuth } from "./auth/lineAuth.js";
export { seedLineConfigFromEnv } from "./auth/seedLineConfigFromEnv.js";
export { setAdmin } from "./auth/setAdmin.js";
// Daily summary — ภารกิจ + คนหยุด + เคล็ดลับ → ส่งเข้า LINE 07:30 ทุกวัน
// (manual test: Cloud Scheduler "Force run" หรือ LINE command "ทดสอบแจ้งเตือน")
export { sendDailySummary } from "./dailySummary/sendDailySummary.js";
// LINE webhook
export { lineWebhook } from "./line/webhook.js";

// Maintenance
export { cleanupOldSlips } from "./maintenance/cleanupOldSlips.js";
export { cleanupOldTips } from "./maintenance/cleanupOldTips.js";

// Duty assignments — server-side compute เพื่อ sync admin/พนักงาน
// (ฝั่งพนักงานอ่าน employees/leaves ของเพื่อนไม่ได้ → compute ไม่ครบ)
// callable: trigger หลัง CRUD · scheduled: refresh ตอนวันเปลี่ยน
export {
	recomputeDutyAssignments,
	recomputeDutyAssignmentsDaily,
} from "./duty/recompute.js";
