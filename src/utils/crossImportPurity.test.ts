/* ─── เทสต์ฝั่ง src/ ที่ import ข้ามไป functions/ ต้องแตะไฟล์ "บริสุทธิ์" ──
   CI รัน `npm ci` เฉพาะ root — **ไม่ลง `functions/node_modules`** ดังนั้น
   `tsc` ที่ root resolve `firebase-admin` / `firebase-functions` ไม่ได้
   แต่บนเครื่องนักพัฒนามันมีอยู่ → typecheck ผ่านที่บ้าน พังบน CI
   (เกิดจริงแล้ว: PR #785 merge เข้า main แล้ว deploy ล้ม ฟังก์ชันไม่ขึ้น)

   เทสต์นี้เดิน import graph จากทุกไฟล์ functions/ ที่ src/ เทสต์ import มา
   แล้วฟ้องถ้าเจอ dependency ที่ CI ไม่มี · ต้องแยก logic บริสุทธิ์ออกมา
   ไว้ไฟล์ที่ไม่ import อะไรเลย (เช่น `dailySummary/leaveRules.ts`) แล้วให้
   เทสต์ import ไฟล์นั้นแทน                                                 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = "src/utils";
/** package ที่อยู่ใน functions/package.json เท่านั้น — root ไม่มี */
const FUNCTIONS_ONLY = /^(firebase-admin|firebase-functions|googleapis)\b/;

const importsOf = (source: string): string[] =>
  [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);

/** แปลง specifier สัมพัทธ์ (".../x.js") → path ไฟล์ .ts จริง */
function resolveLocal(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec).replace(/\.js$/, "");
  for (const candidate of [`${base}.ts`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** ไล่ import ต่อเนื่องจาก entry → คืน package ต้องห้ามที่เจอ + ทางที่เดินมา */
function findForbidden(entry: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const walk = (file: string, trail: string[]) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const spec of importsOf(source)) {
      if (FUNCTIONS_ONLY.test(spec)) {
        found.push(`${spec} ← ${[...trail, file].join(" → ")}`);
        continue;
      }
      const next = resolveLocal(file, spec);
      if (next) walk(next, [...trail, file]);
    }
  };
  walk(entry, []);
  return found;
}

describe("เทสต์ src/ ที่ import ข้ามไป functions/", () => {
  const testFiles = readdirSync(SRC_DIR).filter((f) => f.endsWith(".test.ts"));
  const entries = new Set<string>();
  for (const file of testFiles) {
    const full = join(SRC_DIR, file);
    for (const spec of importsOf(readFileSync(full, "utf8"))) {
      if (spec.includes("functions/src/")) {
        const target = resolveLocal(full, spec);
        if (target) entries.add(target);
      }
    }
  }

  it("เจอไฟล์ที่ import ข้ามจริง (sanity — ไม่งั้นเทสต์ผ่านฟรี)", () => {
    expect(entries.size).toBeGreaterThan(0);
  });

  it("ไม่มีไฟล์ไหนลาก firebase-admin / firebase-functions เข้ามา", () => {
    const problems: string[] = [];
    for (const entry of entries) problems.push(...findForbidden(entry));
    expect(
      problems,
      "CI ไม่ได้ลง functions/node_modules → tsc ที่ root จะพัง",
    ).toEqual([]);
  });
});
