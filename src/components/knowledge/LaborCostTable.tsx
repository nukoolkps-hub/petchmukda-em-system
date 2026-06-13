/* ─── LaborCostTable — ค่าแรง เริ่มต้น (ทอง 96.5%) live ──────────────
   subscribe /config/laborCost · ADMIN แก้ค่าได้ inline จากตารางนี้เลย
   sync ทุก live table (ChangePriceTable, SellPrice96Table, สูตรค่าเปลี่ยน)  */

import {
  Pencil as IconPencil,
  RotateCcw as IconReset,
  Save as IconSave,
  Tag as IconTag,
  X as IconX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { COLORS } from "../../constants";
import { useLaborCost } from "../../firebase/hooks/useFirestore";
import { updateLaborCost } from "../../firebase/laborCost";
import {
  CHANGE_PRICE_WEIGHTS,
  getWeightsWithLabor,
} from "../../utils/changePriceUtils";
import { formatThaiNumber } from "../../utils/format";

interface Props {
  isAdmin?: boolean;
  showToast?: (msg: string) => void;
}

export default function LaborCostTable({ isAdmin, showToast }: Props) {
  const { data: labor } = useLaborCost();
  const weights = getWeightsWithLabor(labor.values);
  const normalWeights = weights.filter((w) => !w.perBaht);
  const perBaht = weights.find((w) => w.perBaht);

  // edit state — เฉพาะ ADMIN
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // เมื่อเข้า edit mode → init draft จาก live values
  useEffect(() => {
    if (!editing) return;
    const next: Record<string, string> = {};
    for (const w of CHANGE_PRICE_WEIGHTS) {
      const v = labor.values[w.id] ?? w.laborBase;
      next[w.id] = String(v);
    }
    setDraft(next);
  }, [editing, labor.values]);

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
      await updateLaborCost(values, "");
      showToast?.("บันทึกค่าแรงเริ่มต้นแล้ว");
      setEditing(false);
    } catch (err) {
      console.error("[LaborCostTable] save failed:", err);
      showToast?.(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
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
  }

  function renderValueCell(id: string, current: number) {
    if (editing) {
      return (
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={draft[id] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
          className="w-24 px-2 py-1 rounded-[7px] border-[1.5px] border-bdr text-sm font-bold text-maroon text-right font-[inherit] outline-none bg-white focus:border-maroon"
        />
      );
    }
    return formatThaiNumber(current);
  }

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      {/* header */}
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconTag size={13} strokeWidth={2.5} />
        <span className="flex-1">ค่าแรง เริ่มต้น — ที่ ADMIN ตั้งไว้</span>
        {isAdmin && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-[7px] bg-maroon text-white text-[11px] font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
          >
            <IconPencil size={10} strokeWidth={2.5} color={COLORS.gold} />
            แก้ไข
          </button>
        )}
      </div>

      {/* table */}
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "60%" }} />
          <col style={{ width: "40%" }} />
        </colgroup>
        <thead className="bg-maroon text-white">
          <tr>
            <th className="px-2.5 py-1.5 text-left font-bold text-xs">
              น้ำหนัก
            </th>
            <th className="px-2.5 py-1.5 text-right font-bold text-xs">
              ค่าแรงเริ่มต้น (฿)
            </th>
          </tr>
        </thead>
        <tbody>
          {normalWeights.map((w, i) => (
            <tr
              key={w.id}
              className={`border-b border-bdr/40 ${i % 2 === 0 ? "bg-cream/40" : ""}`}
            >
              <td className="px-2.5 py-1.5 text-txt font-semibold">
                {w.label}
              </td>
              <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                {renderValueCell(w.id, w.laborBase)}
              </td>
            </tr>
          ))}
          {perBaht && (
            <tr className="border-b border-bdr/40 last:border-0 bg-white">
              <td className="px-2.5 py-1.5 text-txt font-semibold">
                2 บาท ขึ้นไป
                <span className="ml-1 text-[10px] text-txt-soft">(ต่อบาท)</span>
              </td>
              <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                {editing ? (
                  renderValueCell(perBaht.id, perBaht.laborBase)
                ) : (
                  <>บาทละ {formatThaiNumber(perBaht.laborBase)}</>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* action bar — ADMIN only เมื่อ editing */}
      {editing && (
        <div className="px-3 py-2.5 bg-cream/40 border-t border-bdr/40 flex gap-2 items-center">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            title="คืนค่า default"
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-bdr bg-white text-txt-mid text-xs font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform disabled:opacity-40"
          >
            <IconReset size={11} strokeWidth={2.5} />
            คืนค่า default
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-bdr bg-white text-txt-mid text-xs font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform disabled:opacity-40"
          >
            <IconX size={11} strokeWidth={2.5} />
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-maroon text-white text-xs font-extrabold cursor-pointer font-[inherit] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96] transition-transform"
          >
            <IconSave size={11} strokeWidth={2.5} color={COLORS.gold} />
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      )}

      {/* updated info */}
      {labor.updatedAt > 0 && !editing && (
        <div className="px-3 py-1.5 bg-cream/60 border-t border-bdr/40 text-[10px] text-txt-soft text-center italic">
          อัปเดต {new Date(labor.updatedAt).toLocaleString("th-TH")}
          {labor.updatedBy ? ` · โดย ${labor.updatedBy}` : ""}
        </div>
      )}
    </div>
  );
}
