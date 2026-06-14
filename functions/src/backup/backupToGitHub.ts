/**
 * backupToGitHub — backup Firestore collections เป็นไฟล์ JSON ส่งไปเก็บ GitHub
 *
 * - scheduled: รันทุกอาทิตย์ ตี 3 (Sunday 03:00 Asia/Bangkok)
 * - callable:  admin trigger เอง (testFunctionFromAdmin UI)
 *
 * Token + repo path เก็บใน /config/secrets:
 *   GITHUB_BACKUP_TOKEN  = PAT ของ GitHub (scope: contents:write)
 *   GITHUB_BACKUP_REPO   = "owner/repo" (เช่น "nukoolkps-hub/petchmukda-firestore-backup")
 *   GITHUB_BACKUP_BRANCH = "main" (default · optional)
 *
 * ผลลัพธ์: 1 ไฟล์ JSON ต่อรอบ backup ใน path `backups/{YYYY-MM-DD_HH-mm-ss}.json`
 *
 * Status (success/fail + timestamp + รายละเอียด) เขียนลง /config/backupStatus
 * เพื่อให้ admin UI แสดงผลได้
 */

import type { Firestore } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAppFirestore } from "../helpers/config.js";

/** อ่าน config/secrets · trim ทั้ง key + value (กัน trailing space ใน console) */
async function readSecrets(): Promise<Record<string, string>> {
	const doc = await getAppFirestore().doc("config/secrets").get();
	const raw = doc.data() || {};
	const cleaned: Record<string, string> = {};
	for (const [k, v] of Object.entries(raw)) {
		if (typeof v === "string") cleaned[k.trim()] = v.trim();
	}
	return cleaned;
}

// collections ที่ backup
// ไม่รวม: config/secrets (sensitive) · dailySummarySent (transient) · recentTips (auto-clean)
const TOP_LEVEL_COLLECTIONS = [
	"employees",
	"leaves",
	"advances",
	"roles",
	"payrollConfirms",
	"poolSnapshots",
	"poolAdjustments",
	"duties",
	"dutyAssignmentsToday",
	"employeeLoans",
	"certCounters",
];

// config docs ที่ backup (ไม่รวม secrets!)
const CONFIG_DOCS = [
	"goldPrice",
	"laborCost",
	"blockCost",
	"loyaltyPoints",
	"notifications",
	"storeCalendar",
];

interface BackupResult {
	ok: boolean;
	stored?: boolean;
	path?: string;
	repo?: string;
	totalDocs?: number;
	sizeBytes?: number;
	reason?: string;
	error?: string;
}

async function dumpFirestore(db: Firestore): Promise<{
	exportedAt: string;
	collections: Record<string, unknown[]>;
	totalDocs: number;
}> {
	const collections: Record<string, unknown[]> = {};
	let totalDocs = 0;

	// top-level
	for (const name of TOP_LEVEL_COLLECTIONS) {
		const snap = await db.collection(name).get();
		collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
		totalDocs += snap.size;
	}

	// config (ทีละ doc — ไม่ใช้ .listDocuments() เพราะอยากเลือกเฉพาะที่ปลอดภัย)
	const cfg: Record<string, unknown> = {};
	for (const docId of CONFIG_DOCS) {
		const s = await db.doc(`config/${docId}`).get();
		if (s.exists) {
			cfg[docId] = s.data();
			totalDocs++;
		}
	}
	collections.config = [cfg];

	// salaries — ใช้ collectionGroup ดึง months subcollection ทั้งหมด
	const monthsSnap = await db.collectionGroup("months").get();
	collections.salaries_months = monthsSnap.docs.map((d) => ({
		// path เก็บไว้เพื่อ restore ภายหลัง (รู้ว่าอยู่ของ employee ไหน)
		path: d.ref.path,
		id: d.id,
		...d.data(),
	}));
	totalDocs += monthsSnap.size;

	return {
		exportedAt: new Date().toISOString(),
		collections,
		totalDocs,
	};
}

function timestampPath(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const hms = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
	return `backups/${ymd}_${hms}.json`;
}

