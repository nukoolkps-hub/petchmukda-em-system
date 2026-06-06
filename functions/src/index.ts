/**
 * Firebase Cloud Functions — ห้างเพชรทองมุกดา ระบบพนักงาน
 * Barrel file: re-exports all functions so Firebase discovers them.
 */

import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-southeast1" });

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
export {
	previewDailySummary,
	sendDailySummary,
	sendDailySummaryNow,
} from "./dailySummary/sendDailySummary.js";

// Maintenance
export { cleanupOldSlips } from "./maintenance/cleanupOldSlips.js";
