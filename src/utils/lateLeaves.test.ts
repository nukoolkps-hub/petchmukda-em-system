/* ─── "มีคนลาเพิ่ม" 08:30 — เลือกเฉพาะคนที่ตกหล่นจากสรุปเช้า ─────────
   logic อยู่ฝั่ง server (functions/src/dailySummary/leaveRules.ts) แต่เป็น
   pure TS ไม่ import อะไรเลย จึง import ข้ามมาเทสต์ได้ตรงๆ
   (pattern เดียวกับ dutyCoverageExclusive.test.ts)

   ⚠️ ต้อง import จาก `leaveRules.ts` เท่านั้น — `lateLeaves.ts` แตะ
   firebase-admin ซึ่ง CI ไม่ได้ลง (`npm ci` เฉพาะ root) → typecheck พัง

   invariant ที่ยึด:
   1. แจ้งเฉพาะคนที่กด "หลัง" สรุปเช้า — ไม่ส่งซ้ำคนที่อยู่ในกล่องเช้าแล้ว
   2. ใบลาเก่าที่ไม่มี createdAt ต้องไม่ถูกนับเป็นของใหม่ (ไม่งั้นสแปมทุกวัน
      ตลอดช่วงที่คนนั้นลายาว)
   3. cutoff ยึด claimedAt ของสรุปเช้า · ไม่มี doc → 07:30 ของวันนั้น
   4. ต้องเป็นใบลาที่ครอบ "วันนี้" — กดวันนี้แต่ลาสัปดาห์หน้า ไม่นับ         */

import { describe, expect, it } from "vitest";
import {
  coversDay,
  isLateLeave,
  pickLateLeaveDocs,
  resolveLateCutoffMs,
} from "../../functions/src/dailySummary/leaveRules";

const YMD = "2026-09-01";
const at = (hhmm: string) => Date.parse(`${YMD}T${hhmm}:00+07:00`);

describe("resolveLateCutoffMs", () => {
  it("ไม่มี doc สรุปเช้า (เสาร์/ปิด toggle) → ใช้ 07:30 ของวันนั้น", () => {
    expect(resolveLateCutoffMs(YMD, null)).toBe(at("07:30"));
    expect(resolveLateCutoffMs(YMD, undefined)).toBe(at("07:30"));
  });

  it("ยึด claimedAt (เวลาที่สรุปเช้าเริ่มทำงาน) ไม่ใช่ sentAt", () => {
    const doc = {
      claimedAt: new Date(at("07:30")).toISOString(),
      sentAt: new Date(at("07:31")).toISOString(),
    };
    // sentAt ช้ากว่า — ถ้ายึดอันนั้น คนที่กดลา 07:30:30 จะหายเงียบ
    expect(resolveLateCutoffMs(YMD, doc)).toBe(at("07:30"));
  });

  it("มีแต่ sentAt (doc เก่า) → ใช้ sentAt", () => {
    const doc = { sentAt: new Date(at("07:32")).toISOString() };
    expect(resolveLateCutoffMs(YMD, doc)).toBe(at("07:32"));
  });

  it("timestamp เสีย/ไม่ใช่ string → ตกกลับไปใช้ 07:30 ไม่พัง", () => {
    expect(resolveLateCutoffMs(YMD, { claimedAt: "ไม่ใช่วันที่" })).toBe(
      at("07:30"),
    );
    expect(resolveLateCutoffMs(YMD, { claimedAt: 12345 })).toBe(at("07:30"));
  });
});

describe("isLateLeave", () => {
  const cutoff = at("07:30");

  it("กดลาหลังสรุปเช้า → ใช่", () => {
    expect(isLateLeave({ createdAt: at("08:05") }, cutoff)).toBe(true);
  });

  it("กดลาก่อนสรุปเช้า (อยู่ในกล่องเช้าแล้ว) → ไม่ใช่", () => {
    expect(isLateLeave({ createdAt: at("06:00") }, cutoff)).toBe(false);
  });

  it("กดลาเมื่อวาน → ไม่ใช่", () => {
    expect(
      isLateLeave(
        { createdAt: Date.parse("2026-08-31T22:00:00+07:00") },
        cutoff,
      ),
    ).toBe(false);
  });

  it("ตรงเวลา cutoff พอดี → ไม่ใช่ (ถือว่าทันกล่องเช้า)", () => {
    expect(isLateLeave({ createdAt: cutoff }, cutoff)).toBe(false);
  });

  it("ใบลาเก่าไม่มี createdAt → ไม่ใช่ (กันสแปมชื่อเดิมทุกวัน)", () => {
    expect(isLateLeave({}, cutoff)).toBe(false);
    expect(isLateLeave({ createdAt: null }, cutoff)).toBe(false);
    expect(isLateLeave({ createdAt: "1756...." }, cutoff)).toBe(false);
    expect(isLateLeave({ createdAt: Number.NaN }, cutoff)).toBe(false);
  });
});

describe("coversDay", () => {
  it("ลาวันเดียว = วันนี้ → ครอบ", () => {
    expect(coversDay({ start: YMD, end: YMD }, YMD)).toBe(true);
  });

  it("ลายาวคร่อมวันนี้ → ครอบ", () => {
    expect(coversDay({ start: "2026-08-30", end: "2026-09-03" }, YMD)).toBe(
      true,
    );
  });

  it("ลาสัปดาห์หน้า / สัปดาห์ที่แล้ว → ไม่ครอบ", () => {
    expect(coversDay({ start: "2026-09-05", end: "2026-09-05" }, YMD)).toBe(
      false,
    );
    expect(coversDay({ start: "2026-08-20", end: "2026-08-25" }, YMD)).toBe(
      false,
    );
  });
});

describe("pickLateLeaveDocs — ตัวกรองจริงที่รอบ 08:30 ใช้", () => {
  const cutoff = at("07:30");
  const leaves = [
    // อยู่ในกล่องเช้าแล้ว
    { employeeId: "e1", start: YMD, end: YMD, createdAt: at("06:00") },
    // ตกหล่น — กดหลังสรุปเช้า
    { employeeId: "e2", start: YMD, end: YMD, createdAt: at("08:10") },
    // ตกหล่น + ลายาวคร่อมวันนี้
    {
      employeeId: "e3",
      start: "2026-08-30",
      end: "2026-09-03",
      createdAt: at("07:45"),
    },
    // เพิ่งกด แต่ลาสัปดาห์หน้า → ไม่เกี่ยวกับคนขาดวันนี้
    {
      employeeId: "e4",
      start: "2026-09-05",
      end: "2026-09-05",
      createdAt: at("08:20"),
    },
    // ใบเก่าไม่มี createdAt
    { employeeId: "e5", start: YMD, end: YMD },
  ];

  it("เหลือเฉพาะคนที่ขาดวันนี้ + กดหลังสรุปเช้า", () => {
    expect(
      pickLateLeaveDocs(leaves, YMD, cutoff).map((l) => l.employeeId),
    ).toEqual(["e2", "e3"]);
  });

  it("ไม่มีใครตกหล่น → array ว่าง (ตัวเรียกจะไม่ส่งข้อความ)", () => {
    expect(pickLateLeaveDocs([leaves[0], leaves[4]], YMD, cutoff)).toEqual([]);
  });
});
