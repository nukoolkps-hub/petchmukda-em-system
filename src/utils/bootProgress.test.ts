/* ─── Progress หน้า loading ตอน boot ───────────────────────────────────
   พังเงียบ: bar วิ่งไปแล้วเด้งกลับ 5% ตอนสลับจอ AuthGate → App (กระตุก)
   invariant:
   1. เริ่ม 5% · เพิ่มขึ้นเสมอ · ไม่ถึง 100% (ยังโหลดไม่เสร็จ)
   2. เส้นโค้ง 2 phase ต่อกันสนิท ไม่มีจุดกระโดด
   3. จอที่ขึ้นต่อจากจอเดิมทันที = ใช้เวลาเริ่มเดิม · โหลดรอบใหม่ = เริ่มใหม่ */

import { describe, expect, it } from "vitest";
import {
  BOOT_ANIMATION_MS,
  BOOT_HANDOFF_MS,
  BOOT_PROGRESS_START,
  bootKeyframesCss,
  bootProgressAt,
  claimBootClock,
  createBootClock,
  peekBootStart,
  releaseBootClock,
} from "./bootProgress";

describe("bootProgressAt", () => {
  it("เริ่มที่ 5% (เวลาติดลบก็ไม่ต่ำกว่านี้)", () => {
    expect(bootProgressAt(0)).toBe(BOOT_PROGRESS_START);
    expect(bootProgressAt(-500)).toBe(BOOT_PROGRESS_START);
  });

  it("เพิ่มขึ้นเสมอ และไม่ถึง 100%", () => {
    let prev = bootProgressAt(0);
    for (let t = 50; t <= BOOT_ANIMATION_MS * 2; t += 50) {
      const p = bootProgressAt(t);
      expect(p).toBeGreaterThanOrEqual(prev);
      expect(p).toBeLessThan(99.0001);
      prev = p;
    }
  });

  it("**ไม่มีจุดกระโดด** — ทุกช่วง 50ms ขยับไม่เกิน 4%", () => {
    for (let t = 0; t <= 20_000; t += 50) {
      expect(bootProgressAt(t + 50) - bootProgressAt(t)).toBeLessThan(4);
    }
  });

  it("phase 1 เร็ว (ถึงครึ่งทางในไม่ถึง 1.5 วิ) · phase 2 คลานถึง ~99%", () => {
    expect(bootProgressAt(1500)).toBeGreaterThan(50);
    expect(bootProgressAt(6000)).toBeGreaterThan(93);
    expect(bootProgressAt(BOOT_ANIMATION_MS)).toBeGreaterThan(98.9);
  });
});

describe("bootKeyframesCss", () => {
  const css = bootKeyframesCss("fill");

  it("เริ่ม 0% ที่ scaleX(0.05) จบ 100% ใกล้ 0.99", () => {
    expect(css.startsWith("@keyframes fill{")).toBe(true);
    expect(css).toContain("0.000%{transform:scaleX(0.0500)}");
    expect(css).toMatch(/100\.000%\{transform:scaleX\(0\.98\d\d\)\}/);
  });

  it("ค่า scaleX ในแต่ละ stop เพิ่มขึ้นเรื่อยๆ (bar ไม่ถอยหลัง)", () => {
    const scales = [...css.matchAll(/scaleX\(([\d.]+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(scales.length).toBeGreaterThan(20);
    for (let i = 1; i < scales.length; i += 1) {
      expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1]);
    }
  });
});

describe("boot clock — ต่อเนื่องข้ามจอ", () => {
  it("จอแรก = เริ่มนับจากตอนนี้", () => {
    const c = createBootClock();
    expect(peekBootStart(c, 1000)).toBe(1000);
    expect(claimBootClock(c, 1000)).toBe(1000);
  });

  it("**AuthGate → App** (จอใหม่ render ขณะจอเก่ายัง mount) = เวลาเริ่มเดิม", () => {
    const c = createBootClock();
    claimBootClock(c, 1000);
    // App render ตอนที่ AuthGate ยังไม่ unmount
    expect(peekBootStart(c, 3200)).toBe(1000);
    // commit: ตัวเก่า unmount ก่อน ตัวใหม่ mount ทีหลัง
    releaseBootClock(c, 3200);
    expect(claimBootClock(c, 3200)).toBe(1000);
  });

  it("StrictMode mount → unmount → mount ทันที = ไม่เริ่มใหม่", () => {
    const c = createBootClock();
    claimBootClock(c, 1000);
    releaseBootClock(c, 1000);
    expect(claimBootClock(c, 1001)).toBe(1000);
  });

  it("**โหลดรอบใหม่จริง** (หายไปนานกว่า handoff) = เริ่ม 5% ใหม่", () => {
    const c = createBootClock();
    claimBootClock(c, 1000);
    releaseBootClock(c, 4000);
    const later = 4000 + BOOT_HANDOFF_MS + 1;
    expect(peekBootStart(c, later)).toBe(later);
    expect(claimBootClock(c, later)).toBe(later);
  });

  it("peek ไม่แก้ clock", () => {
    const c = createBootClock();
    peekBootStart(c, 1000);
    expect(c).toEqual(createBootClock());
  });

  it("release เกินจำนวนที่ claim ไม่ติดลบ", () => {
    const c = createBootClock();
    releaseBootClock(c, 1000);
    expect(c.active).toBe(0);
  });
});
