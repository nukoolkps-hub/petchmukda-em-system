/* ─── gate ของ section "adminOnly" ใน ความรู้ต่างๆ ─────────────────────
   พังเงียบ: ถ้า gate หลุด section ที่ตั้งใจให้เฉพาะ admin จะโผล่ให้พนักงาน
   เห็นโดยไม่มี error ใดๆ — เนื้อหาที่ไม่ควรรั่ว รั่วแล้วรั่วเลย

   ตอนนี้ยังไม่มี section ไหนตั้ง adminOnly (แบบทดสอบย้ายไปเป็นเมนู
   "ฝึกอบรม → แบบทดสอบ" ของตัวเองแล้ว) เทสต์จึงยิงกับ fixture สังเคราะห์
   เพื่อคุมพฤติกรรมของ gate ไว้ ไม่ผูกกับเนื้อหาชุดใดชุดหนึ่ง

   invariant:
   1. adminOnly section ต้องหายทั้งอันสำหรับคนที่ไม่ใช่ admin (ไม่ใช่แค่
      ซ่อน block — หัวข้อต้องไม่โผล่ ไม่งั้น search ก็ยังเจอชื่อ)
   2. undefined/false = ไม่ใช่ admin (default ต้องปลอดภัย ไม่ใช่เปิดทิ้งไว้)
   3. section ปกติต้องไม่ถูกกรองทิ้งไปด้วย                                 */

import { BookOpen } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_SECTIONS,
  visibleKnowledgeSections,
} from "../content/knowledge";
import type { KnowledgeSection } from "../content/knowledge/types";

const section = (id: string, adminOnly?: boolean): KnowledgeSection => ({
  id,
  title: id,
  Icon: BookOpen,
  adminOnly,
  blocks: [],
});

const FIXTURE: KnowledgeSection[] = [
  section("open-1"),
  section("secret", true),
  section("open-2", false),
];

const ids = (list: KnowledgeSection[], isAdmin: boolean | undefined) =>
  visibleKnowledgeSections(list, isAdmin).map((s) => s.id);

describe("visibleKnowledgeSections", () => {
  it("พนักงาน (false/undefined) ไม่เห็น section ที่ adminOnly", () => {
    expect(ids(FIXTURE, false)).toEqual(["open-1", "open-2"]);
    expect(ids(FIXTURE, undefined)).toEqual(["open-1", "open-2"]);
  });

  it("admin เห็นครบทุก section", () => {
    expect(ids(FIXTURE, true)).toEqual(["open-1", "secret", "open-2"]);
  });

  it("เนื้อหาจริง: พนักงานเห็นทุกอันที่ไม่ใช่ adminOnly", () => {
    const open = KNOWLEDGE_SECTIONS.filter((s) => !s.adminOnly).map(
      (s) => s.id,
    );
    expect(ids(KNOWLEDGE_SECTIONS, false)).toEqual(open);
    expect(open.length).toBeGreaterThan(0);
    expect(ids(KNOWLEDGE_SECTIONS, true)).toHaveLength(
      KNOWLEDGE_SECTIONS.length,
    );
  });
});
