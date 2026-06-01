/* ─── Pool Adjustment Modal ────────────────────────────────────────
   admin ใส่ "รายการหักจากกองกลาง" ระดับเดือน — โปรโมชั่น / ทองแท่ง MD ฯลฯ
   เป็น array ของ items {side, pieces, label} เพิ่ม/ลบได้อิสระ. เกณฑ์ 80%
   ยังใช้ gross เหมือนเดิม (พนักงานยัง credit อยู่)                       */
import {
  Lock as IconLock,
  Minus as IconMinus,
  Plus as IconPlus,
  Trash2 as IconTrash,
} from "lucide-react";
import { useEffect, useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";
import { formatThaiNumber } from "../../utils/format";
import BaseModal from "../shared/BaseModal";

interface Item {
  id: string;
  side: "normal" | "buy";
  pieces: number;
  label: string;
}

interface Props {
  yearMonth: string;
  locked: boolean;
  adjustment?: { items?: Item[] };
  grossNormal: number;
  grossBuy: number;
  onSave: (yearMonth: string, fields: { items: Item[] }) => Promise<void>;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

function randomId() {
  return Math.random().toString(36).slice(2, 11);
}

function normalizeItems(items?: Item[]): Item[] {
  return (items || []).map((it) => ({
    id: it.id || randomId(),
    side: it.side === "buy" ? "buy" : "normal",
    pieces: Number(it.pieces) || 0,
    label: it.label || "",
  }));
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
  // init จาก server doc — re-init เฉพาะเมื่อเปลี่ยนเดือน (ไม่ผูกกับ adjustment
  // reference เพราะ parent re-render สร้าง object ใหม่ทุกครั้ง จะ reset state ทับ)
  const [items, setItems] = useState<Item[]>(() =>
    normalizeItems(adjustment?.items),
  );
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-sync ตามเดือนเท่านั้น
  useEffect(() => {
    setItems(normalizeItems(adjustment?.items));
  }, [yearMonth]);

  const totalNormal = items
    .filter((i) => i.side === "normal")
    .reduce((s, i) => s + Math.max(0, Number(i.pieces) || 0), 0);
  const totalBuy = items
    .filter((i) => i.side === "buy")
    .reduce((s, i) => s + Math.max(0, Number(i.pieces) || 0), 0);
  const netNormal = Math.max(0, grossNormal - totalNormal);
  const netBuy = Math.max(0, grossBuy - totalBuy);

  // dirty = items ของ user ต่างจาก server (เทียบ field สำคัญ ไม่สน id)
  const compareKey = (arr: Item[]) =>
    arr
      .map((i) => `${i.side}:${Number(i.pieces) || 0}:${i.label.trim()}`)
      .sort()
      .join("|");
  const serverItems = normalizeItems(adjustment?.items);
  const dirty = compareKey(items) !== compareKey(serverItems);

  const [y, mo] = yearMonth.split("-");
  const monthLabel = `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;

  function addItem(side: "normal" | "buy") {
    setItems((prev) => [
      ...prev,
      { id: randomId(), side, pieces: 0, label: "" },
    ]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function updateItem(id: string, field: keyof Item, value: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (field === "pieces") {
          return { ...i, pieces: Number(value) || 0 };
        }
        if (field === "side") {
          return { ...i, side: value === "buy" ? "buy" : "normal" };
        }
        if (field === "label") {
          return { ...i, label: value };
        }
        return i;
      }),
    );
  }

  async function save() {
    if (locked || saving || !dirty) return;
    setSaving(true);
    try {
      await onSave(yearMonth, { items });
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

      <div className="text-xs text-txt-soft mb-3.5 leading-relaxed">
        ยอดที่หักออก จะไม่ถูกนำไปแบ่งในกองกลาง แต่{" "}
        <b className="text-txt-mid">ยังนับเป็นยอดของพนักงาน</b> (ไม่กระทบเกณฑ์ 80%)
      </div>

      {/* รายการหัก */}
      {items.length === 0 ? (
        <div className="text-center text-sm text-txt-soft py-6 px-4 bg-cream/60 rounded-[12px] border border-dashed border-bdr mb-3">
          ยังไม่มีรายการหัก
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              locked={locked}
              onUpdate={(f, v) => updateItem(item.id, f, v)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}

      {/* ปุ่มเพิ่ม — แยก 2 ฝั่ง ให้กดง่าย (เลือก side ตั้งแต่เพิ่ม) */}
      {!locked && (
        <div className="grid grid-cols-2 gap-2 mb-3.5">
          <button
            type="button"
            onClick={() => addItem("normal")}
            className="py-2.5 rounded-[10px] border-[1.5px] border-dashed border-maroon/30 bg-cream text-maroon text-sm font-bold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5"
          >
            <IconPlus size={14} strokeWidth={2.4} />
            หักจากขายทั่วไป
          </button>
          <button
            type="button"
            onClick={() => addItem("buy")}
            className="py-2.5 rounded-[10px] border-[1.5px] border-dashed border-maroon/30 bg-cream text-maroon text-sm font-bold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5"
          >
            <IconPlus size={14} strokeWidth={2.4} />
            หักจากรับซื้อ
          </button>
        </div>
      )}

      {/* สรุปยอดสุทธิ */}
      <div className="bg-gold-pale/60 rounded-[12px] p-3 mb-3.5 border border-gold/25 text-sm">
        <div className="flex justify-between mb-1">
          <span className="text-txt-mid">ขายทั่วไป (เข้ากองกลาง)</span>
          <span className="font-bold text-maroon">
            {formatThaiNumber(grossNormal)} − {formatThaiNumber(totalNormal)} ={" "}
            {formatThaiNumber(netNormal)} ชิ้น
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-txt-mid">รับซื้อ (เข้ากองกลาง)</span>
          <span className="font-bold text-maroon">
            {formatThaiNumber(grossBuy)} − {formatThaiNumber(totalBuy)} ={" "}
            {formatThaiNumber(netBuy)} ชิ้น
          </span>
        </div>
      </div>

      <div className="flex gap-2.5">
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

function ItemRow({
  item,
  locked,
  onUpdate,
  onRemove,
}: {
  item: Item;
  locked: boolean;
  onUpdate: (field: keyof Item, value: string) => void;
  onRemove: () => void;
}) {
  const sideLabel = item.side === "buy" ? "รับซื้อ" : "ขายทั่วไป";
  const sideBg = item.side === "buy" ? "bg-gold-pale/40" : "bg-maroon-50";
  return (
    <div
      className={`rounded-[10px] p-2.5 border border-bdr ${sideBg} flex flex-col gap-2`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-maroon shrink-0 px-2 py-0.5 rounded-full bg-white border border-bdr">
          {sideLabel}
        </span>
        <input
          type="text"
          value={item.label}
          disabled={locked}
          maxLength={120}
          placeholder="เหตุผล (เช่น โปรโมชั่น)"
          onChange={(e) => onUpdate("label", e.target.value)}
          className={`flex-1 min-w-0 px-3 py-2 rounded-[8px] border border-bdr text-sm outline-none font-[inherit] ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white"}`}
        />
        {!locked && (
          <button
            type="button"
            aria-label="ลบรายการ"
            onClick={onRemove}
            className="w-9 h-9 shrink-0 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30]"
          >
            <IconTrash size={15} className="text-red" strokeWidth={2.2} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-txt-soft shrink-0">จำนวน</span>
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="numeric"
            value={item.pieces || ""}
            disabled={locked}
            placeholder="0"
            onChange={(e) => onUpdate("pieces", e.target.value)}
            className={`w-full px-3 py-2 rounded-[8px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white"}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs pointer-events-none">
            ชิ้น
          </span>
        </div>
      </div>
    </div>
  );
}
