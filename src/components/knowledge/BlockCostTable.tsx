/* ─── BlockCostTable — ค่าบล็อก + ค่าส่ง + ค่าประกัน ──────────────────
   ค่าบล็อก: 2 cards (ทอง / เงิน) สไตล์เดียวกับ LaborCostTable ·
              admin แก้ inline · sync ทุกคน
   ค่าส่ง + ค่าประกัน: render plain · hardcode (DEFAULT_BLOCK_COST_VALUES)   */

import {
  Package as IconPackage,
  Pencil as IconPencil,
  RotateCcw as IconReset,
  Save as IconSave,
  Shield as IconShield,
  Truck as IconTruck,
  X as IconX,
} from "lucide-react";
import { useMemo, useState } from "react";
import { COLORS } from "../../constants";
import {
  DEFAULT_BLOCK_COST_VALUES,
  updateBlockCost,
} from "../../firebase/blockCost";
import { useBlockCost } from "../../firebase/hooks/useFirestore";
import { fmtThaiDateTime } from "../../utils/dateUtils";

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

interface EditableCardProps {
  title: string;
  rows: RowSpec[];
  tone: "gold" | "silver";
  isAdmin?: boolean;
  blockValues: Record<string, string>;
  updatedAt: number;
  updatedBy: string;
  showToast?: (msg: string) => void;
}

/** card สไตล์ LaborCostTable: header + edit button + table + action bar
 *  · own edit state · save แค่ rows ของตัวเอง (Firestore merge) */
function EditableBlockSubCard({
  title,
  rows,
  tone,
  isAdmin,
  blockValues,
  updatedAt,
  updatedBy,
  showToast,
}: EditableCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const ROW_IDS = useMemo(() => rows.map((r) => r.id), [rows]);
  const isSilver = tone === "silver";

  // init draft จาก live values "ตอนกดแก้" เท่านั้น — ไม่ผูก blockValues ใน
  // effect (ถ้าผูก: snapshot tick ระหว่างพิมพ์จะ reset ค่าที่ admin กำลังกรอก)
  function startEditing() {
    const next: Record<string, string> = {};
    for (const id of ROW_IDS) {
      next[id] = blockValues[id] ?? DEFAULT_BLOCK_COST_VALUES[id] ?? "";
    }
    setDraft(next);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const values: Record<string, string> = {};
      for (const id of ROW_IDS) {
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
    for (const id of ROW_IDS) {
      next[id] = DEFAULT_BLOCK_COST_VALUES[id] ?? "";
    }
    setDraft(next);
  }

  return (
    <div
      className={`mb-3 rounded-[12px] border-[1.5px] ${isSilver ? "border-silver-lt/60" : "border-gold/40"} overflow-hidden bg-white`}
    >
      <div
        className={`px-3 py-2 ${isSilver ? "bg-silver-lt/30 text-silver-dk border-b border-silver-lt/60" : "bg-gold-pale text-maroon border-b border-gold/30"} text-xs font-extrabold inline-flex items-center gap-1.5 w-full`}
      >
        <IconPackage size={13} strokeWidth={2.5} />
        <span className="flex-1">{title}</span>
        {isAdmin && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[7px] bg-maroon text-white text-[11px] font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
          >
            <IconPencil size={10} strokeWidth={2.5} color={COLORS.gold} />
            แก้ไข
          </button>
        )}
      </div>

      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "55%" }} />
          <col style={{ width: "45%" }} />
        </colgroup>
        <thead>
          <tr className={`text-white ${isSilver ? "bg-silver" : "bg-maroon"}`}>
            <th className="px-2.5 py-1.5 text-left font-bold text-xs">น้ำหนัก</th>
            <th className="px-2.5 py-1.5 text-right font-bold text-xs">
              ค่าบล็อก (฿)
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
                {editing ? (
                  <input
                    type="text"
                    value={draft[r.id] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [r.id]: e.target.value }))
                    }
                    maxLength={60}
                    className="w-full max-w-[140px] px-2 py-1 rounded-[7px] border-[1.5px] border-bdr text-sm font-bold text-maroon text-right font-[inherit] outline-none bg-white focus:border-maroon"
                  />
                ) : (
                  (blockValues[r.id] ?? DEFAULT_BLOCK_COST_VALUES[r.id] ?? "—")
                )}
              </td>
            </tr>
          ))}
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

      {updatedAt > 0 && !editing && (
        <div className="px-3 py-1.5 bg-cream/60 border-t border-bdr/40 text-[10px] text-txt-soft text-center italic">
          อัปเดต {fmtThaiDateTime(updatedAt)}
          {updatedBy ? ` · โดย ${updatedBy}` : ""}
        </div>
      )}
    </div>
  );
}

