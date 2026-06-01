/* ─── Pool Adjustment Modal ────────────────────────────────────────
   admin ใส่ "จำนวนที่ไม่นับค่าคอม" ระดับเดือน — หักจากกองกลางที่หารแบ่ง
   (โปรโมชั่น / ทองแท่ง MD ฯลฯ) · เกณฑ์ 80% ยังใช้ gross เหมือนเดิม
   แยกเป็น modal (เปิดจากปุ่มแถวแผนผังเงินเดือน) ไม่ปนกับฟอร์มรายคน         */
import {
  Diamond as IconDiamond,
  Lock as IconLock,
  Minus as IconMinus,
  ShoppingBag as IconShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";
import { formatThaiNumber } from "../../utils/format";
import BaseModal from "../shared/BaseModal";

interface Props {
  yearMonth: string;
  locked: boolean;
  adjustment?: {
    excludedNormalPieces?: number;
    excludedBuyPieces?: number;
    excludedNormalNote?: string;
    excludedBuyNote?: string;
  };
  grossNormal: number;
  grossBuy: number;
  onSave: (
    yearMonth: string,
    fields: {
      excludedNormalPieces: number;
      excludedBuyPieces: number;
      excludedNormalNote: string;
      excludedBuyNote: string;
    },
  ) => Promise<void>;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

export default function PoolAdjustmentModal({
  yearMonth,
  locked,
  adjustment,
  grossNormal,
  grossBuy,
  onSave,
  onClose,
  showToast,
}: Props) {
  const [normalExc, setNormalExc] = useState<string>("");
  const [buyExc, setBuyExc] = useState<string>("");
  const [normalNote, setNormalNote] = useState<string>("");
  const [buyNote, setBuyNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-sync ตามเดือน
  useEffect(() => {
    setNormalExc(String(adjustment?.excludedNormalPieces ?? "") || "");
    setBuyExc(String(adjustment?.excludedBuyPieces ?? "") || "");
    setNormalNote(adjustment?.excludedNormalNote ?? "");
    setBuyNote(adjustment?.excludedBuyNote ?? "");
  }, [yearMonth, adjustment]);

  const normalNum = Math.max(0, Number(normalExc) || 0);
  const buyNum = Math.max(0, Number(buyExc) || 0);
  const netNormal = Math.max(0, grossNormal - normalNum);
  const netBuy = Math.max(0, grossBuy - buyNum);

  const dirty =
    normalNum !== (adjustment?.excludedNormalPieces ?? 0) ||
    buyNum !== (adjustment?.excludedBuyPieces ?? 0) ||
    normalNote !== (adjustment?.excludedNormalNote ?? "") ||
    buyNote !== (adjustment?.excludedBuyNote ?? "");

  const [y, mo] = yearMonth.split("-");
  const monthLabel = `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;

  async function save() {
    if (locked || saving || !dirty) return;
    setSaving(true);
    try {
      await onSave(yearMonth, {
        excludedNormalPieces: normalNum,
        excludedBuyPieces: buyNum,
        excludedNormalNote: normalNote.trim(),
        excludedBuyNote: buyNote.trim(),
      });
      showToast?.("บันทึกการหักกองกลางแล้ว");
      onClose();
    } catch (err) {
      console.error("[PoolAdjustment] save failed:", err);
      showToast?.(
        err instanceof Error && err.message ? err.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <BaseModal onClose={onClose} contentClassName="px-5.5 pt-6 pb-7">
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[46px] h-[46px] rounded-xl bg-red-lt flex items-center justify-center shrink-0 border border-red/20">
          <IconMinus size={22} className="text-red" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">หักออกจากกองกลาง</div>
          <div className="text-sm text-txt-soft mt-0.5">
            สินค้าที่ไม่ได้ค่าคอม · {monthLabel}
          </div>
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-2 px-3.5 py-3 mb-3.5 rounded-[12px] bg-cream border-[1.5px] border-bdr">
          <IconLock
            size={16}
            strokeWidth={2.4}
            className="text-txt-mid mt-0.5 shrink-0"
          />
          <div className="text-sm text-txt-mid leading-normal">
            <b className="text-txt">ปิดรอบแล้ว</b> — เดือนนี้แก้ไขไม่ได้
          </div>
        </div>
      )}

      <div className="text-xs text-txt-soft mb-3 leading-relaxed">
        ยอดที่หักออก จะไม่ถูกนำไปแบ่งในกองกลาง แต่
        <b className="text-txt-mid">ยังนับเป็นยอดของพนักงาน</b> (ไม่กระทบเกณฑ์ 80%)
      </div>

      <div className="flex flex-col gap-3">
        <Row
          icon={<IconDiamond size={15} strokeWidth={2.4} />}
          label="ขายทั่วไป"
          gross={grossNormal}
          net={netNormal}
          value={normalExc}
          note={normalNote}
          placeholder="เช่น สินค้าโปรโมชั่น"
          locked={locked}
          onChange={setNormalExc}
          onNoteChange={setNormalNote}
        />
        <Row
          icon={<IconShoppingBag size={15} strokeWidth={2.4} />}
          label="รับซื้อ"
          gross={grossBuy}
          net={netBuy}
          value={buyExc}
          note={buyNote}
          placeholder="เช่น ทองแท่ง (MD)"
          locked={locked}
          onChange={setBuyExc}
          onNoteChange={setBuyNote}
        />
      </div>

      <div className="flex gap-2.5 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit]"
        >
          ปิด
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || locked || !dirty}
          className={`flex-2 p-3.5 rounded-xl border-none text-base font-bold font-[inherit] inline-flex items-center justify-center gap-1.5 ${
            saving || locked || !dirty
              ? "bg-bdr text-txt-soft cursor-not-allowed"
              : "bg-maroon text-white cursor-pointer shadow-[0_4px_14px_rgba(123,28,28,0.25)]"
          }`}
        >
          {locked && <IconLock size={14} strokeWidth={2.5} />}
          {locked ? "ปิดรอบแล้ว" : saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </BaseModal>
  );
}

function Row({
  icon,
  label,
  gross,
  net,
  value,
  note,
  placeholder,
  locked,
  onChange,
  onNoteChange,
}: {
  icon: React.ReactNode;
  label: string;
  gross: number;
  net: number;
  value: string;
  note: string;
  placeholder: string;
  locked: boolean;
  onChange: (v: string) => void;
  onNoteChange: (v: string) => void;
}) {
  return (
    <div className="bg-cream/60 rounded-[12px] p-3.5 border border-bdr">
      <div className="flex items-center gap-1.5 text-sm font-bold text-txt mb-2.5">
        {icon}
        {label}
        <span className="ml-auto text-xs font-normal text-txt-soft">
          กองรวม {formatThaiNumber(gross)} ชิ้น
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-txt-mid shrink-0">หักออก</span>
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            disabled={locked}
            placeholder="0"
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white"}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs pointer-events-none">
            ชิ้น
          </span>
        </div>
      </div>
      <input
        type="text"
        value={note}
        disabled={locked}
        maxLength={120}
        placeholder={placeholder}
        onChange={(e) => onNoteChange(e.target.value)}
        className={`w-full px-3.5 py-2 rounded-[9px] border border-bdr text-sm outline-none font-[inherit] mb-2 ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt-mid bg-white"}`}
      />
      <div className="text-sm text-txt-mid text-center pt-1 border-t border-dashed border-bdr">
        เข้ากองกลางจริง: <b className="text-maroon">{formatThaiNumber(net)} ชิ้น</b>
      </div>
    </div>
  );
}
