import { describe, expect, it } from "vitest";
import {
  type DailySummaryGroupConfig,
  isValidLineTargetId,
  normalizeDailySummaryGroups,
} from "./dailySummaryGroups";

const GROUP_ID = "731807ff80bde798e0f8ab6bcfcd69c9"; // hex 32 ตัว
const gid = (prefix = "C") => `${prefix}${GROUP_ID}`;

describe("isValidLineTargetId", () => {
  it("รับ C (กลุ่ม) · R (ห้อง) · U (1:1)", () => {
    expect(isValidLineTargetId(gid("C"))).toBe(true);
    expect(isValidLineTargetId(gid("R"))).toBe(true);
    expect(isValidLineTargetId(gid("U"))).toBe(true);
  });

  it("ตัด space หัวท้ายให้ (ผู้ใช้ copy จาก LINE มักติดมา)", () => {
    expect(isValidLineTargetId(`  ${gid()}  `)).toBe(true);
  });

  it("ปฏิเสธรูปแบบผิด", () => {
    expect(isValidLineTargetId("")).toBe(false);
    expect(isValidLineTargetId(gid("X"))).toBe(false); // prefix ผิด
    expect(isValidLineTargetId(`C${GROUP_ID}ab`)).toBe(false); // ยาวเกิน
    expect(isValidLineTargetId(`C${GROUP_ID.slice(1)}`)).toBe(false); // สั้นไป
    expect(isValidLineTargetId(`C${GROUP_ID.toUpperCase()}`)).toBe(false); // hex ต้องพิมพ์เล็ก
    expect(isValidLineTargetId(null)).toBe(false);
    expect(isValidLineTargetId(12345)).toBe(false);
  });
});

describe("normalizeDailySummaryGroups", () => {
  const valid: DailySummaryGroupConfig = {
    lineTargetId: gid(),
    name: "we r mukda",
    calendarId: "abc@group.calendar.google.com",
    includeLeaves: true,
    sendAiTip: true,
    sendScheduledImage: true,
  };

  it("ไม่ใช่ array → []", () => {
    expect(normalizeDailySummaryGroups(undefined)).toEqual([]);
    expect(normalizeDailySummaryGroups(null)).toEqual([]);
    expect(normalizeDailySummaryGroups({})).toEqual([]);
  });

  it("ผ่านค่าที่ถูกต้องครบทุกฟิลด์", () => {
    expect(normalizeDailySummaryGroups([valid])).toEqual([valid]);
  });

  it("ตัดตัวที่ ID ผิดรูปแบบทิ้ง (กัน push ไป target มั่ว)", () => {
    const out = normalizeDailySummaryGroups([
      valid,
      { lineTargetId: "not-an-id", name: "พัง" },
      { name: "ไม่มี id" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].lineTargetId).toBe(gid());
  });

  it("ตัด ID ซ้ำ เก็บตัวแรก (ไม่งั้นกลุ่มเดียวได้ 2 ข้อความ)", () => {
    const out = normalizeDailySummaryGroups([valid, { ...valid, name: "ซ้ำ" }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("we r mukda");
  });

  it("trim ช่องว่าง + ไม่มีชื่อ → ใช้ 8 ตัวแรกของ ID", () => {
    const out = normalizeDailySummaryGroups([
      { lineTargetId: `  ${gid()}  `, name: "   " },
    ]);
    expect(out[0].lineTargetId).toBe(gid());
    expect(out[0].name).toBe(gid().slice(0, 8));
  });

  it("บังคับ flag ให้เป็น boolean จริง (ค่าจาก Firestore อาจเป็น string/undefined)", () => {
    const out = normalizeDailySummaryGroups([
      {
        lineTargetId: gid(),
        name: "x",
        sendAiTip: "yes",
        includeLeaves: 1,
      } as unknown as DailySummaryGroupConfig,
    ]);
    expect(out[0]).toMatchObject({
      sendAiTip: false,
      includeLeaves: false,
      sendScheduledImage: false,
    });
  });

  it("calendarId ว่าง → ไม่เขียน field (Firestore ไม่ต้องเก็บค่าว่าง)", () => {
    const out = normalizeDailySummaryGroups([
      { lineTargetId: gid(), name: "x", calendarId: "   " },
    ]);
    expect("calendarId" in out[0]).toBe(false);
  });

  it("คืน array ใหม่เสมอ ไม่แก้ของเดิม", () => {
    const input = [{ ...valid }];
    const out = normalizeDailySummaryGroups(input);
    out[0].name = "เปลี่ยนแล้ว";
    expect(input[0].name).toBe("we r mukda");
  });
});
