/* ─── LoyaltyPointsRedeemTable — สะสมแต้ม แลก ทองคำแท่ง live ──────────
   subscribe /config/loyaltyPoints · ADMIN แก้ค่าได้ inline ทั้ง 2 column
   (แต้มที่ใช้ + ได้รับทองคำแท่ง) — sync ทุกคนทันที                          */

import {
  Gift as IconGift,
  Pencil as IconPencil,
  RotateCcw as IconReset,
  Save as IconSave,
  X as IconX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { COLORS } from "../../constants";
import { useLoyaltyPoints } from "../../firebase/hooks/useFirestore";
import {
  DEFAULT_LOYALTY_POINTS_VALUES,
  getLoyaltyPointsValue,
  updateLoyaltyPoints,
} from "../../firebase/loyaltyPoints";
import { findGoldWeightLabel } from "../../utils/goldWeights";

interface Props {
  isAdmin?: boolean;
  showToast?: (msg: string) => void;
}

const ROW_INDICES = [1, 2, 3, 4, 5] as const;

function keys(rowIndex: number) {
  return {
    pts: `redeem-r${rowIndex}-pts`,
    gold: `redeem-r${rowIndex}-gold`,
  };
}

const ALL_KEYS = ROW_INDICES.flatMap((i) => [keys(i).pts, keys(i).gold]);

/** แยกตัวเลขนำหน้ากับ suffix (หน่วย/วงเล็บ) — เก็บ suffix ล็อกไว้
 *  เช่น "1.905 กรัม (½ สลึง)" → { number: "1.905", suffix: " กรัม (½ สลึง)" }
 */
function splitNumeric(value: string): { number: string; suffix: string } {
  const match = value.match(/^\s*([\d.,]+)\s*(.*)$/);
  if (!match) return { number: "", suffix: "" };
  const tail = match[2] ?? "";
  return {
    number: match[1] ?? "",
    suffix: tail ? ` ${tail}` : "",
  };
}

function fallbackSuffix(key: string): string {
  return key.endsWith("-pts") ? " แต้ม" : " กรัม";
}

/** สำหรับ field "gold" — derive suffix จากตัวเลขที่ใส่ → "กรัม" หรือ "กรัม (X สลึง)" */
function deriveGoldSuffix(rawNumber: string): string {
  const cleaned = rawNumber.replace(/,/g, "").trim();
  if (!cleaned) return " กรัม";
  const grams = Number.parseFloat(cleaned);
  const label = findGoldWeightLabel(grams);
  return label ? ` กรัม (${label})` : " กรัม";
}

export default function LoyaltyPointsRedeemTable({
  isAdmin,
  showToast,
}: Props) {
  const { data: loyalty } = useLoyaltyPoints();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const next: Record<string, string> = {};
    for (const k of ALL_KEYS) {
      const current = getLoyaltyPointsValue(loyalty.values, k);
      next[k] = splitNumeric(current).number;
    }
    setDraft(next);
  }, [editing, loyalty.values]);

  async function handleSave() {
    setSaving(true);
    try {
      const values: Record<string, string> = {};
      for (const k of ALL_KEYS) {
        const num = (draft[k] ?? "").trim();
        if (num.length === 0) continue;
        // gold column: derive suffix จากเลขที่ใส่ ("(½ สลึง)" ฯลฯ)
        // pts column: ใช้ suffix เดิม fallback " แต้ม"
        const suffix = k.endsWith("-gold")
          ? deriveGoldSuffix(num)
          : splitNumeric(getLoyaltyPointsValue(loyalty.values, k)).suffix ||
            fallbackSuffix(k);
        values[k] = `${num}${suffix}`;
      }
      await updateLoyaltyPoints(values, "");
      showToast?.("บันทึกตารางแลกแต้มแล้ว");
      setEditing(false);
    } catch (err) {
      console.error("[LoyaltyPointsRedeemTable] save failed:", err);
      showToast?.(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const next: Record<string, string> = {};
    for (const k of ALL_KEYS) {
      const def = DEFAULT_LOYALTY_POINTS_VALUES[k] ?? "";
      next[k] = splitNumeric(def).number;
    }
    setDraft(next);
  }

  function renderEditableCell(k: string, alignRight: boolean) {
    const isGold = k.endsWith("-gold");
    const current = getLoyaltyPointsValue(loyalty.values, k);
    const liveSuffix = isGold
      ? deriveGoldSuffix(draft[k] ?? "")
      : splitNumeric(current).suffix || fallbackSuffix(k);
    const suffixLabel = liveSuffix.trim();
    return (
      <div
        className={`flex items-center gap-1.5 ${alignRight ? "justify-end" : ""}`}
      >
        <input
          type="text"
          inputMode="decimal"
          value={draft[k] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
          maxLength={12}
          className={`w-20 px-2 py-1 rounded-[7px] border-[1.5px] border-bdr text-sm font-bold ${alignRight ? "text-maroon" : "text-txt"} text-right font-[inherit] outline-none bg-white focus:border-maroon`}
        />
        <span className="text-xs text-txt-soft font-semibold whitespace-nowrap">
          {suffixLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconGift size={13} strokeWidth={2.5} />
        <span className="flex-1">สะสมแต้ม แลก ทองคำแท่ง — ที่ ADMIN ตั้งไว้</span>
        {isAdmin && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-maroon text-white text-[11px] font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
          >
            <IconPencil size={10} strokeWidth={2.5} color={COLORS.gold} />
            แก้ไข
          </button>
        )}
      </div>

      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "40%" }} />
          <col style={{ width: "60%" }} />
        </colgroup>
        <thead className="bg-maroon text-white">
          <tr>
            <th className="px-2.5 py-1.5 text-left font-bold text-xs">
              แต้มที่ใช้
            </th>
            <th className="px-2.5 py-1.5 text-right font-bold text-xs">
              ได้รับทองคำแท่ง
            </th>
          </tr>
        </thead>
        <tbody>
          {ROW_INDICES.map((i, idx) => {
            const k = keys(i);
            return (
              <tr
                key={i}
                className={`border-b border-bdr/40 last:border-0 ${idx % 2 === 0 ? "bg-cream/40" : "bg-white"}`}
              >
                <td
                  className={`px-2.5 py-1.5 font-semibold ${editing ? "" : "text-txt"}`}
                >
                  {editing
                    ? renderEditableCell(k.pts, false)
                    : getLoyaltyPointsValue(loyalty.values, k.pts) || "—"}
                </td>
                <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                  {editing
                    ? renderEditableCell(k.gold, true)
                    : getLoyaltyPointsValue(loyalty.values, k.gold) || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

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

      {loyalty.updatedAt > 0 && !editing && (
        <div className="px-3 py-1.5 bg-cream/60 border-t border-bdr/40 text-[10px] text-txt-soft text-center italic">
          อัปเดต {new Date(loyalty.updatedAt).toLocaleString("th-TH")}
          {loyalty.updatedBy ? ` · โดย ${loyalty.updatedBy}` : ""}
        </div>
      )}
    </div>
  );
}
