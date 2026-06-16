/* ─── WipeDataPanel — Start-fresh utilities ───────────────────────
   2 mode:
   - "ล้างข้อมูลทั้งหมด" — ล้างทั้งระบบ (สำหรับเริ่มใช้จริง)
   - "ล้างข้อมูลรายคน"   — เลือกพนักงาน 1+ คน · ลบเฉพาะข้อมูลของคนนั้น

   ทั้งสอง mode ใช้ 2-step confirm: ปุ่ม → modal พิมพ์ "ล้างข้อมูล" → ยืนยัน */

import {
  AlertTriangle as IconAlert,
  Check as IconCheck,
  Eraser as IconEraser,
  History as IconHistory,
  ShieldCheck as IconShield,
  Trash2 as IconTrash,
  UserMinus as IconUserMinus,
  X as IconX,
} from "lucide-react";
import { useState } from "react";
import { wipeEmployeeData, wipeTestData } from "../../firebase/wipeTestData";
import type { Employee } from "../../types";

interface Props {
  employeeDirectory?: Employee[];
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

type WipeMode = "all" | "selected";

export default function WipeDataPanel({ employeeDirectory, showToast }: Props) {
  const [mode, setMode] = useState<WipeMode | null>(null);
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    label: string;
    totalDeleted: number;
    breakdown: { name: string; count: number }[];
  } | null>(null);

