/* ─── รายการประจำเดือน (รายรับ + รายจ่าย) ────────────────────────
   admin เพิ่ม/ลบรายการที่จะเด่นทุกเดือนใน calculateSalary · ใช้กับ
   EmployeeEditModal แท็บ "เงินเดือน" */

import {
  Minus as IconMinus,
  Plus as IconPlus,
  Trash2 as IconTrash,
} from "lucide-react";

export type RecurringItem = {
  id: string;
  type: "income" | "deduction";
  label: string;
  amount: number;
};

interface Props {
  items: RecurringItem[];
  onChange: (next: RecurringItem[]) => void;
}

export default function RecurringItemsEditor({ items, onChange }: Props) {
  const incomes = items.filter((i) => i.type === "income");
  const deductions = items.filter((i) => i.type === "deduction");

  const addItem = (type: "income" | "deduction") => {
    const id = `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    onChange([...items, { id, type, label: "", amount: 0 }]);
  };

  const updateItem = (id: string, patch: Partial<RecurringItem>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  return (
    <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
      <label className="text-xs text-maroon font-bold mb-3 flex items-center gap-1.5">
        <IconPlus size={12} strokeWidth={2.4} />
        รายการประจำเดือน
        <span className="font-normal text-txt-soft">(ใช้ทุกเดือน จนกว่าจะลบ)</span>
      </label>

      {/* รายรับ */}
      <div className="mb-3.5">
        <div className="text-xs font-bold text-green mb-2 inline-flex items-center gap-1">
          <IconPlus size={12} strokeWidth={2.6} />
          รายรับ
        </div>
        <div className="flex flex-col gap-2">
          {incomes.map((item) => (
            <RecurringItemRow
              key={item.id}
              item={item}
              tint="green"
              onLabel={(v) => updateItem(item.id, { label: v })}
              onAmount={(v) => updateItem(item.id, { amount: v })}
              onRemove={() => removeItem(item.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => addItem("income")}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] border-dashed border-green/60 bg-green-lt/40 text-green text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
          >
            <IconPlus size={14} strokeWidth={2.4} />
            เพิ่มรายการรายรับ
          </button>
        </div>
      </div>

      <div className="h-px bg-gold/25 my-3" />

      {/* รายจ่าย */}
      <div>
        <div className="text-xs font-bold text-red mb-2 inline-flex items-center gap-1">
          <IconMinus size={12} strokeWidth={2.6} />
          รายจ่าย
        </div>
        <div className="flex flex-col gap-2">
          {deductions.map((item) => (
            <RecurringItemRow
              key={item.id}
              item={item}
              tint="red"
              onLabel={(v) => updateItem(item.id, { label: v })}
              onAmount={(v) => updateItem(item.id, { amount: v })}
              onRemove={() => removeItem(item.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => addItem("deduction")}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] border-dashed border-red/50 bg-red-lt/40 text-red text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
          >
            <IconPlus size={14} strokeWidth={2.4} />
            เพิ่มรายการรายจ่าย
          </button>
        </div>
      </div>
    </div>
  );
}

function RecurringItemRow({
  item,
  tint,
  onLabel,
  onAmount,
  onRemove,
}: {
  item: RecurringItem;
  tint: "green" | "red";
  onLabel: (v: string) => void;
  onAmount: (v: number) => void;
  onRemove: () => void;
}) {
  const borderCls =
    tint === "green"
      ? "border-green/40 bg-green-lt/30"
      : "border-red/30 bg-red-lt/30";
  return (
    <div
      className={`flex gap-1.5 items-center p-1.5 rounded-[8px] border ${borderCls}`}
    >
      <input
        type="text"
        value={item.label}
        onChange={(e) => onLabel(e.target.value)}
        placeholder="ชื่อรายการ"
        className="flex-1 min-w-0 py-1.5 px-2 rounded-[7px] text-sm leading-normal font-bold outline-none font-[inherit] text-txt bg-white border border-bdr"
      />
      <input
        type="text"
        value={item.amount || ""}
        onChange={(e) => onAmount(parseFloat(e.target.value) || 0)}
        placeholder="0"
        className="shrink-0 w-[100px] py-1.5 px-2 rounded-[7px] text-sm leading-normal font-bold outline-none font-[inherit] text-txt bg-white border border-bdr text-right"
      />
      <button
        type="button"
        aria-label="ลบรายการ"
        onClick={onRemove}
        className="shrink-0 w-7 h-7 rounded-[6px] border border-bdr bg-white text-txt-soft cursor-pointer flex items-center justify-center"
      >
        <IconTrash size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}
