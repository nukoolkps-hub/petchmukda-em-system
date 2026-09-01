/* ─── "มีคนลาเพิ่ม" 08:30 — เลือกเฉพาะคนที่ตกหล่นจากสรุปเช้า ─────────
   logic อยู่ฝั่ง server (functions/src/dailySummary/lateLeaves.ts) แต่เป็น
   pure TS ไม่มี dependency กับ firebase จึง import ข้ามมาเทสต์ได้ตรงๆ
   (pattern เดียวกับ dutyCoverageExclusive.test.ts)

   invariant ที่ยึด:
   1. แจ้งเฉพาะคนที่กด "หลัง" สรุปเช้า — ไม่ส่งซ้ำคนที่อยู่ในกล่องเช้าแล้ว
   2. ใบลาเก่าที่ไม่มี createdAt ต้องไม่ถูกนับเป็นของใหม่ (ไม่งั้นสแปมทุกวัน
      ตลอดช่วงที่คนนั้นลายาว)
   3. cutoff ยึด claimedAt ของสรุปเช้า · ไม่มี doc → 07:30 ของวันนั้น        */

import { describe, expect, it } from "vitest";
import {
  fetchLateLeaves,
  isLateLeave,
  resolveLateCutoffMs,
} from "../../functions/src/dailySummary/lateLeaves";

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

/* ─── fetchLateLeaves — กรอง + join ชื่อเล่น (fake Firestore) ─────── */

/** พารามิเตอร์ตัวแรกของ fetchLateLeaves — ดึงจาก signature ตรงๆ เพื่อไม่ต้อง
 *  import type จาก firebase-admin (ไม่ได้อยู่ใน tsconfig ฝั่ง src/) */
type FakeFirestore = Parameters<typeof fetchLateLeaves>[0];

interface FakeDoc {
  id: string;
  data: () => Record<string, unknown>;
}

/** db ปลอมเล็กๆ พอให้ fetchTodayLeaveDocs + toLeaveItems ทำงาน
 *  (leaves ใช้ .where("end", ">=", ymd).get() · employees ใช้ .get()) */
function fakeDb(
  leaves: Record<string, unknown>[],
  employees: Record<string, Record<string, unknown>>,
): FakeFirestore {
  const toDocs = (rows: Record<string, unknown>[]): FakeDoc[] =>
    rows.map((r, i) => ({ id: String(r.id ?? i), data: () => r }));
  return {
    collection: (name: string) => {
      if (name === "employees") {
        return {
          get: async () => ({
            docs: Object.entries(employees).map(([id, data]) => ({
              id,
              data: () => data,
            })),
          }),
        };
      }
      return {
        where: (_f: string, _op: string, ymd: string) => ({
          get: async () => ({
            docs: toDocs(leaves.filter((l) => String(l.end || "") >= ymd)),
          }),
        }),
      };
    },
  } as unknown as FakeFirestore;
}

describe("fetchLateLeaves", () => {
  const cutoff = at("07:30");
  const EMPLOYEES = {
    e1: { nickname: "น้ำ", name: "อพิตญา" },
    e2: { nickname: "เนม", name: "ณัฐพล" },
    e3: { nickname: "ดาว", name: "ดวงดาว" },
  };

  it("คืนเฉพาะคนที่ลาวันนี้ + กดหลังสรุปเช้า พร้อมชื่อเล่น", () => {
    const db = fakeDb(
      [
        // อยู่ในกล่องเช้าแล้ว
        {
          employeeId: "e1",
          start: YMD,
          end: YMD,
          type: "personal",
          createdAt: at("06:00"),
        },
        // ตกหล่น — กดหลังสรุปเช้า
        {
          employeeId: "e2",
          start: YMD,
          end: YMD,
          type: "sick",
          createdAt: at("08:10"),
        },
        // ตกหล่น + ลายาวคร่อมวันนี้
        {
          employeeId: "e3",
          start: "2026-08-30",
          end: "2026-09-03",
          type: "personal",
          createdAt: at("07:45"),
        },
      ],
      EMPLOYEES,
    );
    return fetchLateLeaves(db, YMD, cutoff).then((items) => {
      expect(items.map((i) => i.nickname)).toEqual(["เนม", "ดาว"]);
      expect(items[0].kindLabel).toBe("ลาป่วย");
      expect(items[1].kindLabel).toBe("ลากิจ");
    });
  });

  it("ใบลาของวันอื่น แม้เพิ่งกด ก็ไม่นับ (สนใจแค่คนขาดวันนี้)", async () => {
    const db = fakeDb(
      [
        {
          employeeId: "e2",
          start: "2026-09-05",
          end: "2026-09-05",
          type: "personal",
          createdAt: at("08:10"),
        },
      ],
      EMPLOYEES,
    );
    expect(await fetchLateLeaves(db, YMD, cutoff)).toEqual([]);
  });

  it("ไม่มีใครตกหล่น → array ว่าง (ตัวเรียกจะไม่ส่งข้อความ)", async () => {
    const db = fakeDb(
      [
        {
          employeeId: "e1",
          start: YMD,
          end: YMD,
          type: "personal",
          createdAt: at("06:00"),
        },
      ],
      EMPLOYEES,
    );
    expect(await fetchLateLeaves(db, YMD, cutoff)).toEqual([]);
  });
});
