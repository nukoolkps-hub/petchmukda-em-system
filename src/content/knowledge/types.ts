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
  /** ตั้งค่าเริ่มต้นเป็นราคารับซื้อทองคำแท่งสมาคม live (gold.buyPrice) */
  buyPriceDefault?: boolean;
  /** ตั้งค่าเริ่มต้นเป็นราคาเงินขายออก/กรัม live (gold.silverSellPerGram รวม VAT) */
  silverSellPriceDefault?: boolean;
  /** ตั้งค่าเริ่มต้นเป็นราคารับซื้อเงิน/กรัม live (gold.silverBuyPerGram) */
  silverBuyPriceDefault?: boolean;
  /** disable field แบบ conditional — เช่น ช่อง "%จริง" ปิดเมื่อเลือกโหมด
   *  "ทั่วไป" · UI จะเทาลง + กรอกแก้ไม่ได้ */
  disabledWhen?: (values: Record<string, number>) => boolean;
}

export interface CalcOutput {
  label: string;
  value: number;
  format?: "currency" | "number";
  /** ทศนิยมสูงสุด (เฉพาะ format="number") — default 2 */
  decimals?: number;
  /** sub-line อธิบายเพิ่ม (เช่น "ราคาทองคำ 99.99% ต่อกรัม") */
  hint?: string;
}

export type KnowledgeBlock =
  | { type: "h3"; text: string }
  | { type: "p"; text: string; muted?: boolean; adminOnly?: boolean }
  | { type: "list"; items: string[]; ordered?: boolean }
  | {
      type: "table";
      columns: string[];
      rows: string[][];
      note?: string;
      /** จัดวางคอลัมน์ (parallel array) — default ทุกคอลัมน์ = "left" */
      colAlign?: ("left" | "center" | "right")[];
      /** กำหนดความกว้างคอลัมน์ explicit (เช่น ["60%", "40%"]) — ใช้กับ
       *  ตาราง 2+ ใบที่อยู่ติดกัน เพื่อให้คอลัมน์ตรงกัน (table-fixed) */
      colWidths?: string[];
    }
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
  | { type: "change-price-table" }
  | { type: "sell-price-96-table" }
  | { type: "buy-price-96-table" }
  | { type: "labor-cost-table" }
  | {
      /** เหมือน example แต่ "โจทย์" + steps คำนวณจากราคาทองวันนี้
       *  → ไม่ outdated เมื่อราคาทองขยับ */
      type: "live-example";
      title: string;
      compute: (gold: { sell: number; buy: number; silverBuy: number }) => {
        given: string[];
        steps: { calc: string; meaning: string }[];
      };
    };

export interface KnowledgeSection {
  id: string;
  title: string;
  Icon: LucideIcon;
  blocks: KnowledgeBlock[];
}
