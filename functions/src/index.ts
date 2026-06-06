/**
 * Firebase Cloud Functions — ห้างเพชรทองมุกดา ระบบพนักงาน
 * Barrel file: re-exports all functions so Firebase discovers them.
 */

import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
// Gen 2 Cloud Functions default = compute SA — แต่ระบบนี้แชร์ Google Calendar
// + IAM permissions ทั้งหมดให้กับ appspot SA ไว้แล้ว ตั้ง runtime SA ให้ตรง
// กับที่แชร์ไว้ ไม่ต้องไปแชร์ permissions อีกชุดให้ compute SA
setGlobalOptions({
	region: "asia-southeast1",
	serviceAccount: "petchmukda-bot@appspot.gserviceaccount.com",
});

export { cleanupOldAdvances } from "./advance/cleanupOldAdvances.js";
export { processAdvanceNotifications } from "./advance/processAdvanceNotifications.js";
// Advance requests
export { notifyAdvanceRequest } from "./advance/notifyRequest.js";
// Firestore triggers are not exported because this project's Firestore
// database is in asia-southeast3, which is not currently supported by
// Cloud Functions/Eventarc.

// Authentication
export { bootstrapAdmin } from "./auth/bootstrapAdmin.js";
export { devAuth } from "./auth/devAuth.js";
export { lineAuth } from "./auth/lineAuth.js";
export { seedLineConfigFromEnv } from "./auth/seedLineConfigFromEnv.js";
export { setAdmin } from "./auth/setAdmin.js";

// LINE webhook
export { lineWebhook } from "./line/webhook.js";

// Daily summary — ภารกิจ + คนหยุด + เคล็ดลับ → ส่งเข้า LINE 07:30 ทุกวัน
// (manual test: Cloud Scheduler "Force run" หรือ LINE command "ทดสอบแจ้งเตือน")
export { sendDailySummary } from "./dailySummary/sendDailySummary.js";

// Maintenance
export { cleanupOldSlips } from "./maintenance/cleanupOldSlips.js";
export { cleanupOldTips } from "./maintenance/cleanupOldTips.js";
