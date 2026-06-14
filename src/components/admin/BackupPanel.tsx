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

function formatTrigger(raw: string): string {
  if (!raw) return "—";
  if (raw === "scheduled") return "อัตโนมัติ · รอบประจำสัปดาห์";
  if (raw.startsWith("manual:")) return "เริ่มเองโดย admin";
  return raw;
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
        <div className="p-4 text-sm">
          {!isSetup ? (
            <div className="text-txt-soft italic text-center py-2">
              ยังไม่เคยรัน backup — กดปุ่ม "Backup ตอนนี้" ด้านล่างเพื่อทดสอบ
            </div>
          ) : (
            <>
              {/* ── header row: status badge ซ้าย · datetime ขวา ── */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${status.ok ? "bg-green/15" : "bg-red/15"}`}
                >
                  {status.ok ? (
                    <IconCheck
                      size={20}
                      className="text-green"
                      strokeWidth={2.6}
                    />
                  ) : (
                    <IconAlert
                      size={20}
                      className="text-red"
                      strokeWidth={2.6}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-extrabold text-base ${status.ok ? "text-green" : "text-red"}`}
                  >
                    {status.ok ? "สำเร็จ" : "ไม่สำเร็จ"}
                  </div>
                  <div className="text-[11px] text-txt-soft">
                    {formatTrigger(status.triggeredBy)}
                  </div>
                </div>
                {(status.lastSuccessAt > 0 || status.lastAttemptAt > 0) && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-txt-soft font-semibold">
                      เมื่อ
                    </div>
                    <div className="text-xs font-bold text-txt-mid">
                      {fmtThaiDateTime(
                        status.ok ? status.lastSuccessAt : status.lastAttemptAt,
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── stats grid (success only) ── */}
              {status.ok && status.stored && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2.5 rounded-[8px] bg-cream/60 border border-bdr/40 text-center">
                      <div className="text-[10px] text-txt-soft font-semibold">
                        จำนวน docs
                      </div>
                      <div className="text-base font-extrabold text-maroon mt-0.5">
                        {status.totalDocs.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-[8px] bg-cream/60 border border-bdr/40 text-center">
                      <div className="text-[10px] text-txt-soft font-semibold">
                        ขนาดไฟล์
                      </div>
                      <div className="text-base font-extrabold text-maroon mt-0.5">
                        {formatBytes(status.sizeBytes)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 text-xs text-txt-mid">
                    <span className="text-txt-soft">ไฟล์ </span>
                    <code className="text-[11px] bg-cream px-1.5 py-0.5 rounded break-all">
                      {status.path}
                    </code>
                  </div>

                  {status.repo && (
                    <a
                      href={`https://github.com/${status.repo}/tree/${status.branch || "main"}/backups`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-maroon/5 border border-maroon/20 text-maroon font-bold text-xs hover:bg-maroon/10 transition-colors"
                    >
                      ดู backup history บน GitHub
                      <IconLink size={11} strokeWidth={2.5} />
                    </a>
                  )}
                </>
              )}

              {(status.reason || status.error) && !status.ok && (
                <div className="p-2.5 bg-red-lt/40 rounded-[8px] border border-red/30 text-xs text-red">
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
