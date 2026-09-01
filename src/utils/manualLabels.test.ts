/* ─── คู่มือในแอปอ้างชื่อปุ่ม/ป้ายที่มีอยู่จริง ─────────────────────────
   `ManualModal` สอนพนักงานโดยอ้างชื่อปุ่มตรงๆ (เช่น ปุ่ม "ใบรับรอง") · พอมี
   คนเปลี่ยนชื่อปุ่มในหน้าจอ คู่มือก็ชี้ไปที่ของที่ไม่มีอยู่ — ไม่ throw
   ไม่มีเทสต์แดง พนักงานหาไม่เจอเองแล้วมาถาม

   เจอมาแล้ว: คู่มือบอกว่าปุ่มขึ้น "เปิดเสมอ" แต่ของจริงเขียน
   "ผูกขาดคนทำ — เปิดอยู่เสมอ"

   เทสต์นี้ดึงข้อความที่คู่มือใส่เครื่องหมายคำพูด แล้วเช็คว่ามีอยู่จริงใน
   component อื่น · ไม่ได้เช็คว่าอธิบายถูก แค่กัน "อ้างของที่ไม่มี"        */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MANUAL = "src/components/modals/ManualModal.tsx";

/** คำที่ไม่ใช่ชื่อ element ในแอปเรา — ข้ามไป
 *  · ปุ่มของเบราว์เซอร์เอง (กล่อง print ของ OS)
 *  · ตัวอย่างข้อความที่มี placeholder → เช็คตรงๆ ไม่ได้ */
const SKIP = new Set(["บันทึกเป็น PDF"]);

/** ข้อความใน <b>"..."</b> = ชื่อปุ่ม/ป้ายที่คู่มืออ้างถึง */
function quotedLabels(source: string): string[] {
  return [...source.matchAll(/<b>"([^"]{2,40})"<\/b>/g)]
    .map((m) => m[1].trim())
    .filter((s) => !SKIP.has(s) && !s.includes("(ชื่อ)") && !s.startsWith("+"));
}

/** ป้ายนี้โผล่ในไฟล์ .tsx อื่นนอกจากคู่มือไหม */
function existsInApp(label: string): boolean {
  try {
    const out = execFileSync(
      "grep",
      // รวม .ts ด้วย — ข้อความบางอันอยู่ในตัวสร้างเอกสาร (print/*.ts)
      ["-rlF", label, "src", "--include=*.tsx", "--include=*.ts"],
      { encoding: "utf8" },
    );
    return out
      .split("\n")
      .some(
        (f) =>
          f.trim() && !f.includes("ManualModal") && !f.includes(".test.ts"),
      );
  } catch {
    return false; // grep exit 1 = ไม่เจอเลย
  }
}

describe("คู่มือในแอป อ้างชื่อปุ่มที่มีอยู่จริง", () => {
  const labels = quotedLabels(readFileSync(MANUAL, "utf8"));

  it("ดึงชื่อปุ่มจากคู่มือได้ (sanity — ไม่งั้นเทสต์ผ่านฟรี)", () => {
    expect(labels.length).toBeGreaterThan(5);
    expect(labels).toContain("ใบรับรอง");
  });

  it("ทุกชื่อที่คู่มืออ้าง มีอยู่ในหน้าจอจริง", () => {
    const missing = labels.filter((l) => !existsInApp(l));
    expect(missing, "คู่มืออ้างถึงปุ่ม/ป้ายที่หาไม่เจอในแอป").toEqual([]);
  });
});