async function pushToGitHub(
	owner: string,
	repo: string,
	branch: string,
	path: string,
	content: string,
	token: string,
	commitMessage: string,
): Promise<{ ok: boolean; status: number; body?: string }> {
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
	const base64 = Buffer.from(content, "utf-8").toString("base64");
	const res = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "petchmukda-backup-bot",
		},
		body: JSON.stringify({
			message: commitMessage,
			content: base64,
			branch,
		}),
	});
	if (!res.ok) {
		const text = await res.text();
		return { ok: false, status: res.status, body: text };
	}
	return { ok: true, status: res.status };
}

async function runBackup(triggeredBy: string): Promise<BackupResult> {
	const db = getAppFirestore();
	const config = await readSecrets();
	const token = config.GITHUB_BACKUP_TOKEN || "";
	const repoRaw = config.GITHUB_BACKUP_REPO || "";
	const branch = config.GITHUB_BACKUP_BRANCH || "main";

	if (!token || !repoRaw) {
		const reason =
			"GITHUB_BACKUP_TOKEN และ/หรือ GITHUB_BACKUP_REPO ยังไม่ได้ตั้งใน /config/secrets";
		await db.doc("config/backupStatus").set(
			{
				ok: false,
				stored: false,
				reason,
				lastAttemptAt: Date.now(),
				triggeredBy,
			},
			{ merge: true },
		);
		return { ok: false, stored: false, reason };
	}

	const [owner, repo] = repoRaw.split("/");
	if (!owner || !repo) {
		const reason = `GITHUB_BACKUP_REPO ต้องอยู่ในรูป owner/repo (ได้: "${repoRaw}")`;
		await db.doc("config/backupStatus").set(
			{
				ok: false,
				stored: false,
				reason,
				lastAttemptAt: Date.now(),
				triggeredBy,
			},
			{ merge: true },
		);
		return { ok: false, stored: false, reason };
	}

	try {
		const dump = await dumpFirestore(db);
		const content = JSON.stringify(dump, null, 2);
		const sizeBytes = Buffer.byteLength(content, "utf-8");
		const path = timestampPath();
		const commitMessage = `backup: ${dump.totalDocs} docs · ${(sizeBytes / 1024).toFixed(1)}KB · trigger=${triggeredBy}`;

		const res = await pushToGitHub(
			owner,
			repo,
			branch,
			path,
			content,
			token,
			commitMessage,
		);

		if (!res.ok) {
			const error = `GitHub API ${res.status}: ${res.body || "(no body)"}`;
			await db.doc("config/backupStatus").set(
				{
					ok: false,
					stored: false,
					error,
					lastAttemptAt: Date.now(),
					triggeredBy,
				},
				{ merge: true },
			);
			return { ok: false, stored: false, error };
		}

		await db.doc("config/backupStatus").set(
			{
				ok: true,
				stored: true,
				path,
				repo: `${owner}/${repo}`,
				branch,
				totalDocs: dump.totalDocs,
				sizeBytes,
				lastSuccessAt: Date.now(),
				lastAttemptAt: Date.now(),
				triggeredBy,
				error: "",
				reason: "",
			},
			{ merge: true },
		);
		return {
			ok: true,
			stored: true,
			path,
			repo: `${owner}/${repo}`,
			totalDocs: dump.totalDocs,
			sizeBytes,
		};
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await db.doc("config/backupStatus").set(
			{
				ok: false,
				stored: false,
				error,
				lastAttemptAt: Date.now(),
				triggeredBy,
			},
			{ merge: true },
		);
		return { ok: false, stored: false, error };
	}
}

/** scheduled — รันทุกอาทิตย์ ตี 3 (Asia/Bangkok) */
export const backupFirestoreScheduled = onSchedule(
	{ schedule: "0 3 * * 0", timeZone: "Asia/Bangkok" },
	async () => {
		await runBackup("scheduled");
	},
);

/** callable — admin trigger manual */
export const triggerFirestoreBackupNow = onCall(async (req) => {
	const isAdmin = req.auth?.token?.admin === true;
	if (!isAdmin) {
		throw new Error("PERMISSION_DENIED: admin only");
	}
	return runBackup(`manual:${req.auth?.uid || "unknown"}`);
});
