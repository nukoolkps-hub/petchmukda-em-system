/* ─── Commission Exclusions Modal ──────────────────────────────────
   "รายการยกเว้นค่าคอม" ระดับเดือน · admin ใส่รายการที่ไม่เอามาคิดค่าคอม

   2 variant ตามชนิด role ที่เปิด modal:
   - kind="pool"  → pool sales (มี poolGroup): หักจากกองที่หารแบ่ง
     · เลือกตำแหน่ง (poolGroup) + ฝั่ง (ขายทั่วไป/รับซื้อ) + จำนวนชิ้น + เหตุผล
     · เกณฑ์ 80% ยังใช้ gross เหมือนเดิม (พนักงานยังมีสิทธิ์อยู่ในกอง)
   - kind="piece" → multi-item piece (เช่น บัญชี): หักจากพนักงานรายคน
     · เลือกพนักงาน + รายการค่าคอม + จำนวนชิ้น + เหตุผล
     · ลบจาก count ของพนักงานคนนั้น รายการนั้น                              */
import {
  ChevronDown as IconChevronDown,
  Lock as IconLock,
  Minus as IconMinus,
  Plus as IconPlus,
  Trash2 as IconTrash,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Employee, Role } from "../../types";
import { formatYmThai } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import { rolePieceItems } from "../../utils/salaryUtils";
import BaseModal from "../shared/BaseModal";

interface Item {
  id: string;
  kind: "pool" | "piece";
  // pool variant
  poolGroup?: string;
  side?: "normal" | "buy";
  // piece variant
  employeeId?: string;
  pieceItemId?: string;
  // shared
  pieces: number;
  label: string;
}

interface PoolGroupInfo {
  id: string;
  label: string;
  normal: number;
  buy: number;
}

