/* ─── BackupPanel — Backup Firestore → GitHub (admin) ─────────────
   - แสดงสถานะ backup ล่าสุด (success/fail · timestamp · ขนาด · จำนวน docs)
   - ปุ่ม "Backup ตอนนี้" → เรียก Cloud Function triggerFirestoreBackupNow
   - คำแนะนำการ setup ครั้งแรก (token + repo)                              */

import {
  AlertTriangle as IconAlert,
  Check as IconCheck,
  DatabaseBackup as IconDB,
  ExternalLink as IconLink,
  RefreshCw as IconRefresh,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  type BackupStatus,
  EMPTY_BACKUP_STATUS,
  subscribeBackupStatus,
  triggerBackupNow,
} from "../../firebase/backup";
import { fmtThaiDateTime } from "../../utils/dateUtils";

interface Props {
  showToast?: (msg: string) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupPanel({ showToast }: Props) {
  const [status, setStatus] = useState<BackupStatus>(EMPTY_BACKUP_STATUS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    return subscribeBackupStatus(setStatus);
  }, []);

  const isSetup = !!status.repo || !!status.path || status.lastAttemptAt > 0;
  const isConfigured = !status.reason?.includes("ยังไม่ได้ตั้ง");

  async function handleRun() {
    if (running) return;
    setRunning(true);
    try {
      const res = await triggerBackupNow();
      if (res.ok) {
        showToast?.(
          `Backup สำเร็จ · ${res.totalDocs} docs · ${formatBytes(res.sizeBytes || 0)}`,
        );
      } else {
        showToast?.(`Backup ไม่สำเร็จ: ${res.reason || res.error || "unknown"}`);
      }
    } catch (err) {
      console.error("[BackupPanel] trigger failed:", err);
      showToast?.(
        err instanceof Error ? err.message : "Backup ไม่สำเร็จ (network)",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* header */}
      <div className="mb-4 flex items-center gap-2">
        <IconDB size={22} strokeWidth={2.4} className="text-maroon" />
        <h2 className="text-xl font-extrabold text-maroon">
          Backup ข้อมูล → GitHub
        </h2>
      </div>

      {/* status card */}
      <div className="mb-4 rounded-[12px] border-[1.5px] border-gold/40 bg-white overflow-hidden">
        <div className="px-4 py-2.5 bg-gold-pale text-maroon text-sm font-extrabold border-b border-gold/30">
          สถานะ Backup ล่าสุด
        </div>
        <div className="p-4 space-y-2.5 text-sm">
          {!isSetup ? (
            <div className="text-txt-soft italic">
              ยังไม่เคยรัน backup — กดปุ่ม "Backup ตอนนี้" ด้านล่างเพื่อทดสอบ
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {status.ok ? (
                  <IconCheck size={16} className="text-green shrink-0" />
                ) : (
                  <IconAlert size={16} className="text-red shrink-0" />
                )}
                <span
                  className={`font-bold ${status.ok ? "text-green" : "text-red"}`}
                >
                  {status.ok ? "สำเร็จ" : "ไม่สำเร็จ"}
                </span>
                <span className="text-txt-soft ml-2 text-xs">
                  ({status.triggeredBy || "—"})
                </span>
              </div>

              {status.lastSuccessAt > 0 && (
                <div className="text-txt-mid">
                  <span className="text-txt-soft">Backup สำเร็จล่าสุด: </span>
                  <b>{fmtThaiDateTime(status.lastSuccessAt)}</b>
                </div>
              )}
              {status.lastAttemptAt > 0 && !status.ok && (
                <div className="text-txt-mid">
                  <span className="text-txt-soft">ลองล่าสุด: </span>
                  <b>{fmtThaiDateTime(status.lastAttemptAt)}</b>
                </div>
              )}

              {status.ok && status.stored && (
                <>
                  <div className="text-txt-mid">
                    <span className="text-txt-soft">ไฟล์: </span>
                    <code className="text-xs bg-cream px-1.5 py-0.5 rounded">
                      {status.path}
                    </code>
                  </div>
                  <div className="text-txt-mid">
                    <span className="text-txt-soft">จำนวน docs: </span>
                    <b>{status.totalDocs.toLocaleString()}</b>
                    <span className="text-txt-soft ml-3">ขนาด: </span>
                    <b>{formatBytes(status.sizeBytes)}</b>
                  </div>
                  {status.repo && (
                    <a
                      href={`https://github.com/${status.repo}/tree/${status.branch || "main"}/backups`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-maroon font-semibold text-xs hover:underline"
                    >
                      ดู backup history บน GitHub
                      <IconLink size={11} strokeWidth={2.5} />
                    </a>
                  )}
                </>
              )}

              {(status.reason || status.error) && !status.ok && (
                <div className="mt-2 p-2.5 bg-red-lt/40 rounded-[8px] border border-red/30 text-xs text-red">
                  {status.reason || status.error}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* run button */}
      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="w-full px-4 py-3 rounded-[12px] bg-maroon text-white font-extrabold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <IconRefresh
          size={16}
          strokeWidth={2.5}
          className={running ? "animate-spin" : ""}
        />
        {running ? "กำลัง Backup..." : "Backup ตอนนี้"}
      </button>

      {/* schedule + setup info */}
      <div className="mt-4 p-3 rounded-[10px] bg-cream/60 border border-bdr/60 text-xs text-txt-mid leading-relaxed">
        <div className="font-bold text-maroon mb-1.5">📅 รอบ backup อัตโนมัติ</div>
        <div className="mb-2.5">
          ทุกวัน <b>อาทิตย์ ตี 3</b> (Asia/Bangkok) — Cloud Function รันเอง
          ไม่ต้องกด
        </div>

        {!isConfigured && (
          <>
            <div className="font-bold text-red mb-1.5 mt-3">
              ⚠️ ยังไม่ได้ตั้งค่า — ทำตาม 3 ขั้นตอนนี้ก่อน:
            </div>
            <ol className="list-decimal list-outside pl-5 space-y-1.5">
              <li>
                สร้าง <b>GitHub repo ส่วนตัว</b> (Private!) เช่น{" "}
                <code className="bg-white px-1 rounded">
                  petchmukda-firestore-backup
                </code>
              </li>
              <li>
                สร้าง <b>Personal Access Token</b> ที่ GitHub (Settings →
                Developer settings → Tokens) · scope:{" "}
                <code className="bg-white px-1 rounded">
                  contents: write
                </code>{" "}
                ของ repo นั้น
              </li>
              <li>
                ใน Firestore <code className="bg-white px-1 rounded">/config/secrets</code>{" "}
                เพิ่ม 2 field:
                <ul className="list-disc list-outside pl-5 mt-1 space-y-0.5">
                  <li>
                    <code className="bg-white px-1 rounded">GITHUB_BACKUP_TOKEN</code>{" "}
                    = token จากข้อ 2
                  </li>
                  <li>
                    <code className="bg-white px-1 rounded">GITHUB_BACKUP_REPO</code>{" "}
                    = <code className="bg-white px-1 rounded">owner/repo</code>{" "}
                    (เช่น{" "}
                    <code className="bg-white px-1 rounded">
                      nukoolkps-hub/petchmukda-firestore-backup
                    </code>
                    )
                  </li>
                </ul>
              </li>
            </ol>
          </>
        )}

        <div className="font-bold text-maroon mt-3 mb-1">🔒 ปลอดภัยอย่างไร</div>
        <ul className="list-disc list-outside pl-5 space-y-0.5">
          <li>Backup ไม่รวม <code>config/secrets</code> (LINE token, API key)</li>
          <li>Repo ต้องตั้ง Private — ข้อมูลพนักงาน/บัญชี/เงินเดือนอยู่ในนั้น</li>
          <li>เก็บไว้ที่ GitHub = นอก Google ecosystem (Microsoft owned)</li>
        </ul>
      </div>
    </div>
  );
}
