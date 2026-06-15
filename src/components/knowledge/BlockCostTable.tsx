/* ─── BlockCostTable — ค่าบล็อก + ค่าส่ง + ค่าประกัน live ──────────────
   subscribe /config/blockCost · ADMIN แก้ค่าได้ inline จาก section นี้เลย
   string values รองรับ format "300 / 350 / 450" (หลายราคาในเซลล์เดียว)        */

import {
  Package as IconPackage,
  Pencil as IconPencil,
  RotateCcw as IconReset,
  Save as IconSave,
  Shield as IconShield,
  Truck as IconTruck,
  X as IconX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { COLORS } from "../../constants";
import {
  DEFAULT_BLOCK_COST_VALUES,
  getBlockCostValue,
  updateBlockCost,
} from "../../firebase/blockCost";
import { useBlockCost } from "../../firebase/hooks/useFirestore";

interface Props {
  isAdmin?: boolean;
  showToast?: (msg: string) => void;
}

interface RowSpec {
  id: string;
  label: string;
}

const GOLD_BLOCK_ROWS: RowSpec[] = [
  { id: "gold-005g-1baht", label: "0.05 กรัม – 1 บาท" },
  { id: "gold-2baht", label: "2 บาท" },
  { id: "gold-5baht", label: "5 บาท" },
  { id: "gold-10baht", label: "10 บาท" },
  { id: "gold-1kilo", label: "1 กิโล" },
];

const GOLD_SHIP_ROWS: RowSpec[] = [
  { id: "gold-ship-005g-10baht", label: "0.05 กรัม – 10 บาท" },
  { id: "gold-ship-1kilo", label: "1 กิโล" },
];

const SILVER_BLOCK_ROWS: RowSpec[] = [
  { id: "silver-half-1baht", label: "1 สลึง – 1 บาท" },
  { id: "silver-5baht", label: "5 บาท" },
  { id: "silver-10baht", label: "10 บาท" },
  { id: "silver-20baht", label: "20 บาท" },
  { id: "silver-1kilo", label: "1 กิโล" },
];

const SILVER_SHIP_ROWS: RowSpec[] = [
  { id: "silver-ship-1baht-10baht", label: "1 สลึง – 10 บาท" },
  { id: "silver-ship-20baht", label: "20 บาท" },
  { id: "silver-ship-1kilo", label: "1 กิโล" },
];

const INSURANCE_ROWS: RowSpec[] = [
  { id: "insurance-pct", label: "% ของราคาสินค้า" },
  { id: "insurance-max", label: "เพดานราคาสินค้า (฿)" },
];

// admin แก้ได้เฉพาะ "ค่าบล็อก" (ทอง + เงิน) · ค่าส่ง + ค่าประกันใช้ค่า
// hardcode (DEFAULT_BLOCK_COST_VALUES) เท่านั้น — ปรับโดยแก้โค้ด
const EDITABLE_ROW_IDS = [...GOLD_BLOCK_ROWS, ...SILVER_BLOCK_ROWS].map(
  (r) => r.id,
);

export default function BlockCostTable({ isAdmin, showToast }: Props) {
  const { data: block } = useBlockCost();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const next: Record<string, string> = {};
    for (const id of EDITABLE_ROW_IDS) {
      next[id] = getBlockCostValue(block.values, id);
    }
    setDraft(next);
  }, [editing, block.values]);

  async function handleSave() {
    setSaving(true);
    try {
      const values: Record<string, string> = {};
      for (const id of EDITABLE_ROW_IDS) {
        const v = (draft[id] ?? "").trim();
        if (v.length > 0) values[id] = v;
      }
      await updateBlockCost(values, "");
      showToast?.("บันทึกค่าบล็อกแล้ว");
      setEditing(false);
    } catch (err) {
      console.error("[BlockCostTable] save failed:", err);
      showToast?.(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const next: Record<string, string> = {};
    for (const id of EDITABLE_ROW_IDS) {
      next[id] = DEFAULT_BLOCK_COST_VALUES[id] ?? "";
    }
    setDraft(next);
  }

  /** editable=true → ใช้ค่า live + แสดง input ตอน editing
   *  editable=false → แสดงค่า hardcode (DEFAULT_BLOCK_COST_VALUES) เสมอ */
  function renderValueCell(id: string, editable: boolean) {
    if (!editable) {
      // ค่าส่ง + ค่าประกัน → hardcode เท่านั้น · ไม่ขึ้น input แม้ admin จะกดแก้
      return DEFAULT_BLOCK_COST_VALUES[id] ?? "—";
    }
    const current = getBlockCostValue(block.values, id);
    if (editing) {
      return (
        <input
          type="text"
          value={draft[id] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
          maxLength={60}
          className="w-full max-w-[140px] px-2 py-1 rounded-[7px] border-[1.5px] border-bdr text-sm font-bold text-maroon text-right font-[inherit] outline-none bg-white focus:border-maroon"
        />
      );
    }
    return current || "—";
  }

  function renderSubTable(
    rows: RowSpec[],
    options: {
      tone?: "gold" | "silver";
      icon: typeof IconPackage;
      title: string;
      valueHeader: string;
      /** true = แก้ผ่าน UI ได้ (ค่าบล็อก) · false = hardcode (ค่าส่ง) */
      editable: boolean;
    },
  ) {
    const isSilver = options.tone === "silver";
    const Icon = options.icon;
    return (
      <div
        className={`mb-2 rounded-[10px] border ${isSilver ? "border-silver-lt/60" : "border-gold/40"} overflow-hidden bg-white`}
      >
        <div
          className={`px-2.5 py-1.5 ${isSilver ? "bg-silver-lt/30 text-silver-dk" : "bg-gold-pale text-maroon"} text-[11px] font-extrabold inline-flex items-center gap-1.5 w-full`}
        >
          <Icon size={12} strokeWidth={2.5} />
          {options.title}
        </div>
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: "55%" }} />
            <col style={{ width: "45%" }} />
          </colgroup>
          <thead>
            <tr
              className={`text-white ${isSilver ? "bg-silver" : "bg-maroon"}`}
            >
              <th className="px-2.5 py-1.5 text-left font-bold text-xs">
                น้ำหนัก
              </th>
              <th className="px-2.5 py-1.5 text-right font-bold text-xs">
                {options.valueHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-bdr/40 last:border-0 ${i % 2 === 0 ? "bg-cream/40" : "bg-white"}`}
              >
                <td className="px-2.5 py-1.5 text-txt font-semibold">
                  {r.label}
                </td>
                <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                  {renderValueCell(r.id, options.editable)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      {/* ─── admin-editable frame · เฉพาะค่าบล็อก ทอง + เงิน ─── */}
      <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
        <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
          <IconPackage size={13} strokeWidth={2.5} />
          <span className="flex-1">ค่าบล็อก — ที่ ADMIN ตั้งไว้</span>
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

        <div className="p-2.5 space-y-1">
          <div className="text-[11px] text-txt-soft font-bold pt-1 pb-0.5">
            ทองคำแท่ง
          </div>
          {renderSubTable(GOLD_BLOCK_ROWS, {
            tone: "gold",
            icon: IconPackage,
            title: "ค่าบล็อก",
            valueHeader: "ค่าบล็อก (฿)",
            editable: true,
          })}

          <div className="text-[11px] text-silver font-bold pt-2 pb-0.5">
            เงินแท่ง
          </div>
          {renderSubTable(SILVER_BLOCK_ROWS, {
            tone: "silver",
            icon: IconPackage,
            title: "ค่าบล็อก",
            valueHeader: "ค่าบล็อก (฿)",
            editable: true,
          })}
        </div>

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
        {block.updatedAt > 0 && !editing && (
          <div className="px-3 py-1.5 bg-cream/60 border-t border-bdr/40 text-[10px] text-txt-soft text-center italic">
            อัปเดต {new Date(block.updatedAt).toLocaleString("th-TH")}
            {block.updatedBy ? ` · โดย ${block.updatedBy}` : ""}
          </div>
        )}
      </div>

      {/* ─── ค่าส่ง + ค่าประกัน · plain (hardcode) · ไม่มี admin frame ─── */}
      <div className="mb-3 space-y-1">
        <div className="text-[11px] text-txt-soft font-bold pb-0.5">
          ทองคำแท่ง · ค่าส่ง
        </div>
        {renderSubTable(GOLD_SHIP_ROWS, {
          tone: "gold",
          icon: IconTruck,
          title: "ค่าส่ง",
          valueHeader: "ค่าส่ง (฿)",
          editable: false,
        })}

        <div className="text-[11px] text-silver font-bold pt-2 pb-0.5">
          เงินแท่ง · ค่าส่ง
        </div>
        {renderSubTable(SILVER_SHIP_ROWS, {
          tone: "silver",
          icon: IconTruck,
          title: "ค่าส่ง",
          valueHeader: "ค่าส่ง (฿)",
          editable: false,
        })}

        <div className="text-[11px] text-txt-soft font-bold pt-2 pb-0.5">
          ค่าประกัน
        </div>
        <div className="rounded-[10px] border border-gold/40 overflow-hidden bg-white">
          <div className="px-2.5 py-1.5 bg-linear-to-r from-maroon via-silver-dk to-silver text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 w-full">
            <IconShield size={12} strokeWidth={2.5} />
            ค่าประกัน
          </div>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "55%" }} />
              <col style={{ width: "45%" }} />
            </colgroup>
            <tbody>
              {INSURANCE_ROWS.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-bdr/40 last:border-0 ${i % 2 === 0 ? "bg-cream/40" : "bg-white"}`}
                >
                  <td className="px-2.5 py-1.5 text-txt font-semibold">
                    {r.label}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                    {renderValueCell(r.id, false)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
