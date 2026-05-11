/**
 * Shared type definitions — ระบบพนักงานห้างเพชรทองมุกดา
 */

/* ─── LINE config stored in Firestore /config/secrets ─────────── */
export interface LineConfig {
	LINE_CHANNEL_ACCESS_TOKEN?: string;
	LINE_CHANNEL_SECRET?: string;
	ADMIN_LINE_USER_ID?: string;
	LINE_LOGIN_CHANNEL_ID?: string;
	LINE_LOGIN_CHANNEL_SECRET?: string;
}

export type ISODateString = string;
export type PayrollMonth = string;
export type RequestId = string | number;

/* ─── onCall payload types ────────────────────────────────────── */
export interface NotifyAdvanceRequestPayload {
	employeeName: string;
	amount: number;
	reason: string;
	month: PayrollMonth;
	bank?: string;
	bankAccountNumber?: string;
	submittedAt?: ISODateString;
	requestId?: RequestId;
}

export interface LineAuthPayload {
	code: string;
	redirectUri: string;
}

export interface DevAuthPayload {
	role: "employee" | "admin" | "setup";
}

export interface SetAdminPayload {
	uid: string;
	isAdmin: boolean;
}

export interface BootstrapAdminPayload {
	setupSecret: string;
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

export type LinePushMessage =
	| LineTextMessage
	| LineFlexMessage
	| LineImageMessage;
