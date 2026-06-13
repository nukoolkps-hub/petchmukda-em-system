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
      next[k] = getLoyaltyPointsValue(loyalty.values, k);
    }
    setDraft(next);
  }, [editing, loyalty.values]);

  async function handleSave() {
    setSaving(true);
    try {
      const values: Record<string, string> = {};
      for (const k of ALL_KEYS) {
        const v = (draft[k] ?? "").trim();
        if (v.length > 0) values[k] = v;
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
      next[k] = DEFAULT_LOYALTY_POINTS_VALUES[k] ?? "";
    }
    setDraft(next);
  }

  function renderCell(k: string) {
    const current = getLoyaltyPointsValue(loyalty.values, k);
    if (editing) {
      return (
        <input
          type="text"
          value={draft[k] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
          maxLength={80}
          className="w-full max-w-[180px] px-2 py-1 rounded-[7px] border-[1.5px] border-bdr text-sm font-bold text-maroon text-right font-[inherit] outline-none bg-white focus:border-maroon"
        />
      );
    }
    return current || "—";
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
            className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-[7px] bg-maroon text-white text-[11px] font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
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
                  {editing ? (
                    <input
                      type="text"
                      value={draft[k.pts] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [k.pts]: e.target.value }))
                      }
                      maxLength={80}
                      className="w-full max-w-[160px] px-2 py-1 rounded-[7px] border-[1.5px] border-bdr text-sm font-bold text-txt font-[inherit] outline-none bg-white focus:border-maroon"
                    />
                  ) : (
                    getLoyaltyPointsValue(loyalty.values, k.pts) || "—"
                  )}
                </td>
                <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                  {renderCell(k.gold)}
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
