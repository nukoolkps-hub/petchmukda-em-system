/* ─── Pool Adjustment Card ────────────────────────────────────────
   admin ใส่ "จำนวนที่ไม่นับค่าคอม" ระดับเดือน — หักจากกองกลางที่หารแบ่ง
   (โปรโมชั่น / ทองแท่ง MD ฯลฯ) · เกณฑ์ 80% ยังใช้ gross เหมือนเดิม         */
import {
  Diamond as IconDiamond,
  Lock as IconLock,
  Minus as IconMinus,
  ShoppingBag as IconShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatThaiNumber } from "../../utils/format";

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
  showToast?: (msg: string) => void;
}

export default function PoolAdjustmentCard({
  yearMonth,
  locked,
  adjustment,
  grossNormal,
  grossBuy,
  onSave,
  showToast,
}: Props) {
  // draft แยกจาก server value — sync เมื่อ yearMonth/adjustment เปลี่ยน
  const [normalExc, setNormalExc] = useState<string>("");
  const [buyExc, setBuyExc] = useState<string>("");
  const [normalNote, setNormalNote] = useState<string>("");
  const [buyNote, setBuyNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // sync draft จาก server เมื่อเดือนเปลี่ยน/เอกสารโหลดมาใหม่ — biome จะ
  // เตือนว่า yearMonth ไม่จำเป็น (เพราะ adjustment เปลี่ยนพร้อมเดือนอยู่แล้ว)
  // แต่เราใส่ไว้กันกรณี caller pass adjustment เป็น object เดียวกัน ref ค้าง
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
    <div className="rounded-xl p-3.5 mb-3.5 bg-cream/60 border-[1.5px] border-bdr">
      <div className="flex items-center gap-2 mb-2.5">
        <IconMinus size={16} strokeWidth={2.4} className="text-red" />
        <div className="text-sm font-bold text-txt">หักออกจากกองกลาง</div>
        <span className="text-xs text-txt-soft ml-1">(สินค้าที่ไม่ได้ค่าคอม)</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* ขาย-ทั่วไป */}
        <Row
          icon={<IconDiamond size={14} strokeWidth={2.4} />}
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
        {/* รับซื้อ */}
        <Row
          icon={<IconShoppingBag size={14} strokeWidth={2.4} />}
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

      {dirty && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || locked}
            className={`px-4 py-2 rounded-[9px] text-sm font-bold border-none bg-maroon text-white font-[inherit] inline-flex items-center gap-1.5 shadow-[0_3px_10px_rgba(123,28,28,0.25)] ${saving || locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {locked && <IconLock size={12} strokeWidth={2.5} />}
            {locked ? "ปิดรอบแล้ว" : saving ? "กำลังบันทึก..." : "บันทึกการหัก"}
          </button>
        </div>
      )}
    </div>
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
    <div className="bg-white rounded-[10px] p-3 border border-bdr">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-txt mb-2">
        {icon}
        {label}
        <span className="ml-auto text-xs font-normal text-txt-soft">
          กองรวม {formatThaiNumber(gross)} ชิ้น
        </span>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-txt-soft shrink-0">หักออก</span>
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            disabled={locked}
            placeholder="0"
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-[8px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-cream"}`}
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
        className={`w-full px-3 py-1.5 rounded-[8px] border border-bdr text-xs outline-none font-[inherit] mb-2 ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt-mid bg-cream"}`}
      />
      <div className="text-xs text-txt-soft text-center">
        เข้ากองกลางจริง: <b className="text-maroon">{formatThaiNumber(net)} ชิ้น</b>
      </div>
    </div>
  );
}
