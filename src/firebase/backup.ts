/* ─── Firestore Backup → GitHub ─────────────────────────────────
   subscribe /config/backupStatus + callable trigger manual
   Cloud Function: triggerFirestoreBackupNow (admin only)              */

import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./config";

export interface BackupStatus {
  ok: boolean;
  stored: boolean;
  path: string;
  repo: string;
  branch: string;
  totalDocs: number;
  sizeBytes: number;
  reason: string;
  error: string;
  lastSuccessAt: number;
  lastAttemptAt: number;
  triggeredBy: string;
}

export const EMPTY_BACKUP_STATUS: BackupStatus = {
  ok: false,
  stored: false,
  path: "",
  repo: "",
  branch: "",
  totalDocs: 0,
  sizeBytes: 0,
  reason: "",
  error: "",
  lastSuccessAt: 0,
  lastAttemptAt: 0,
  triggeredBy: "",
};

export function subscribeBackupStatus(
  onChange: (s: BackupStatus) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, "config/backupStatus"),
    (snap) => {
      const data = snap.exists()
        ? (snap.data() as Partial<BackupStatus>)
        : {};
      onChange({
        ok: data.ok === true,
        stored: data.stored === true,
        path: typeof data.path === "string" ? data.path : "",
        repo: typeof data.repo === "string" ? data.repo : "",
        branch: typeof data.branch === "string" ? data.branch : "",
        totalDocs: typeof data.totalDocs === "number" ? data.totalDocs : 0,
        sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : 0,
        reason: typeof data.reason === "string" ? data.reason : "",
        error: typeof data.error === "string" ? data.error : "",
        lastSuccessAt:
          typeof data.lastSuccessAt === "number" ? data.lastSuccessAt : 0,
        lastAttemptAt:
          typeof data.lastAttemptAt === "number" ? data.lastAttemptAt : 0,
        triggeredBy:
          typeof data.triggeredBy === "string" ? data.triggeredBy : "",
      });
    },
    (err) => {
      console.error("[Backup] subscribe error:", err);
      onError?.(err);
    },
  );
}

export interface BackupResult {
  ok: boolean;
  stored?: boolean;
  path?: string;
  repo?: string;
  totalDocs?: number;
  sizeBytes?: number;
  reason?: string;
  error?: string;
}

export async function triggerBackupNow(): Promise<BackupResult> {
  const callable = httpsCallable<unknown, BackupResult>(
    functions,
    "triggerFirestoreBackupNow",
  );
  const res = await callable({});
  return res.data;
}
