/* ─── ปุ่มบน header ต้องมีครบทั้ง mobile และ desktop ────────────────────
   แอปมี header 2 ตัวที่สลับกันด้วย CSS ล้วนๆ:
   · `MobileHeader`  — desktop ซ่อนด้วย `.leave-header-mobile { display: none }`
   · `DesktopHeader` — mobile ซ่อนด้วย `.leave-desktop-header { display: none }`

   เพิ่มปุ่มไว้แค่ตัวเดียว = ผู้ใช้อีกครึ่งหนึ่งหาปุ่มไม่เจอ · ไม่ throw
   ไม่มีเทสต์แดง — รู้ตัวตอนพนักงานมาถามเท่านั้น

   เจอมาแล้ว: ปุ่ม "ใบรับรอง" (หน้าเงินเดือน) อยู่แต่ใน MobileHeader →
   พนักงานที่เข้าจาก PC พิมพ์ใบรับรองเงินเดือนไม่ได้เลย

   เทสต์นี้เทียบ 2 อย่างที่ตรวจจาก source ได้ตรงๆ:
   1. custom event ที่ header ยิง (`window.dispatchEvent(new CustomEvent(...))`)
   2. ข้อความบนปุ่ม (`title="..."`)                                          */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MOBILE = "src/components/layout/MobileHeader.tsx";
const DESKTOP = "src/components/layout/DesktopHeader.tsx";

const mobileSrc = readFileSync(MOBILE, "utf8");
const desktopSrc = readFileSync(DESKTOP, "utf8");

/** ชื่อ custom event ที่ไฟล์นี้ยิงออกไป */
function dispatchedEvents(source: string): string[] {
  return [
    ...source.matchAll(/new CustomEvent\(\s*"([^"]+)"/g),
    ...source.matchAll(/new CustomEvent\(\s*'([^']+)'/g),
  ].map((m) => m[1]);
}

/** ข้อความ tooltip ของปุ่ม — ใช้แทน "รายการ action ที่ header มี" */
function buttonTitles(source: string): string[] {
  return [...source.matchAll(/\btitle="([^"]+)"/g)].map((m) => m[1]);
}

/** action ที่ตั้งใจให้มีเฉพาะ mobile (ไม่มีที่ทางบน desktop)
 *  · desktop แก้โปรไฟล์จาก sidebar แทน (profile strip อยู่ที่นั่น) */
const MOBILE_ONLY_TITLES = new Set<string>([]);

/** action ที่ตั้งใจให้มีเฉพาะ desktop */
const DESKTOP_ONLY_TITLES = new Set<string>([]);

describe("header mobile/desktop มีปุ่มตรงกัน", () => {
  it("อ่าน source ทั้งสองไฟล์ได้ (sanity — ไม่งั้นเทสต์ผ่านฟรี)", () => {
    expect(buttonTitles(mobileSrc).length).toBeGreaterThan(1);
    expect(buttonTitles(desktopSrc).length).toBeGreaterThan(1);
  });

  it('ปุ่ม "ใบรับรอง" มีทั้งสอง header (พนักงานเข้าจาก PC ต้องเจอ)', () => {
    expect(dispatchedEvents(mobileSrc)).toContain("openSalaryCert");
    expect(dispatchedEvents(desktopSrc)).toContain("openSalaryCert");
  });

  it("custom event ที่ header ยิง ต้องมีครบทั้งสองฝั่ง", () => {
    const mobile = new Set(dispatchedEvents(mobileSrc));
    const desktop = new Set(dispatchedEvents(desktopSrc));

    expect(
      [...mobile].filter((e) => !desktop.has(e)),
      "MobileHeader ยิง event ที่ DesktopHeader ไม่มี → ผู้ใช้ PC กดไม่ได้",
    ).toEqual([]);
    expect(
      [...desktop].filter((e) => !mobile.has(e)),
      "DesktopHeader ยิง event ที่ MobileHeader ไม่มี → ผู้ใช้มือถือกดไม่ได้",
    ).toEqual([]);
  });

  it("tooltip ของปุ่ม ต้องมีครบทั้งสองฝั่ง", () => {
    const mobile = new Set(buttonTitles(mobileSrc));
    const desktop = new Set(buttonTitles(desktopSrc));

    expect(
      [...mobile].filter((t) => !desktop.has(t) && !MOBILE_ONLY_TITLES.has(t)),
      "ปุ่มนี้มีแต่บนมือถือ — เพิ่มใน DesktopHeader หรือใส่ MOBILE_ONLY_TITLES",
    ).toEqual([]);
    expect(
      [...desktop].filter((t) => !mobile.has(t) && !DESKTOP_ONLY_TITLES.has(t)),
      "ปุ่มนี้มีแต่บน PC — เพิ่มใน MobileHeader หรือใส่ DESKTOP_ONLY_TITLES",
    ).toEqual([]);
  });
});
