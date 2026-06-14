/* ─── WipeDataPanel — One-time start-fresh utility ───────────────
   ลบข้อมูลพนักงาน + transactional data ก่อนใช้จริง · เก็บ config/roles/duties

   2-step confirm:
   1. กดปุ่ม "ล้างข้อมูลทั้งหมด" → modal เปิด
   2. พิมพ์ "ล้างข้อมูล" ในช่อง input + กดยืนยัน → call Cloud Function     */

import {
  AlertTriangle as IconAlert,
  Check as IconCheck,
  Eraser as IconEraser,
  ShieldCheck as IconShield,
  Trash2 as IconTrash,
  X as IconX,
} from "lucide-react";
import { useState } from "react";
import { wipeTestData } from "../../firebase/wipeTestData";

interface Props {
  showToast?: (msg: string) => void;
}

const COLLECTIONS_TO_DELETE: { name: string; label: string }[] = [
  { name: "employees", label: "พนักงาน + สลิปเงินเดือนทุกเดือน" },
  { name: "leaves", label: "ใบลาทั้งหมด" },
  { name: "advances", label: "เบิกเงินล่วงหน้า" },
  { name: "employeeLoans", label: "เงินกู้" },
  { name: "payrollConfirms", label: "ยืนยันยอดรอบเงินเดือน" },
  { name: "poolSnapshots", label: "Pool snapshots (peer data)" },
  { name: "poolAdjustments", label: "Pool adjustments" },
  { name: "dutyAssignmentsToday", label: "Cache เวรประจำวัน" },
  { name: "certCounters", label: "ตัวนับใบรับรอง" },
  { name: "recentTips", label: "เคล็ดลับ Claude (ที่ส่งไปแล้ว)" },
  { name: "dailySummarySent", label: "Log สรุปประจำวัน" },
];

const COLLECTIONS_KEPT: string[] = [
  "/config/* (goldPrice, laborCost, blockCost, loyaltyPoints, secrets, ฯลฯ)",
  "/roles (ตำแหน่งทั้งหมด)",
  "/duties (ตารางหน้าที่ — pool อาจอ้างถึง employee ที่ลบไปแล้ว · ต้องแก้ pool ใหม่หลังเพิ่มพนักงานจริง)",
];

const CONFIRM_TOKEN = "ล้างข้อมูล";

