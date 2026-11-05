/* ─── helper แสดงผลเงินกู้ ใช้ร่วมกันระหว่างหน้ารายการ / สร้าง / กู้เพิ่ม ── */
import { THAI_MONTH_NAMES, THAI_MONTH_SHORT_NAMES } from "../../constants";
import { fmtShort, toYMD } from "../../utils/dateUtils";

/** "2026-11" → "พฤศจิกายน 2569" */
export function monthLabel(ym: string) {
  const [y, mo] = String(ym || "").split("-");
  const name = THAI_MONTH_NAMES[parseInt(mo, 10) - 1];
  return name ? `${name} ${parseInt(y, 10) + 543}` : ym;
}

/** "2026-11" → "พ.ย. 69" (ชิปประวัติการหัก · สั้นพอให้เรียงหลายเดือนในแถวเดียว) */
export function monthShortLabel(ym: string) {
  const [y, mo] = String(ym || "").split("-");
  const name = THAI_MONTH_SHORT_NAMES[parseInt(mo, 10) - 1];
  return name ? `${name} ${String(parseInt(y, 10) + 543).slice(-2)}` : ym;
}

/** เดือนที่เลือกเริ่มหักได้ — เดือนปัจจุบัน + ล่วงหน้า 3 เดือน (ไม่ย้อนหลัง
 *  กันใส่ยอดลงเดือนเก่าที่อาจปิดรอบไปแล้ว) · `notBefore` ตัดเดือนที่ก่อนนั้นทิ้ง */
export function monthOptions(notBefore = ""): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (ym >= notBefore) out.push(ym);
  }
  return out;
}

/** ISO timestamp → "5 พ.ย. 2569" (วันที่ตามเครื่อง · ข้อมูลเก่าไม่มีค่า → "-") */
export function isoDateLabel(iso: string | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : fmtShort(toYMD(d));
}
