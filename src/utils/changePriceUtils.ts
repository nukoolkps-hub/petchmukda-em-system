/* ─── ค่าเปลี่ยน น.น. เท่ากัน — สูตร + ตารางน้ำหนัก ────────────────────
   สูตร (ทอง 96.5%):
     ค่าเปลี่ยน = (ราคาทองคำไทย × 0.0656 × น้ำหนักกรัม × 3.1%)
                + (ค่าแรงเริ่มต้น × 85%)

   ส่วนแรก = "ราคาเนื้อทอง 96.5% ตามน้ำหนัก" × 3.1%
   ส่วนหลัง = ค่าแรงเริ่มต้น หลังลด 15%                                    */

export interface ChangePriceWeight {
  id: string;
  label: string; // "0.6 กรัม", "½ สลึง" ฯลฯ
  grams: number;
  laborBase: number; // ค่าแรงเริ่มต้นจากตารางใน knowledge
  /** ถ้า true → คำนวณเป็น "ต่อบาท" (ใช้กับ 2 บาท+) — ผู้ใช้ต้องคูณน้ำหนักเอง */
  perBaht?: boolean;
}

export const CHANGE_PRICE_WEIGHTS: ChangePriceWeight[] = [
  { id: "0.6g", label: "0.6 กรัม", grams: 0.6, laborBase: 450 },
  { id: "1g", label: "1 กรัม", grams: 1.0, laborBase: 550 },
  { id: "half-saleung", label: "½ สลึง", grams: 1.895, laborBase: 650 },
  { id: "1-saleung", label: "1 สลึง", grams: 3.79, laborBase: 750 },
  { id: "2-saleung", label: "2 สลึง", grams: 7.58, laborBase: 850 },
  { id: "3-saleung", label: "3 สลึง", grams: 11.37, laborBase: 950 },
  { id: "1-baht", label: "1 บาท", grams: 15.16, laborBase: 1050 },
  { id: "6-saleung", label: "6 สลึง", grams: 22.74, laborBase: 1900 },
  // 2 บาท+ "บาทละ 1,050" → คิดเป็น "ต่อบาท" (ลูกค้าคูณน้ำหนักเอง)
  {
    id: "2-baht-plus",
    label: "2 บาท ขึ้นไป (ต่อบาท)",
    grams: 15.16,
    laborBase: 1050,
    perBaht: true,
  },
];

/** merge default labor (จาก CHANGE_PRICE_WEIGHTS) + overrides (จาก
 *  /config/laborCost · admin แก้) · field ที่ admin ไม่ได้ overrride ใช้ default
 *  ใช้กับ live tables (ChangePriceTable, SellPrice96Table) + LaborCostTable */
export function getWeightsWithLabor(
  overrides: Record<string, number> | undefined,
): ChangePriceWeight[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return CHANGE_PRICE_WEIGHTS;
  }
  return CHANGE_PRICE_WEIGHTS.map((w) =>
    overrides[w.id] !== undefined ? { ...w, laborBase: overrides[w.id] } : w,
  );
}

/** ราคาเนื้อทอง 96.5% ตามน้ำหนัก (gram) — สูตรเดียวกับ "ราคาขายทอง 96.5%" */
function goldByWeight(goldPricePerBaht: number, grams: number): number {
  return goldPricePerBaht * 0.0656 * grams;
}

/** ปัดขึ้นถึงทวีคูณ 50 บาทที่ใกล้สุด (เช่น 2,518 → 2,550 · 2,578 → 2,600) */
export function ceilTo50(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / 50) * 50;
}

/** shortcut multipliers — ใช้ทั้ง sell + buy 96.5%
 *  ราคา = ราคาทอง × multiplier (+ ค่าแรง ถ้าเป็น sell)
 *  น้ำหนักนอกตาราง fallback = ราคาทอง × 0.0656 × grams */
const SHORTCUT_MULTIPLIERS: Record<string, number> = {
  "half-saleung": 1 / 8, // 0.125 → ราคาทอง ÷ 8
  "1-saleung": 1 / 4, // 0.25 → ราคาทอง ÷ 4
  "2-saleung": 1 / 2, // 0.5 → ราคาทอง ÷ 2
  "3-saleung": 0.75, // ราคาทอง × 0.75
  "1-baht": 1, // ราคาทอง (ไม่ต้องหาร)
  "6-saleung": 1.5, // ราคาทอง × 1.5
};

export function computeSellPrice96(
  weight: ChangePriceWeight,
  goldPricePerBaht: number,
): { goldPart: number; laborPart: number; total: number } {
  const multiplier = SHORTCUT_MULTIPLIERS[weight.id];
  const goldPart =
    multiplier !== undefined
      ? goldPricePerBaht * multiplier
      : goldByWeight(goldPricePerBaht, weight.grams);
  const laborPart = weight.laborBase;
  return { goldPart, laborPart, total: goldPart + laborPart };
}

/** ราคารับซื้อทอง 96.5% (หัก discount%) ตามน้ำหนัก
 *  ใช้ shortcut multipliers (เหมือน sell) เพื่อให้ตรงกับสูตรในตาราง
 *  ½ สลึง × 0.125, 1 สลึง × 0.25 ฯลฯ · น้ำหนักนอกตาราง fallback × 0.0656 × grams */
export function computeBuyPrice96(
  weight: ChangePriceWeight,
  goldPricePerBaht: number,
  discountPercent: number,
): number {
  const adjusted = goldPricePerBaht * (1 - discountPercent / 100);
  const multiplier = SHORTCUT_MULTIPLIERS[weight.id];
  return multiplier !== undefined
    ? adjusted * multiplier
    : goldByWeight(adjusted, weight.grams);
}

/** ค่าเปลี่ยน นน. เท่ากัน — return ราคารวมแล้ว */
export function computeChangePrice(
  weight: ChangePriceWeight,
  goldPricePerBaht: number,
): number {
  const goldPart = goldByWeight(goldPricePerBaht, weight.grams) * 0.031;
  const laborPart = weight.laborBase * 0.85;
  return goldPart + laborPart;
}

/** breakdown ใช้แสดงใน tooltip / hint
 *  - raw   = ผลคำนวณจริงตามสูตร
 *  - total = ปัดขึ้นถึง 50 (ราคาที่ลูกค้าจ่ายจริง) */
export function computeChangePriceBreakdown(
  weight: ChangePriceWeight,
  goldPricePerBaht: number,
): {
  goldPart: number;
  laborPart: number;
  raw: number;
  total: number;
} {
  const goldPart = goldByWeight(goldPricePerBaht, weight.grams) * 0.031;
  const laborPart = weight.laborBase * 0.85;
  const raw = goldPart + laborPart;
  return { goldPart, laborPart, raw, total: ceilTo50(raw) };
}
