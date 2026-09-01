/* ─── การ์ด "คำสั่ง" ต้องลิสต์คำสั่งครบทุกตัวที่ bot รับจริง ──────────
   คำสั่งใหม่ถูกลงทะเบียนที่ `line/core/dispatcher.ts` แต่ข้อความที่ admin
   เห็นอยู่คนละไฟล์ (`line/commands/help.ts`) → เพิ่มคำสั่งแล้วลืมเติมในการ์ด
   = admin ไม่มีทางรู้ว่ามีคำสั่งนี้ ไม่มี error ไม่มีเทสต์แดง (เจอมาแล้ว)

   เทสต์นี้อ่าน source ตรงๆ ไม่ได้เช็ค logic — กันแค่ "ลืมเขียนถึง"          */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DISPATCHER = "functions/src/line/core/dispatcher.ts";
const HELP = "functions/src/line/commands/help.ts";
const CMD_DIR = "functions/src/line/commands";

/** ไฟล์คำสั่งที่ dispatcher import เข้ามาจริง (ตัว help เองไม่ต้องนับซ้ำ) */
function registeredCommandFiles(dispatcher: string): string[] {
  return [...dispatcher.matchAll(/from "\.\.\/commands\/(\w+)\.js"/g)].map(
    (m) => m[1],
  );
}

/** ชื่อคำสั่งของไฟล์นั้น = `name:` ตัวแรกหลัง `export const xxxCommand`
 *  · รองรับ `name: TRIGGER` โดย resolve const ในไฟล์เดียวกัน            */
function commandName(source: string): string | null {
  const start = source.search(/export const \w+Command\b/);
  if (start === -1) return null;
  const m = /name:\s*(?:"([^"]+)"|(\w+))/.exec(source.slice(start));
  if (!m) return null;
  if (m[1]) return m[1];
  const constMatch = new RegExp(`const ${m[2]}\\s*=\\s*"([^"]+)"`).exec(source);
  return constMatch ? constMatch[1] : null;
}

describe("การ์ดคำสั่ง LINE", () => {
  const dispatcher = readFileSync(DISPATCHER, "utf8");
  const help = readFileSync(HELP, "utf8");
  const files = registeredCommandFiles(dispatcher);

  it("อ่าน dispatcher ได้ครบ (sanity — ไม่งั้นเทสต์ผ่านฟรี)", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
    expect(files).toContain("previewLateLeave");
  });

  it("ทุกคำสั่งที่ลงทะเบียนไว้ ต้องมีในการ์ด 'คำสั่ง'", () => {
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(`${CMD_DIR}/${file}.ts`, "utf8");
      const name = commandName(source);
      expect(name, `อ่านชื่อคำสั่งจาก ${file}.ts ไม่ได้`).toBeTruthy();
      if (name && !help.includes(name)) missing.push(`${name} (${file}.ts)`);
    }
    expect(missing, "คำสั่งที่ยังไม่ได้เขียนถึงในการ์ด").toEqual([]);
  });
});
