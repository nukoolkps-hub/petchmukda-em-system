/* ─── LINE Login state ฝั่ง client ──────────────────────────────────
   เคสจริงที่ทำให้พนักงานพิมพ์ใบรับรองไม่ได้: กดพิมพ์ในมือถือ → LINE webview
   พิมพ์ไม่ได้ ระบบเด้งไปเบราว์เซอร์จริง → ที่นั่นยังไม่ login → กด LINE Login
   → กลับมาคนละ tab → state ที่เก็บไว้หาย → ขึ้น "State mismatch" ทั้งที่
   ไม่มีใครปลอมแปลง

   หลักที่ยึด: **ไม่เจอ ≠ ไม่ตรง**
   · ไม่เจอ = บริบทหาย → ปล่อยให้ server ตัดสิน (server consume state ใน
     Firestore txn · single-use · TTL — เป็นตัวกัน CSRF จริง)
   · ไม่ตรง = สัญญาณผิดปกติ → บล็อก                                        */

import { describe, expect, it } from "vitest";
import {
  checkReturnedState,
  LOGIN_STATE_TTL_MS,
  readSavedState,
  serializeState,
} from "./loginState";

const NOW = Date.parse("2026-09-01T10:00:00+07:00");

describe("checkReturnedState", () => {
  it("state ตรงกับที่เก็บไว้ → ผ่าน", () => {
    expect(checkReturnedState("abc", "abc")).toEqual({
      ok: true,
      reason: "matched",
    });
  });

  it("ไม่เจอ state ที่เก็บไว้ (เด้งข้ามเบราว์เซอร์) → ผ่าน ให้ server ตัดสิน", () => {
    expect(checkReturnedState("abc", null)).toEqual({
      ok: true,
      reason: "no-saved-state",
    });
  });

  it("เจอที่เก็บไว้แต่ไม่ตรง → บล็อก (สัญญาณโจมตีจริง)", () => {
    expect(checkReturnedState("evil", "abc")).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("เก็บไว้แต่ LINE ไม่ส่ง state กลับมา → บล็อก", () => {
    expect(checkReturnedState(null, "abc")).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });
});

describe("readSavedState — หมดอายุตาม TTL ของ server", () => {
  it("เพิ่งเก็บ → อ่านได้", () => {
    expect(readSavedState(serializeState("abc", NOW), NOW + 1000)).toBe("abc");
  });

  it("ถึง TTL พอดี → ยังอ่านได้", () => {
    const raw = serializeState("abc", NOW);
    expect(readSavedState(raw, NOW + LOGIN_STATE_TTL_MS)).toBe("abc");
  });

  it("เกิน TTL → ถือว่าไม่มี (ไม่เอา state ค้างมาเทียบ)", () => {
    const raw = serializeState("abc", NOW);
    expect(readSavedState(raw, NOW + LOGIN_STATE_TTL_MS + 1)).toBeNull();
  });

  it("ไม่มีค่า / ค่าพัง → null ไม่ throw", () => {
    expect(readSavedState(null)).toBeNull();
    expect(readSavedState("")).toBeNull();
    expect(readSavedState("{}")).toBeNull();
    expect(readSavedState('{"state":"","savedAt":1}')).toBeNull();
    expect(readSavedState('{"savedAt":1}')).toBeNull();
  });

  it("ค่าเก่าก่อนเปลี่ยน format (string ดิบ) → ยังอ่านได้ ไม่ทำให้ login พัง", () => {
    // ผู้ใช้ที่ค้าง state รูปแบบเดิมไว้ ต้อง login ต่อได้ ไม่ใช่เจอ mismatch
    expect(readSavedState("raw-state-value", NOW)).toBe("raw-state-value");
  });
});

describe("เคสจริง: เด้งข้ามเบราว์เซอร์แล้วพิมพ์ใบรับรอง", () => {
  it("state หายไปทั้งก้อน → login สำเร็จ ไม่โดนบล็อก", () => {
    // เบราว์เซอร์ใหม่ = storage ว่าง
    const saved = readSavedState(null);
    expect(checkReturnedState("state-from-line", saved).ok).toBe(true);
  });

  it("state ค้างจากรอบก่อนที่หมดอายุแล้ว → ไม่เอามาเทียบ (ไม่ทำให้พัง)", () => {
    const stale = serializeState("state-เก่า", NOW);
    const saved = readSavedState(stale, NOW + LOGIN_STATE_TTL_MS + 1);
    expect(saved).toBeNull();
    expect(checkReturnedState("state-ใหม่", saved).ok).toBe(true);
  });
});