interface Props {
  yearMonth: string;
  locked: boolean;
  adjustment?: { items?: Item[] };
  /** กลุ่มกองกลางในเดือนนี้ — ใช้กับ pool variant */
  poolGroups: PoolGroupInfo[];
  /** ตำแหน่ง + พนักงาน + role ของพนักงานคนนี้ — ใช้กับ piece variant */
  employee?: Employee | null;
  role?: Role | null | undefined;
  /** mode ของ modal — "pool" = role มี poolGroup, "piece" = multi-item */
  mode: "pool" | "piece";
  onSave: (yearMonth: string, fields: { items: Item[] }) => Promise<void>;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

function randomId() {
  return Math.random().toString(36).slice(2, 11);
}

function normalizeItems(items: Item[] | undefined): Item[] {
  return (items || []).map((it) => ({
    id: it.id || randomId(),
    kind: it.kind === "piece" ? "piece" : "pool",
    poolGroup: it.poolGroup || "",
    side: it.side === "buy" ? "buy" : "normal",
    employeeId: it.employeeId || "",
    pieceItemId: it.pieceItemId || "",
    pieces: Number(it.pieces) || 0,
    label: it.label || "",
  }));
}

export default function PoolAdjustmentModal({
  yearMonth,
  locked,
  adjustment,
  poolGroups,
  employee,
  role,
  mode,
  onSave,
  onClose,
  showToast,
}: Props) {
  const pieceItems = mode === "piece" ? rolePieceItems(role) : [];
  const firstGroup = poolGroups[0]?.id || "";
  const firstPieceItem = pieceItems[0]?.id || "";

  // init จาก server doc — กรองเฉพาะ items ที่เกี่ยวกับ scope ปัจจุบัน
  // (pool mode → pool items ทุกตำแหน่ง · piece mode → piece items ของ employee นี้)
  const filterScope = (items: Item[]) =>
    items.filter((it) =>
      mode === "piece"
        ? it.kind === "piece" && it.employeeId === employee?.id
        : it.kind !== "piece",
    );
  const [items, setItems] = useState<Item[]>(() =>
    filterScope(normalizeItems(adjustment?.items)),
  );
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-sync ตามเดือน/employee/mode เท่านั้น
  useEffect(() => {
    setItems(filterScope(normalizeItems(adjustment?.items)));
  }, [yearMonth, employee?.id, mode]);

  const monthLabel = formatYmThai(yearMonth);

  // dirty — เทียบเฉพาะ items ใน scope ปัจจุบัน
  const serverScope = filterScope(normalizeItems(adjustment?.items));
  const compareKey = (arr: Item[]) =>
    arr
      .map((i) =>
        i.kind === "piece"
          ? `piece:${i.employeeId}:${i.pieceItemId}:${i.pieces}:${i.label.trim()}`
          : `pool:${i.poolGroup}:${i.side}:${i.pieces}:${i.label.trim()}`,
      )
      .sort()
      .join("|");
  const dirty = compareKey(items) !== compareKey(serverScope);

  function addItem() {
    if (mode === "piece") {
      setItems((prev) => [
        ...prev,
        {
          id: randomId(),
          kind: "piece",
          employeeId: employee?.id || "",
          pieceItemId: firstPieceItem,
          pieces: 0,
          label: "",
        },
      ]);
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: randomId(),
          kind: "pool",
          poolGroup: firstGroup,
          side: "normal",
          pieces: 0,
          label: "",
        },
      ]);
    }
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function save() {
    if (locked || saving || !dirty) return;
    setSaving(true);
    try {
      // merge กับ items อื่นนอก scope (กันลบของ scope อื่น)
      const allServer = normalizeItems(adjustment?.items);
      const outsideScope = allServer.filter((it) =>
        mode === "piece"
          ? !(it.kind === "piece" && it.employeeId === employee?.id)
          : it.kind === "piece",
      );
      await onSave(yearMonth, { items: [...outsideScope, ...items] });
      showToast?.("บันทึกรายการยกเว้นค่าคอมแล้ว");
      onClose();
    } catch (err) {
      console.error("[CommissionExclusion] save failed:", err);
      showToast?.(
        err instanceof Error && err.message ? err.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  // ยอดหักรวมต่อกลุ่ม+ฝั่ง (pool mode summary)
  function deducted(groupId: string, side: "normal" | "buy") {
    return items
      .filter(
        (i) => i.kind === "pool" && i.poolGroup === groupId && i.side === side,
      )
      .reduce((s, i) => s + Math.max(0, Number(i.pieces) || 0), 0);
  }

  // ยอดหักรวมต่อรายการ (piece mode summary)
  function deductedPiece(itemId: string) {
    return items
      .filter((i) => i.kind === "piece" && i.pieceItemId === itemId)
      .reduce((s, i) => s + Math.max(0, Number(i.pieces) || 0), 0);
  }

  const headerSubtitle =
    mode === "piece"
      ? `${employee?.name || ""} · ${monthLabel}`
      : `สินค้าที่ไม่ได้ค่าคอม · ${monthLabel}`;

  return (
    <BaseModal onClose={onClose} contentClassName="px-5.5 pt-6 pb-7">
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[46px] h-[46px] rounded-xl bg-red-lt flex items-center justify-center shrink-0 border border-red/20">
          <IconMinus size={22} className="text-red" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">
            รายการยกเว้นค่าคอม
          </div>
          <div className="text-sm text-txt-soft mt-0.5">{headerSubtitle}</div>
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
        {mode === "piece"
          ? "ยอดที่หักออก จะถูกตัดจาก count ของพนักงานคนนี้ ในรายการที่เลือก · ใช้บันทึกเหตุผล (เช่น ยอดเก่า, ไม่นับเดือนนี้)"
          : "ยอดที่หักออก จะไม่ถูกนำไปแบ่งในกองกลาง แต่ ยังนับเป็นยอดของพนักงาน (ไม่กระทบเกณฑ์ 80%) · หักแยกตามตำแหน่ง"}
      </div>

      {/* รายการ */}
      {mode === "piece" && pieceItems.length === 0 ? (
        <div className="text-center text-sm text-txt-soft py-6 px-4 bg-cream/60 rounded-[12px] border border-dashed border-bdr mb-3">
          ตำแหน่งนี้ยังไม่มีรายการค่าคอม
          <br />
          ตั้งที่ "ตั้งค่า → ตำแหน่ง" ก่อน
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-sm text-txt-soft py-6 px-4 bg-cream/60 rounded-[12px] border border-dashed border-bdr mb-3">
          ยังไม่มีรายการยกเว้น
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              mode={mode}
              poolGroups={poolGroups}
              pieceItems={pieceItems}
              locked={locked}
              onUpdate={(patch) => updateItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}

      {!locked && (mode !== "piece" || pieceItems.length > 0) && (
        <button
          type="button"
          onClick={addItem}
          className="w-full mb-3.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-maroon/30 bg-cream text-maroon text-sm font-bold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5"
        >
          <IconPlus size={14} strokeWidth={2.4} />
          เพิ่มรายการยกเว้น
        </button>
      )}

      {/* สรุปยอด */}
      {mode === "pool" ? (
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
      ) : pieceItems.length > 0 ? (
        <div className="bg-gold-pale/60 rounded-[12px] p-3 mb-3.5 border border-gold/25 text-sm flex flex-col gap-1.5">
          {pieceItems.map((it) => {
            const d = deductedPiece(it.id);
            if (d === 0) return null;
            return (
              <div key={it.id} className="flex justify-between text-xs">
                <span className="text-txt-mid">{it.label}</span>
                <span className="font-semibold">
                  หัก {formatThaiNumber(d)} ชิ้น
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

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
  mode,
  poolGroups,
  pieceItems,
  locked,
  onUpdate,
  onRemove,
}: {
  item: Item;
  mode: "pool" | "piece";
  poolGroups: PoolGroupInfo[];
  pieceItems: { id: string; label: string }[];
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
        {mode === "pool" ? (
          <>
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
              <IconChevronDown
                size={12}
                strokeWidth={2.4}
                className={chevronCls}
              />
            </div>
            <div className="relative">
              <select
                value={item.side}
                disabled={locked}
                onChange={(e) =>
                  onUpdate({
                    side: e.target.value === "buy" ? "buy" : "normal",
                  })
                }
                className={selectCls}
              >
                <option value="normal">ขาย (ทั่วไป)</option>
                <option value="buy">รับซื้อ</option>
              </select>
              <IconChevronDown
                size={12}
                strokeWidth={2.4}
                className={chevronCls}
              />
            </div>
          </>
        ) : (
          // piece variant — เลือกรายการค่าคอม
          <div className="relative flex-1 min-w-0">
            <select
              value={item.pieceItemId}
              disabled={locked}
              onChange={(e) => onUpdate({ pieceItemId: e.target.value })}
              className={selectCls}
            >
              {pieceItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.label}
                </option>
              ))}
            </select>
            <IconChevronDown
              size={12}
              strokeWidth={2.4}
              className={chevronCls}
            />
          </div>
        )}
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
