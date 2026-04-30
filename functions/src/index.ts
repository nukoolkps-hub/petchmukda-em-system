/**
 * Firebase Cloud Functions — ระบบพนักงานห้างเพชรทองมุกดา
 * Barrel file: re-exports all functions so Firebase discovers them.
 */

import { initializeApp } from "firebase-admin/app";

initializeApp();

// Advance requests
export { notifyAdvanceRequest } from "./advance/notifyRequest.js";
export { notifyAdvanceApproved } from "./advance/notifyApproved.js";
export { notifyAdvanceRejected } from "./advance/notifyRejected.js";
export { onAdvanceCreated } from "./advance/onAdvanceCreated.js";
export { cleanupOldAdvances } from "./advance/cleanupOldAdvances.js";

// Authentication
export { lineAuth } from "./auth/lineAuth.js";
export { setAdmin } from "./auth/setAdmin.js";

// LINE webhook
export { lineWebhook } from "./line/webhook.js";

// Payroll & leave
export { onLeaveCreated } from "./payroll/onLeaveCreated.js";
export { monthlyPayrollSummary } from "./payroll/monthlyPayrollSummary.js";
