/* ─── Knowledge content types ──────────────────────────────────────
   เก็บเนื้อหา hard-code (ไม่ผ่าน Firestore) — กฎทอง/ค่าแรง/ค่าเปลี่ยน
   ฯลฯ ที่ใช้ในร้าน · structured เพื่อให้ render ได้ทุกแบบ (table,
   formula, ตัวอย่าง, รูปประกอบ) แทน raw HTML                          */

import type { LucideIcon } from "lucide-react";

export interface CalcField {
  id: string;
  label: string;
  defaultValue?: number;
  suffix?: string;
  /** dropdown — ถ้าใส่ จะ render เป็น select แทน number input */
  options?: { value: number; label: string }[];
  /** ตั้งค่าเริ่มต้นเป็นราคาทองคำแท่ง live (/config/goldPrice) — ยังพิมพ์แก้ได้
   *  ถ้า user ยังไม่แตะ field จะ sync ตามราคาที่ update อัตโนมัติ */
  goldPriceDefault?: boolean;
}

export interface CalcOutput {
  label: string;
  value: number;
  format?: "currency" | "number";
  /** sub-line อธิบายเพิ่ม (เช่น "ราคาทองคำ 99.99% ต่อกรัม") */
  hint?: string;
}

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
  | { type: "steps"; items: string[] }
  | {
      type: "calculator";
      title: string;
      inputs: CalcField[];
      compute: (values: Record<string, number>) => CalcOutput[];
    }
  | { type: "secret"; label: string; value: string }
  | { type: "change-price-table" };

export interface KnowledgeSection {
  id: string;
  title: string;
  Icon: LucideIcon;
  blocks: KnowledgeBlock[];
}
