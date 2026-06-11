/* ─── Date helpers ─────────────────────────────────────────────── */
import { TODAY } from "../constants";

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function countWorkdays(s: string, e: string): number {
  if (!s || !e) return 0;
  const S = new Date(`${s}T00:00:00`),
    E = new Date(`${e}T00:00:00`);
  if (E < S) return 0;
  let n = 0;
  const c = new Date(S);
  while (c <= E) {
    if (c.getDay() !== 6) n++;
    c.setDate(c.getDate() + 1);
  }
  return n;
}

export function dateRange(s: string, e: string): string[] {
  const out: string[] = [],
    S = new Date(`${s}T00:00:00`),
    E = new Date(`${e}T00:00:00`),
    c = new Date(S);
  while (c <= E) {
    out.push(toYMD(c));
    c.setDate(c.getDate() + 1);
  }
  return out;
}

export function fmtDate(d: string): string {
  if (!d) return "-";
  return new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fmtShort(d: string): string {
  if (!d) return "เลือกวันที่";
  return new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const WEEKDAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const WEEKDAYS_TH_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/* "2026-06-12" → "วันศุกร์ ที่ 12 มิถุนายน 2569" */
export function fmtDateWithWeekday(d: string): string {
  if (!d) return "-";
  const dt = new Date(`${d}T00:00:00`);
  return `วัน${WEEKDAYS_TH[dt.getDay()]} ที่ ${fmtDate(d)}`;
}

/* "2026-06-13" → "ส. 13 มิ.ย. 2569" — สั้นพร้อมวันในสัปดาห์ */
export function fmtShortWithWeekday(d: string): string {
  if (!d) return "-";
  const dt = new Date(`${d}T00:00:00`);
  return `${WEEKDAYS_TH_SHORT[dt.getDay()]} ${fmtShort(d)}`;
}

/* "YYYY-MM" ของวันนี้ — ใช้ join key salary/advance/loan */
export function currentYearMonth(): string {
  return TODAY.slice(0, 7);
}

export function isPast(e: string): boolean {
  return e < TODAY;
}

export function isFuture(s: string): boolean {
  return s > TODAY;
}
