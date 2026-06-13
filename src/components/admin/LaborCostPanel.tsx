/* ─── LaborCostPanel — admin แก้ค่าแรงเริ่มต้น (ทอง 96.5%) ──────────
   subscribe /config/laborCost · เก็บ override + sync ทุก live table
   (ChangePriceTable, SellPrice96Table, LaborCostTable, สูตรค่าเปลี่ยน)  */

import { Save as IconSave, Tag as IconTag } from "lucide-react";
import { useEffect, useState } from "react";
import { COLORS } from "../../constants";
import { useLaborCost } from "../../firebase/hooks/useFirestore";
import { updateLaborCost } from "../../firebase/laborCost";
import { CHANGE_PRICE_WEIGHTS } from "../../utils/changePriceUtils";

interface Props {
  showToast?: (msg: string) => void;
  updatedBy?: string;
}

export default function LaborCostPanel({ showToast, updatedBy = "" }: Props) {
  const { data: labor } = useLaborCost();
  // draft: weightId → string (text input)
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // sync draft กับ live data ครั้งแรก + เมื่อ remote update มา (ถ้าไม่มี local
  // edit ที่ค้าง)
  useEffect(() => {
    if (dirty) return;
    const next: Record<string, string> = {};
    for (const w of CHANGE_PRICE_WEIGHTS) {
      const v = labor.values[w.id] ?? w.laborBase;
      next[w.id] = String(v);
    }
    setDraft(next);
  }, [labor.values, dirty]);

  function setField(id: string, value: string) {
    setDirty(true);
    setDraft((d) => ({ ...d, [id]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const values: Record<string, number> = {};
      for (const w of CHANGE_PRICE_WEIGHTS) {
        const n = Number(draft[w.id]);
        if (Number.isFinite(n) && n >= 0) {
          values[w.id] = n;
        }
      }
      await updateLaborCost(values, updatedBy);
      showToast?.("บันทึกค่าแรงเริ่มต้นแล้ว");
      setDirty(false);
    } catch (err) {
      console.error("[LaborCostPanel] save failed:", err);
      showToast?.(
        err instanceof Error ? err.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const next: Record<string, string> = {};
    for (const w of CHANGE_PRICE_WEIGHTS) {
      next[w.id] = String(w.laborBase);
    }
    setDraft(next);
    setDirty(true);
  }

  return (
    <div>
      {/* header */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="w-10 h-10 rounded-[11px] bg-gold-pale flex items-center justify-center shrink-0">
          <IconTag size={20} strokeWidth={2.4} color={COLORS.maroon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt leading-tight">
            ค่าแรงเริ่มต้น (ทอง 96.5%)
          </div>
          <div className="text-xs text-txt-soft">
            แก้แล้วระบบ sync ทุกตาราง/เครื่องคิดเลขใน "ความรู้ต่างๆ" ทันที
          </div>
        </div>
      </div>

      {/* form */}
      <div className="bg-white rounded-[14px] border border-bdr p-3.5 mb-3 flex flex-col gap-2">
        {CHANGE_PRICE_WEIGHTS.map((w) => (
          <div key={w.id} className="flex items-center gap-2.5">
            <label
              htmlFor={`labor-${w.id}`}
              className="text-sm text-txt font-semibold flex-1 min-w-0"
            >
              {w.label}
              {w.perBaht && (
                <span className="ml-1 text-[10px] text-txt-soft">(ต่อบาท)</span>
              )}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id={`labor-${w.id}`}
                type="number"
                inputMode="decimal"
                min="0"
                value={draft[w.id] ?? ""}
                onChange={(e) => setField(w.id, e.target.value)}
                className="w-28 px-2 py-1.5 rounded-[8px] border-[1.5px] border-bdr text-sm font-bold text-txt text-right font-[inherit] outline-none bg-white focus:border-maroon"
              />
              <span className="text-xs text-txt-soft font-semibold w-6 text-center">
                ฿
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="px-3 py-2.5 rounded-[10px] border border-bdr bg-white text-txt-mid text-sm font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          คืนค่า default
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex-1 px-3 py-2.5 rounded-[10px] bg-maroon text-white text-sm font-extrabold cursor-pointer font-[inherit] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-1.5"
        >
          <IconSave size={14} strokeWidth={2.5} />
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>

      {labor.updatedAt > 0 && (
        <div className="text-xs text-txt-soft text-center mt-3 italic">
          อัปเดตล่าสุด {new Date(labor.updatedAt).toLocaleString("th-TH")}
          {labor.updatedBy ? ` · โดย ${labor.updatedBy}` : ""}
        </div>
      )}
    </div>
  );
}