  const canConfirm = typed.trim() === CONFIRM_TOKEN;
  const employees = employeeDirectory ?? [];
  const sortedEmployees = [...employees].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "th"),
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(employees.map((e) => e.id)));
  }
  function clearAll() {
    setSelectedIds(new Set());
  }

  function openAllModal() {
    setMode("all");
    setTyped("");
  }
  function openSelectedModal() {
    if (selectedIds.size === 0) return;
    setMode("selected");
    setTyped("");
  }
  function closeModal() {
    if (running) return;
    setMode(null);
    setTyped("");
  }

  async function handleConfirm() {
    if (!canConfirm || running || !mode) return;
    setRunning(true);
    try {
      if (mode === "all") {
        const res = await wipeTestData();
        if (res.ok) {
          setResult({
            label: "ล้างข้อมูลทั้งระบบสำเร็จ",
            totalDeleted: res.totalDeleted,
            breakdown: Object.entries(res.stats)
              .filter(([_, c]) => c > 0)
              .map(([name, count]) => ({ name, count })),
          });
          showToast?.(`ล้างข้อมูลสำเร็จ · ลบทั้งหมด ${res.totalDeleted} docs`);
          setMode(null);
          setTyped("");
        } else {
          showToast?.("ล้างข้อมูลไม่สำเร็จ");
        }
      } else {
        const ids = Array.from(selectedIds);
        const res = await wipeEmployeeData(ids);
        if (res.ok) {
          // sum รายฟิลด์ข้ามทุกคน → label ไทยอ่านง่าย
          let months = 0;
          let leaves = 0;
          let advances = 0;
          let loans = 0;
          let poolTouched = 0;
          let employees = 0;
          for (const s of res.stats) {
            months += s.months;
            leaves += s.leaves;
            advances += s.advances;
            loans += s.loans;
            poolTouched += s.poolSnapshotMonthsTouched;
            employees += s.employeeDoc;
          }
          const breakdown = [
            { name: "พนักงาน", count: employees },
            { name: "สลิปเงินเดือน", count: months },
            { name: "ใบลา", count: leaves },
            { name: "เบิกเงินล่วงหน้า", count: advances },
            { name: "เงินกู้", count: loans },
            { name: "Pool snapshots (เดือนที่แก้)", count: poolTouched },
          ].filter((b) => b.count > 0);
          setResult({
            label: `ล้างข้อมูลพนักงาน ${res.stats.length} คนสำเร็จ`,
            totalDeleted: res.totalDeleted,
            breakdown,
          });
          showToast?.(
            `ล้างข้อมูลพนักงาน ${res.stats.length} คน · ${res.totalDeleted} docs`,
          );
          setMode(null);
          setTyped("");
          setSelectedIds(new Set());
        } else {
          showToast?.("ล้างข้อมูลไม่สำเร็จ");
        }
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
          ปุ่มนี้ลบ <b>ข้อมูลพนักงาน + transactional data ทั้งหมด</b> เพื่อเริ่มใช้จริงครั้งแรก ·{" "}
          <b>ไม่สามารถ undo ได้</b> · แนะนำให้กด "Backup ตอนนี้" ในหน้า Backup ก่อนเสมอ
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

      {/* recovery safety net */}
      <div className="mb-4 rounded-[12px] border-[1.5px] border-amber/40 bg-amber-lt/30 overflow-hidden">
        <div className="px-3.5 py-2 bg-amber-lt/60 text-amber text-sm font-extrabold inline-flex items-center gap-1.5 w-full">
          <IconHistory size={14} strokeWidth={2.5} />
          ถ้าเผลอกดล้าง — กู้คืนยังไง?
        </div>
        <div className="p-3.5 text-sm text-txt leading-relaxed space-y-2.5">
          <div>
            <b className="text-amber">1. PITR</b> (Point-in-Time Recovery —
            แนะนำ): rollback database ทั้งฐานกลับไปเวลาก่อนกดล้าง · มีเวลา 7 วันให้กู้
            <ul className="mt-1.5 ml-3 space-y-0.5 text-xs text-txt-mid">
              <li>
                Firebase Console → Firestore →{" "}
                <code className="bg-white px-1 rounded">
                  Schedules and recovery
                </code>{" "}
                tab
              </li>
              <li>
                คลิก <b>"Restore database from PITR"</b> → เลือก timestamp
                ก่อนกดล้าง → restore เป็น DB ใหม่ → overwrite
              </li>
            </ul>
          </div>
          <div>
            <b className="text-amber">2. Daily Backup</b> (Firebase managed):
            snapshot รายวัน · เก็บไว้ 7-14 วัน · restore ผ่าน Console เหมือนกัน
          </div>
          <div>
            <b className="text-amber">3. GitHub Backup</b> (JSON ใน repo): data
            ครบ แต่ตอนนี้ยังไม่มี restore function · ถ้าเผลอเกิน 14 วัน ค่อยใช้
          </div>
        </div>
      </div>

      {/* run button — ล้างทั้งหมด */}
      <button
        type="button"
        onClick={openAllModal}
        disabled={running}
        className="w-full px-4 py-3 rounded-[12px] bg-red text-white font-extrabold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <IconTrash size={16} strokeWidth={2.5} />
        ล้างข้อมูลทั้งหมด
      </button>

      {/* ─── per-employee wipe section ─── */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <IconUserMinus size={18} strokeWidth={2.4} className="text-maroon" />
        <h3 className="text-base font-extrabold text-maroon">ล้างข้อมูลรายคน</h3>
      </div>
      <div className="mb-3 text-xs text-txt-mid leading-relaxed">
        เลือกพนักงานที่ต้องการลบ — ลบเฉพาะข้อมูลของคนนั้น (สลิปเงินเดือน · ใบลา · เบิกเงิน ·
        เงินกู้ · entries ใน pool snapshots) · ไม่กระทบ พนักงานคนอื่นและ config
      </div>

      <div className="mb-3 rounded-[12px] border-[1.5px] border-bdr/60 bg-white overflow-hidden">
        <div className="px-3.5 py-2 bg-cream/60 border-b border-bdr/40 flex items-center gap-2 text-sm">
          <span className="font-bold text-maroon flex-1">
            พนักงานทั้งหมด ({employees.length} คน)
          </span>
          <button
            type="button"
            onClick={selectAll}
            disabled={employees.length === 0}
            className="text-[11px] px-2 py-0.5 rounded border border-bdr bg-white text-txt-mid font-bold cursor-pointer font-[inherit] disabled:opacity-40"
          >
            เลือกทั้งหมด
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={selectedIds.size === 0}
            className="text-[11px] px-2 py-0.5 rounded border border-bdr bg-white text-txt-mid font-bold cursor-pointer font-[inherit] disabled:opacity-40"
          >
            ล้างการเลือก
          </button>
        </div>
        {sortedEmployees.length === 0 ? (
          <div className="p-4 text-center text-txt-soft italic text-sm">
            ยังไม่มีพนักงานในระบบ
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-bdr/40">
            {sortedEmployees.map((e) => {
              const checked = selectedIds.has(e.id);
              return (
                <li key={e.id}>
                  <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-cream/40">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(e.id)}
                      className="w-4 h-4 accent-red cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-txt flex-1 truncate">
                      {e.name || "(ไม่มีชื่อ)"}
                    </span>
                    {e.role && (
                      <span className="text-[11px] text-txt-soft">
                        {e.role}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={openSelectedModal}
        disabled={running || selectedIds.size === 0}
        className="w-full px-4 py-3 rounded-[12px] bg-maroon text-white font-extrabold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <IconUserMinus size={16} strokeWidth={2.5} />
        {selectedIds.size === 0
          ? "เลือกพนักงานก่อน"
          : `ล้างข้อมูลพนักงาน ${selectedIds.size} คน`}
      </button>

      {/* result */}
      {result && (
        <div className="mt-4 p-3.5 rounded-[12px] bg-green-lt/40 border-[1.5px] border-green/40">
          <div className="font-extrabold text-green mb-2 inline-flex items-center gap-1.5">
            <IconCheck size={16} strokeWidth={2.6} />
            {result.label} · ลบทั้งหมด {result.totalDeleted} docs
          </div>
          <ul className="space-y-1 text-xs text-txt">
            {result.breakdown.map(({ name, count }) => (
              <li key={name} className="flex justify-between">
                <code className="bg-cream px-1 rounded">{name}</code>
                <b className="text-maroon">{count.toLocaleString()}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* confirm modal */}
      {mode && (
        <div
          className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md bg-white rounded-[16px] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-red text-white flex items-center gap-2">
              <IconAlert size={18} strokeWidth={2.5} />
              <div className="font-extrabold flex-1">
                {mode === "all"
                  ? "ยืนยันล้างข้อมูลทั้งหมด"
                  : `ยืนยันล้างข้อมูล ${selectedIds.size} คน`}
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={running}
                className="p-1 rounded hover:bg-white/15 cursor-pointer"
              >
                <IconX size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {mode === "selected" && (
                <div className="rounded-[8px] border border-bdr/60 bg-cream/40 max-h-40 overflow-y-auto p-2 text-xs">
                  {sortedEmployees
                    .filter((e) => selectedIds.has(e.id))
                    .map((e) => (
                      <div key={e.id} className="py-0.5 text-txt font-semibold">
                        · {e.name || "(ไม่มีชื่อ)"}
                      </div>
                    ))}
                </div>
              )}
              <div className="text-sm text-txt leading-relaxed">
                การลบนี้ <b>ไม่สามารถ undo ได้</b> · พิมพ์{" "}
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
                  onClick={closeModal}
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
