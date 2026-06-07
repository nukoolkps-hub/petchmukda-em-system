/* ─── Pool Adjustment Modal ────────────────────────────────────────
   admin ใส่ "รายการหักจากกองกลาง" ระดับเดือน แยกตาม "ตำแหน่ง" (poolGroup)
   — โปรโมชั่น / ทองแท่ง MD ฯลฯ. แต่ละ item: {poolGroup, side, pieces, label}
   เกณฑ์ 80% ยังใช้ gross เหมือนเดิม (พนักงานยังมีสิทธิ์อยู่ในกอง)             */
import {
  ChevronDown as IconChevronDown,
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
  poolGroup: string;
  side: "normal" | "buy";
  pieces: number;
  label: string;
}

interface PoolGroupInfo {
  id: string;
  label: string;
  normal: number; // gross ขายทั่วไปของกลุ่มนี้
  buy: number; // gross รับซื้อของกลุ่มนี้
}

interface Props {
  yearMonth: string;
  locked: boolean;
  adjustment?: { items?: Item[] };
  poolGroups: PoolGroupInfo[];
  onSave: (yearMonth: string, fields: { items: Item[] }) => Promise<void>;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

function randomId() {
  return Math.random().toString(36).slice(2, 11);
}

function normalizeItems(
  items: Item[] | undefined,
  fallbackGroup: string,
): Item[] {
  return (items || []).map((it) => ({
    id: it.id || randomId(),
    poolGroup: it.poolGroup || fallbackGroup,
    side: it.side === "buy" ? "buy" : "normal",
    pieces: Number(it.pieces) || 0,
    label: it.label || "",
  }));
}

export default function PoolAdjustmentModal({
  yearMonth,
  locked,
  adjustment,
  poolGroups,
  onSave,
  onClose,
  showToast,
}: Props) {
  const firstGroup = poolGroups[0]?.id || "";

  // init จาก server doc — re-init เฉพาะเมื่อเปลี่ยนเดือน
  const [items, setItems] = useState<Item[]>(() =>
    normalizeItems(adjustment?.items, firstGroup),
  );
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-sync ตามเดือนเท่านั้น
  useEffect(() => {
    setItems(normalizeItems(adjustment?.items, firstGroup));
  }, [yearMonth]);

  const [y, mo] = yearMonth.split("-");
  const monthLabel = `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;

  // dirty = items ของ user ต่างจาก server
  const compareKey = (arr: Item[]) =>
    arr
      .map(
        (i) =>
          `${i.poolGroup}:${i.side}:${Number(i.pieces) || 0}:${i.label.trim()}`,
      )
      .sort()
      .join("|");
  const dirty =
    compareKey(items) !==
    compareKey(normalizeItems(adjustment?.items, firstGroup));

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: randomId(),
        poolGroup: firstGroup,
        side: "normal",
        pieces: 0,
        label: "",
      },
    ]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  // ยอดหักรวมต่อกลุ่ม+ฝั่ง (สำหรับกล่องสรุป)
  function deducted(groupId: string, side: "normal" | "buy") {
    return items
      .filter((i) => i.poolGroup === groupId && i.side === side)
      .reduce((s, i) => s + Math.max(0, Number(i.pieces) || 0), 0);
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
        <b className="text-txt-mid">ยังนับเป็นยอดของพนักงาน</b> (ไม่กระทบเกณฑ์ 80%) ·
        หักแยกตามตำแหน่ง
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
              poolGroups={poolGroups}
              locked={locked}
              onUpdate={(patch) => updateItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}

      {!locked && (
        <button
          type="button"
          onClick={addItem}
          className="w-full mb-3.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-maroon/30 bg-cream text-maroon text-sm font-bold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5"
        >
          <IconPlus size={14} strokeWidth={2.4} />
          เพิ่มรายการหัก
        </button>
      )}

      {/* สรุปยอดสุทธิ แยกตามตำแหน่ง */}
      <div className="bg-gold-pale/60 rounded-[12px] p-3 mb-3.5 border border-gold/25 text-sm flex flex-col gap-2.5">
        {poolGroups.map((g) => {
          const dN = deducted(g.id, "normal");
          const dB = deducted(g.id, "buy");
          return (
            <div key={g.id}>
              <div className="font-bold text-maroon text-xs mb-0.5">
                {g.label}
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-txt-mid">ขาย (ทั่วไป)</span>
                <span className="font-semibold">
                  {formatThaiNumber(g.normal)} − {formatThaiNumber(dN)} ={" "}
                  {formatThaiNumber(Math.max(0, g.normal - dN))} ชิ้น
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-txt-mid">รับซื้อ</span>
                <span className="font-semibold">
                  {formatThaiNumber(g.buy)} − {formatThaiNumber(dB)} ={" "}
                  {formatThaiNumber(Math.max(0, g.buy - dB))} ชิ้น
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
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
  poolGroups,
  locked,
  onUpdate,
  onRemove,
}: {
  item: Item;
  poolGroups: PoolGroupInfo[];
  locked: boolean;
  onUpdate: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const selectCls =
    "w-full appearance-none pl-2.5 pr-7 py-2 rounded-[8px] border border-bdr text-sm font-semibold outline-none font-[inherit] bg-white text-txt cursor-pointer disabled:bg-cream-dk disabled:text-txt-soft disabled:cursor-not-allowed";
  const chevronCls =
    "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft";
  return (
    <div className="rounded-[10px] p-2.5 border border-bdr bg-cream/60 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* ตำแหน่ง */}
        <div className="relative flex-1 min-w-0">
          <select
            value={item.poolGroup}
            disabled={locked}
            onChange={(e) => onUpdate({ poolGroup: e.target.value })}
            className={selectCls}
          >
            {poolGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <IconChevronDown size={12} strokeWidth={2.4} className={chevronCls} />
        </div>
        {/* ฝั่ง */}
        <div className="relative">
          <select
            value={item.side}
            disabled={locked}
            onChange={(e) =>
              onUpdate({ side: e.target.value === "buy" ? "buy" : "normal" })
            }
            className={selectCls}
          >
            <option value="normal">ขาย (ทั่วไป)</option>
            <option value="buy">รับซื้อ</option>
          </select>
          <IconChevronDown size={12} strokeWidth={2.4} className={chevronCls} />
        </div>
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
        <input
          type="text"
          value={item.label}
          disabled={locked}
          maxLength={120}
          placeholder="เหตุผล (เช่น โปรโมชั่น)"
          onChange={(e) => onUpdate({ label: e.target.value })}
          className={`flex-1 min-w-0 px-3 py-2 rounded-[8px] border border-bdr text-sm outline-none font-[inherit] ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white"}`}
        />
        <div className="relative w-[110px] shrink-0">
          <input
            type="number"
            inputMode="numeric"
            value={item.pieces || ""}
            disabled={locked}
            placeholder="0"
            onChange={(e) => onUpdate({ pieces: Number(e.target.value) || 0 })}
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
