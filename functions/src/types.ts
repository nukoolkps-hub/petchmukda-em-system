/**
 * Shared type definitions — ระบบพนักงานห้างเพชรทองมุกดา
 */

/* ─── LINE config stored in Firestore /config/secrets ─────────── */
export interface LineConfig {
	LINE_CHANNEL_ACCESS_TOKEN?: string;
	ADMIN_LINE_USER_ID?: string;
	LINE_LOGIN_CHANNEL_ID?: string;
	LINE_LOGIN_CHANNEL_SECRET?: string;
}

/* ─── onCall payload types ────────────────────────────────────── */
export interface AdvanceRequestData {
	empName: string;
	amount: number;
	reason?: string;
	month?: string;
	bank?: string;
	bankAcc?: string;
	submittedAt?: string;
	requestId?: string;
}

export interface AdvanceApprovedData {
	empLineUserId: string;
	empName: string;
	amount: number;
	reason?: string;
	month?: string;
	slipImg?: string;
	approvedAt?: string;
	requestId?: string;
}

export interface AdvanceRejectedData {
	empLineUserId: string;
	empName: string;
	amount: number;
	reason?: string;
	month?: string;
	rejectedAt?: string;
	requestId?: string;
}

export interface LineAuthData {
	code: string;
	redirectUri: string;
}

export interface SetAdminData {
	uid: string;
	isAdmin: boolean;
}

/* ─── LINE Message types (subset used in this project) ────────── */
export interface LineTextMessage {
	type: "text";
	text: string;
}

export interface LineFlexMessage {
	type: "flex";
	altText: string;
	contents: Record<string, unknown>;
}

export interface LineImageMessage {
	type: "image";
	originalContentUrl: string;
	previewImageUrl: string;
}

export type LineMessage = LineTextMessage | LineFlexMessage | LineImageMessage;
