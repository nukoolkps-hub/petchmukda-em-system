/* ─── น้ำหนักทองคำแท่งมาตรฐาน (สคบ.) ─────────────────────────────
   sync กับตาราง "มาตรฐานน้ำหนัก" ใน knowledge ส่วน "น้ำหนักทองคำแท่ง"   */

export const GOLD_WEIGHT_LABELS: { grams: number; label: string }[] = [
  { grams: 1.905, label: "½ สลึง" },
  { grams: 3.811, label: "1 สลึง" },
  { grams: 7.622, label: "2 สลึง" },
  { grams: 15.244, label: "1 บาท" },
  { grams: 30.488, label: "2 บาท" },
  { grams: 45.732, label: "3 บาท" },
  { grams: 60.976, label: "4 บาท" },
  { grams: 76.22, label: "5 บาท" },
  { grams: 91.464, label: "6 บาท" },
  { grams: 106.708, label: "7 บาท" },
  { grams: 121.952, label: "8 บาท" },
  { grams: 137.196, label: "9 บาท" },
  { grams: 152.44, label: "10 บาท" },
];

/** ค้นหา label มาตรฐานจากน้ำหนัก (กรัม) · ยอมคลาด ≤ 0.001 ก. */
export function findGoldWeightLabel(grams: number): string | null {
  if (!Number.isFinite(grams)) return null;
  for (const w of GOLD_WEIGHT_LABELS) {
    if (Math.abs(w.grams - grams) <= 0.001) return w.label;
  }
  return null;
}
