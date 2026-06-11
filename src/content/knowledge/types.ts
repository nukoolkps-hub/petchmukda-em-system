/* ─── Knowledge content types ──────────────────────────────────────
   เก็บเนื้อหา hard-code (ไม่ผ่าน Firestore) — กฎทอง/ค่าแรง/ค่าเปลี่ยน
   ฯลฯ ที่ใช้ในร้าน · structured เพื่อให้ render ได้ทุกแบบ (table,
   formula, ตัวอย่าง, รูปประกอบ) แทน raw HTML                          */

import type { LucideIcon } from "lucide-react";

export type KnowledgeBlock =
  | { type: "h3"; text: string }
  | { type: "p"; text: string; muted?: boolean }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; columns: string[]; rows: string[][]; note?: string }
  | { type: "formula"; label?: string; formula: string; result?: string }
  | {
      type: "example";
      title: string;
      given: string[];
      steps: { calc: string; meaning: string }[];
    }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "callout"; tone: "info" | "warn" | "note"; text: string }
  | { type: "steps"; items: string[] };

export interface KnowledgeSection {
  id: string;
  title: string;
  Icon: LucideIcon;
  blocks: KnowledgeBlock[];
}