/** ค่าส่ง + ค่าประกัน · plain card (no edit) · ใช้ค่า hardcode เท่านั้น */
function PlainSubTable({
  rows,
  tone,
  icon: Icon,
  title,
  valueHeader,
}: {
  rows: RowSpec[];
  tone: "gold" | "silver" | "gradient";
  icon: typeof IconPackage;
  title: string;
  /** หัวคอลัมน์ค่า · default = title (สั้นกว่าเพื่อไม่ซ้ำชื่อ section) */
  valueHeader: string;
}) {
  const headerBg =
    tone === "silver"
      ? "bg-silver-lt/30 text-silver-dk"
      : tone === "gradient"
        ? "bg-linear-to-r from-maroon via-silver-dk to-silver text-white"
        : "bg-gold-pale text-maroon";
  const headerThBg =
    tone === "silver"
      ? "bg-silver"
      : tone === "gradient"
        ? "bg-maroon"
        : "bg-maroon";
  const borderColor =
    tone === "silver" ? "border-silver-lt/60" : "border-gold/40";

  return (
    <div
      className={`mb-2 rounded-[10px] border ${borderColor} overflow-hidden bg-white`}
    >
      <div
        className={`px-2.5 py-1.5 ${headerBg} text-[11px] font-extrabold inline-flex items-center gap-1.5 w-full`}
      >
        <Icon size={12} strokeWidth={2.5} />
        {title}
      </div>
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "55%" }} />
          <col style={{ width: "45%" }} />
        </colgroup>
        {tone !== "gradient" && (
          <thead>
            <tr className={`text-white ${headerThBg}`}>
              <th className="px-2.5 py-1.5 text-left font-bold text-xs">
                น้ำหนัก
              </th>
              <th className="px-2.5 py-1.5 text-right font-bold text-xs">
                {valueHeader} (฿)
              </th>
            </tr>
          </thead>
        )}
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
                {DEFAULT_BLOCK_COST_VALUES[r.id] ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BlockCostTable({ isAdmin, showToast }: Props) {
  const { data: block } = useBlockCost();

  return (
    <>
      {/* ─── ค่าบล็อก · 2 cards (ทอง + เงิน) สไตล์ LaborCostTable ─── */}
      <EditableBlockSubCard
        title="ค่าบล็อก ทองคำแท่ง — ที่ ADMIN ตั้งไว้"
        rows={GOLD_BLOCK_ROWS}
        tone="gold"
        isAdmin={isAdmin}
        blockValues={block.values}
        updatedAt={block.updatedAt}
        updatedBy={block.updatedBy}
        showToast={showToast}
      />
      <EditableBlockSubCard
        title="ค่าบล็อก เงินแท่ง — ที่ ADMIN ตั้งไว้"
        rows={SILVER_BLOCK_ROWS}
        tone="silver"
        isAdmin={isAdmin}
        blockValues={block.values}
        updatedAt={block.updatedAt}
        updatedBy={block.updatedBy}
        showToast={showToast}
      />

      {/* ─── ค่าส่ง + ค่าประกัน · hardcode (ไม่มี admin edit) ─── */}
      <PlainSubTable
        rows={GOLD_SHIP_ROWS}
        tone="gold"
        icon={IconTruck}
        title="ค่าส่ง ทองคำแท่ง"
        valueHeader="ค่าส่ง"
      />
      <PlainSubTable
        rows={SILVER_SHIP_ROWS}
        tone="silver"
        icon={IconTruck}
        title="ค่าส่ง เงินแท่ง"
        valueHeader="ค่าส่ง"
      />
      <PlainSubTable
        rows={INSURANCE_ROWS}
        tone="gradient"
        icon={IconShield}
        title="ค่าประกัน"
        valueHeader="ค่าประกัน"
      />
    </>
  );
}
