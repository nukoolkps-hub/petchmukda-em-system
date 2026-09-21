/* ─── gate ของ section "adminOnly" ใน ความรู้ต่างๆ ─────────────────────
   พังเงียบ: ถ้า gate หลุด พนักงานจะเห็น "แบบทดสอบความรู้พื้นฐาน" ล่วงหน้า
   โดยไม่มี error ใดๆ — ข้อสอบจริงที่ใช้วัดคน รั่วแล้วรั่วเลย

   invariant:
   1. adminOnly section ต้องหายทั้งอันสำหรับคนที่ไม่ใช่ admin (ไม่ใช่แค่
      ซ่อน block — หัวข้อต้องไม่โผล่ ไม่งั้น search ก็ยังเจอชื่อ)
   2. undefined/false = ไม่ใช่ admin (default ต้องปลอดภัย ไม่ใช่เปิดทิ้งไว้)
   3. section ปกติต้องไม่ถูกกรองทิ้งไปด้วย                                 */

import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_SECTIONS,
  visibleKnowledgeSections,
} from "../content/knowledge";

const EXAM_ID = "basic-exam";
const ids = (isAdmin: boolean | undefined) =>
  visibleKnowledgeSections(KNOWLEDGE_SECTIONS, isAdmin).map((s) => s.id);

describe("visibleKnowledgeSections", () => {
  it("พนักงาน (false/undefined) ไม่เห็น section ที่ adminOnly", () => {
    expect(ids(false)).not.toContain(EXAM_ID);
    expect(ids(undefined)).not.toContain(EXAM_ID);
  });

  it("admin เห็นครบทุก section", () => {
    expect(ids(true)).toContain(EXAM_ID);
    expect(ids(true)).toHaveLength(KNOWLEDGE_SECTIONS.length);
  });

  it("section ปกติไม่ถูกกรองทิ้ง — พนักงานเห็นทุกอันที่ไม่ใช่ adminOnly", () => {
    const open = KNOWLEDGE_SECTIONS.filter((s) => !s.adminOnly).map(
      (s) => s.id,
    );
    expect(ids(false)).toEqual(open);
    expect(open.length).toBeGreaterThan(0);
  });
});

describe("แบบทดสอบความรู้พื้นฐาน — เนื้อหาครบตามต้นฉบับ", () => {
  const exam = KNOWLEDGE_SECTIONS.find((s) => s.id === EXAM_ID);

  it("มีอยู่จริงและถูกทำเครื่องหมาย adminOnly", () => {
    expect(exam).toBeDefined();
    expect(exam?.adminOnly).toBe(true);
  });

  it("โจทย์หลัก 30 ข้อ + ความรู้รอบตัว 6 ข้อ · ไม่มีข้อว่าง", () => {
    const lists = (exam?.blocks ?? []).filter((b) => b.type === "list");
    expect(lists.map((b) => (b as { items: string[] }).items.length)).toEqual([
      30, 6,
    ]);
    for (const b of lists) {
      for (const item of (b as { items: string[] }).items) {
        expect(item.trim().length).toBeGreaterThan(10);
      }
    }
  });
});
