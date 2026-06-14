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
  /** ตัวคูณกับ live buy price (ใช้คู่ buyPriceDefault) — เช่น 0.98 สำหรับ
   *  "ราคารับซื้อคืน (VAT)" = buy × 98% */
  buyPriceMultiplier?: number;
  /** read-only — user แก้ไม่ได้ · sync live ตลอดเวลา (กัน touched flag)
   *  ใช้กับ field ที่คำนวณ auto จากค่าอื่น (เช่น VAT buyback) */
  readOnly?: boolean;
  /** ตั้งค่าเริ่มต้นเป็นราคาเงินขายออก/กรัม live (gold.silverSellPerGram รวม VAT) */
  silverSellPriceDefault?: boolean;
  /** ตั้งค่าเริ่มต้นเป็นราคารับซื้อเงิน/กรัม live (gold.silverBuyPerGram) */
  silverBuyPriceDefault?: boolean;
  /** disable field แบบ conditional — เช่น ช่อง "%จริง" ปิดเมื่อเลือกโหมด
   *  "ทั่วไป" · UI จะเทาลง + กรอกแก้ไม่ได้ */
  disabledWhen?: (values: Record<string, number>) => boolean;
  /** ซ่อน field จาก UI ทั้งหมด แต่ค่ายังอยู่ใน values (ใช้ใน compute) ·
   *  ปกติคู่กับ readOnly + buyPriceDefault — input ที่ผู้ใช้ไม่ต้องเห็น
   *  ค่ายัง sync live · compute เอาไปใช้แสดงผลใน output */
  hidden?: boolean;
}

export interface CalcOutput {
  label: string;
  value: number;
  format?: "currency" | "number";
  /** ทศนิยมสูงสุด (เฉพาะ format="number") — default 2 */
  decimals?: number;
  /** หน่วยต่อท้ายตัวเลข (เช่น "กรัม") — เฉพาะ format="number" */
  unit?: string;
  /** sub-line อธิบายเพิ่ม (เช่น "ราคาทองคำ 99.99% ต่อกรัม") */
  hint?: string;
}

export type KnowledgeBlock =
  | {
      type: "h3";
      text: string;
      /** สี header · default = text-maroon + gold border line
       *  · "maroon" = pill bg-maroon · "silver" = pill bg-silver
       *  · "gradient" = pill bg-maroon เหลือบ silver
       *  · "silver-text" = text-silver + silver border line (ไม่มี pill) */
      tone?: "maroon" | "silver" | "gradient" | "silver-text";
    }
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
      /** สี header แถวบนสุด · default "maroon" · "silver" สำหรับตารางเงิน ·
       *  "gradient" = maroon เหลือบ silver (ทองเหลือบเงิน) */
      tone?: "maroon" | "silver" | "gradient";
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
      /** สี header การ์ด · default "gold" (gold-pale) · "silver" สำหรับเงิน */
      tone?: "gold" | "silver";
      inputs: CalcField[];
      compute: (values: Record<string, number>) => CalcOutput[];
    }
  | { type: "secret"; label: string; value: string }
  | { type: "change-price-table" }
  | { type: "sell-price-96-table" }
  | { type: "buy-price-96-table" }
  | { type: "labor-cost-table" }
  | { type: "block-cost-table" }
  | { type: "loyalty-points-redeem-table" }
  | { type: "date-diff-helper" }
  | { type: "pawn-interest-card" }
  | {
      /** เหมือน example แต่ "โจทย์" + steps คำนวณจากราคาทองวันนี้
       *  → ไม่ outdated เมื่อราคาทองขยับ */
      type: "live-example";
      title: string;
      /** สี header การ์ด · default "maroon" (สำหรับทอง) · "silver" สำหรับเงิน */
      tone?: "maroon" | "silver";
      compute: (gold: {
        sell: number;
        buy: number;
        silverBuy: number;
        /** ค่าแรง 1 บาท จาก labor cost table · sync live · ใช้ใน VAT example */
        laborBaht: number;
        /** ค่าแรงรายน้ำหนัก (key = weightId เช่น "1-saleung", "1-baht")
         *  ใช้แทน hardcode ค่าแรงในตัวอย่าง · admin แก้ตาราง → sync ทันที */
        labor: Record<string, number>;
      }) => {
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