export default function WipeDataPanel({ showToast }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    stats: Record<string, number>;
    totalDeleted: number;
  } | null>(null);

  const canConfirm = typed.trim() === CONFIRM_TOKEN;

  async function handleConfirm() {
    if (!canConfirm || running) return;
    setRunning(true);
    try {
      const res = await wipeTestData();
      if (res.ok) {
        setResult({ stats: res.stats, totalDeleted: res.totalDeleted });
        showToast?.(`ล้างข้อมูลสำเร็จ · ลบทั้งหมด ${res.totalDeleted} docs`);
        setShowModal(false);
        setTyped("");
      } else {
        showToast?.("ล้างข้อมูลไม่สำเร็จ");
      }
    } catch (err) {
      console.error("[WipeDataPanel] wipe failed:", err);
      showToast?.(
        err instanceof Error ? err.message : "ล้างข้อมูลไม่สำเร็จ (network)",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* header */}
      <div className="mb-4 flex items-center gap-2">
        <IconEraser size={22} strokeWidth={2.4} className="text-maroon" />
        <h2 className="text-xl font-extrabold text-maroon">
          ล้างข้อมูล (Start Fresh)
        </h2>
      </div>

      {/* warning */}
      <div className="mb-4 p-3.5 rounded-[10px] bg-red-lt/40 border-[1.5px] border-red/40 flex gap-2.5">
        <IconAlert
          size={18}
          strokeWidth={2.5}
          className="text-red shrink-0 mt-0.5"
        />
        <div className="text-sm text-red font-semibold leading-relaxed">
          ปุ่มนี้ลบ <b>ข้อมูลพนักงาน + transactional data ทั้งหมด</b>{" "}
          เพื่อเริ่มใช้จริงครั้งแรก ·{" "}
          <b>ไม่สามารถ undo ได้</b> · แนะนำให้กด "Backup ตอนนี้"{" "}
          ในหน้า Backup ก่อนเสมอ
        </div>
      </div>

      {/* will delete */}
      <div className="mb-4 rounded-[12px] border-[1.5px] border-red/30 bg-white overflow-hidden">
        <div className="px-3.5 py-2 bg-red/10 text-red text-sm font-extrabold inline-flex items-center gap-1.5 w-full">
          <IconTrash size={14} strokeWidth={2.5} />
          ข้อมูลที่จะถูกลบ
        </div>
        <ul className="p-3.5 space-y-1.5 text-sm text-txt">
          {COLLECTIONS_TO_DELETE.map((c) => (
            <li key={c.name} className="flex items-start gap-2 leading-relaxed">
              <span className="mt-[9px] w-2 h-2 rounded-full bg-red/60 shrink-0" />
              <span>
                <code className="text-[11px] bg-cream px-1 rounded">
                  {c.name}
                </code>{" "}
                — {c.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* will keep */}
      <div className="mb-4 rounded-[12px] border-[1.5px] border-green/30 bg-white overflow-hidden">
        <div className="px-3.5 py-2 bg-green/10 text-green text-sm font-extrabold inline-flex items-center gap-1.5 w-full">
          <IconShield size={14} strokeWidth={2.5} />
          ข้อมูลที่จะ "เก็บไว้"
        </div>
        <ul className="p-3.5 space-y-1.5 text-sm text-txt">
          {COLLECTIONS_KEPT.map((c, i) => (
            <li
              key={`keep-${i}`}
              className="flex items-start gap-2 leading-relaxed"
            >
              <span className="mt-[9px] w-2 h-2 rounded-full bg-green/60 shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* run button */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={running}
        className="w-full px-4 py-3 rounded-[12px] bg-red text-white font-extrabold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <IconTrash size={16} strokeWidth={2.5} />
        ล้างข้อมูลทั้งหมด
      </button>

      {/* result */}
      {result && (
        <div className="mt-4 p-3.5 rounded-[12px] bg-green-lt/40 border-[1.5px] border-green/40">
          <div className="font-extrabold text-green mb-2 inline-flex items-center gap-1.5">
            <IconCheck size={16} strokeWidth={2.6} />
            ล้างข้อมูลสำเร็จ · ลบทั้งหมด {result.totalDeleted} docs
          </div>
          <ul className="space-y-1 text-xs text-txt">
            {Object.entries(result.stats)
              .filter(([_, count]) => count > 0)
              .map(([name, count]) => (
                <li key={name} className="flex justify-between">
                  <code className="bg-cream px-1 rounded">{name}</code>
                  <b className="text-maroon">{count.toLocaleString()}</b>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* confirm modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4"
          onClick={() => !running && setShowModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-[16px] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-red text-white flex items-center gap-2">
              <IconAlert size={18} strokeWidth={2.5} />
              <div className="font-extrabold flex-1">ยืนยันการล้างข้อมูล</div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={running}
                className="p-1 rounded hover:bg-white/15 cursor-pointer"
              >
                <IconX size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-txt leading-relaxed">
                การลบนี้ <b>ไม่สามารถ undo ได้</b> ·{" "}
                พิมพ์{" "}
                <code className="bg-cream px-1.5 py-0.5 rounded font-bold text-maroon">
                  {CONFIRM_TOKEN}
                </code>{" "}
                ในช่องด้านล่างเพื่อยืนยัน
              </div>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={running}
                placeholder={CONFIRM_TOKEN}
                autoFocus
                className="w-full px-3 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-base font-bold text-maroon text-center font-[inherit] outline-none focus:border-red"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={running}
                  className="flex-1 px-4 py-2.5 rounded-[10px] border border-bdr bg-white text-txt-mid font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform disabled:opacity-40"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm || running}
                  className="flex-1 px-4 py-2.5 rounded-[10px] bg-red text-white font-extrabold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {running ? "กำลังลบ..." : "ยืนยันล้างข้อมูล"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
