/* ─── Knowledge sections (ฉบับปี 2569) ───────────────────────────
   เนื้อหามาจาก "ความรู้ต่างๆ" ของห้างเพชรทองมุกดา · hard-code ไม่ผ่าน
   Firestore เพราะอัปเดตน้อย + กระชับกฎเดียวกันทั้งระบบ · แก้ที่นี่
   commit + push → auto deploy                                       */

import {
  BadgePercent as IconBadgePercent,
  Banknote as IconBanknote,
  Calculator as IconCalculator,
  Coins as IconCoins,
  CreditCard as IconCreditCard,
  ArrowRightLeft as IconExchange,
  Eye as IconEye,
  Gauge as IconGauge,
  Gem as IconGem,
  Landmark as IconLandmark,
  Package as IconPackage,
  Percent as IconPercent,
  Receipt as IconReceipt,
  Repeat as IconRepeat,
  Replace as IconReplace,
  Scissors as IconScissors,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Star as IconStar,
  Tag as IconTag,
  Wallet as IconWallet,
  Weight as IconWeight,
} from "lucide-react";
import {
  CHANGE_PRICE_WEIGHTS,
  computeChangePriceBreakdown,
} from "../../utils/changePriceUtils";
import type { KnowledgeSection } from "./types";

/** ช่วยหาค่าเปลี่ยน "นน. เท่ากัน เริ่มต้น" ของน้ำหนักใดน้ำหนักหนึ่ง
 *  (ปัดทวีคูณ 50 แล้ว) — ใช้ในตัวอย่าง "การคำนวณค่าเปลี่ยน เพิ่มขึ้น" */
function changePriceFor(weightId: string, sellPrice: number): number {
  const w = CHANGE_PRICE_WEIGHTS.find((it) => it.id === weightId);
  if (!w) return 0;
  return computeChangePriceBreakdown(w, sellPrice).total;
}

export const KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  /* ── 1. มาตรฐานน้ำหนัก ── */
  {
    id: "weights",
    title: "มาตรฐานน้ำหนัก (สคบ.)",
    Icon: IconWeight,
    blocks: [
      { type: "h3", text: "น้ำหนักทองแท่ง" },
      {
        type: "table",
        columns: ["น้ำหนัก", "กรัม", "น้ำหนัก", "กรัม"],
        colWidths: ["25%", "25%", "25%", "25%"],
        colAlign: ["left", "right", "left", "right"],
        rows: [
          ["½ สลึง", "1.905", "5 บาท", "76.22"],
          ["1 สลึง", "3.811", "6 บาท", "91.464"],
          ["2 สลึง", "7.622", "7 บาท", "106.708"],
          ["1 บาท", "15.244", "8 บาท", "121.952"],
          ["2 บาท", "30.488", "9 บาท", "137.196"],
          ["3 บาท", "45.732", "10 บาท", "152.44"],
          ["4 บาท", "60.976", "", ""],
        ],
      },
      { type: "h3", text: "น้ำหนักทองรูปพรรณ" },
      {
        type: "table",
        columns: ["น้ำหนัก", "กรัม", "น้ำหนัก", "กรัม"],
        colWidths: ["25%", "25%", "25%", "25%"],
        colAlign: ["left", "right", "left", "right"],
        rows: [
          ["0.6 กรัม", "0.6", "3 บาท", "45.48"],
          ["1 กรัม", "1", "4 บาท", "60.64"],
          ["½ สลึง", "1.895", "5 บาท", "75.8"],
          ["1 สลึง", "3.79", "6 บาท", "90.96"],
          ["2 สลึง", "7.58", "7 บาท", "106.12"],
          ["3 สลึง", "11.37", "8 บาท", "121.28"],
          ["1 บาท", "15.16", "9 บาท", "136.44"],
          ["6 สลึง", "22.74", "10 บาท", "151.6"],
          ["2 บาท", "30.32", "", ""],
        ],
      },
    ],
  },

  /* ── 2. ค่าแรง ── */
  {
    id: "labor-cost",
    title: "ค่าแรง เริ่มต้น (ทอง 96.5%)",
    Icon: IconTag,
    blocks: [
      {
        type: "p",
        text: "ราคาเริ่มต้นของค่าแรง สำหรับทองรูปพรรณ 96.5%",
      },
      {
        type: "table",
        columns: ["น้ำหนัก", "ค่าแรงเริ่มต้น (฿)"],
        colWidths: ["60%", "40%"],
        colAlign: ["left", "right"],
        rows: [
          ["0.6 กรัม", "450"],
          ["1 กรัม", "550"],
          ["½ สลึง", "650"],
          ["1 สลึง", "750"],
          ["2 สลึง", "850"],
          ["3 สลึง", "950"],
          ["1 บาท", "1,050"],
          ["6 สลึง", "1,900"],
          ["2 บาท ขึ้นไป", "บาทละ 1,050"],
        ],
      },
      { type: "h3", text: "ค่าแรงเพิ่มจากป้าย MD" },
      {
        type: "table",
        columns: ["ป้าย MD", "ราคาเพิ่มจากเริ่มต้น (฿)"],
        colWidths: ["60%", "40%"],
        colAlign: ["left", "right"],
        rows: [
          ["MD-01", "+ 100"],
          ["MD-02", "+ 200"],
          ["MD-03", "+ 300"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "1 MD ที่เพิ่มขึ้น มีค่าเท่ากับ 100 บาท",
      },
    ],
  },

  /* ── 3a. ราคาขายทอง 99.99% ── */
  {
    id: "sell-price-9999",
    title: "การคำนวณราคาขาย (ทอง 99.99%)",
    Icon: IconSparkles,
    blocks: [
      {
        type: "formula",
        label: "ตามน้ำหนัก (ต่อกรัม)",
        formula: "(ราคาทอง + 3.6%) × 0.0656 + ค่าแรง = ราคาขาย/กรัม",
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — ค่าแรง 1,250 ฿ · ทอง 1.28 กรัม",
        compute: ({ sell }) => {
          const labor = 1250;
          const grams = 1.28;
          const gold9999 = sell * 1.036;
          const perGram = gold9999 * 0.0656;
          const sellPerGram = perGram + labor;
          const total = sellPerGram * grams;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคาทองคำแท่งบาทละ ${fmt(sell)} ฿`,
              `ค่าแรง ${fmt(labor)} ฿`,
              `ทองหนัก ${grams} กรัม`,
            ],
            steps: [
              {
                calc: `${fmt(sell)} + 3.6% = ${fmt(gold9999)}`,
                meaning: "ราคาทองคำ 99.99%",
              },
              {
                calc: `${fmt(gold9999)} × 0.0656 = ${fmt(perGram)}`,
                meaning: "ราคาทองคำ 99.99% ต่อกรัม",
              },
              {
                calc: `${fmt(perGram)} + ${fmt(labor)} = ${fmt(sellPerGram)}`,
                meaning: "ราคาขายต่อกรัม หลัง + ค่าแรง",
              },
              {
                calc: `${fmt(sellPerGram)} × ${grams} = ${fmt(total)}`,
                meaning: "ราคาขายต่อชิ้น",
              },
            ],
          };
        },
      },
      {
        type: "calculator",
        title: "ราคาขายทอง 99.99%",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿",
            goldPriceDefault: true,
          },
          { id: "labor", label: "ค่าแรง", defaultValue: 1250, suffix: "฿" },
          { id: "grams", label: "น้ำหนัก", defaultValue: 1.28, suffix: "ก." },
        ],
        compute: ({ gold, labor, grams }) => {
          const gold9999 = gold * 1.036;
          const perGram = gold9999 * 0.0656;
          const sellPerGram = perGram + labor;
          const total = sellPerGram * grams;
          return [
            { label: "ราคาทองคำ 99.99%", value: gold9999, format: "currency" },
            { label: "ราคา 99.99% ต่อกรัม", value: perGram, format: "currency" },
            {
              label: "ราคาขายต่อกรัม (+ ค่าแรง)",
              value: sellPerGram,
              format: "currency",
            },
            {
              label: "ราคาขายต่อชิ้น",
              value: total,
              format: "currency",
              hint: `${sellPerGram.toFixed(2)} × ${grams} กรัม`,
            },
          ];
        },
      },
    ],
  },

  /* ── 3b. ราคาขายทอง 96.5% ── */
  {
    id: "sell-price-965",
    title: "การคำนวณราคาขาย (ทอง 96.5%)",
    Icon: IconShoppingBag,
    blocks: [
      {
        type: "table",
        columns: ["น้ำหนัก", "วิธีคำนวณ"],
        colWidths: ["25%", "75%"],
        colAlign: ["left", "left"],
        rows: [
          ["0.6 กรัม", "(ราคาทอง × 0.0656 × 0.6) + ค่าแรง = ราคาขาย"],
          ["1 กรัม", "(ราคาทอง × 0.0656 × 1) + ค่าแรง = ราคาขาย"],
          ["½ สลึง", "(ราคาทอง ÷ 8) + ค่าแรง = ราคาขาย"],
          ["1 สลึง", "(ราคาทอง ÷ 4) + ค่าแรง = ราคาขาย"],
          ["2 สลึง", "(ราคาทอง ÷ 2) + ค่าแรง = ราคาขาย"],
          ["3 สลึง", "(ราคาทอง × 0.75) + ค่าแรง = ราคาขาย"],
          ["1 บาท", "ราคาทอง + ค่าแรง = ราคาขาย"],
          ["6 สลึง", "(ราคาทอง × 1.5) + ค่าแรง = ราคาขาย"],
          ["2 บาท ขึ้นไป", "(ราคาทอง + ค่าแรงต่อบาท) × จำนวนบาท = ราคาขาย"],
          ["ทั่วไป", "(ราคาทอง × 0.0656 × น้ำหนักสินค้า) + ค่าแรง = ราคาขาย"],
        ],
      },
      { type: "sell-price-96-table" },
      {
        type: "calculator",
        title: "ราคาขายทอง 96.5% ทั่วไป",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿",
            goldPriceDefault: true,
          },
          { id: "labor", label: "ค่าแรง", defaultValue: 1050, suffix: "฿" },
          { id: "grams", label: "น้ำหนัก", defaultValue: 3.79, suffix: "ก." },
        ],
        compute: ({ gold, labor, grams }) => {
          const goldPart = gold * 0.0656 * grams;
          const total = goldPart + labor;
          return [
            {
              label: "ราคาทองตามน้ำหนัก",
              value: goldPart,
              format: "currency",
              hint: `${gold} × 0.0656 × ${grams}`,
            },
            { label: "ราคาขาย (+ ค่าแรง)", value: total, format: "currency" },
          ];
        },
      },
    ],
  },

  /* ── 3c. ราคาขายนาก ── */
  {
    id: "sell-price-nak",
    title: "การคำนวณราคาขาย (นาก)",
    Icon: IconStar,
    blocks: [
      {
        type: "formula",
        label: "ทั่วไป",
        formula: "(ราคาทอง ÷ 2) × 0.0656 × น้ำหนักสินค้า + ค่าแรง = ราคาขาย",
      },
      {
        type: "calculator",
        title: "ราคาขายนาก",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿",
            goldPriceDefault: true,
          },
          { id: "grams", label: "น้ำหนัก", defaultValue: 3.79, suffix: "ก." },
          { id: "labor", label: "ค่าแรง", defaultValue: 500, suffix: "฿" },
        ],
        compute: ({ gold, grams, labor }) => {
          const half = gold / 2;
          const goldPart = half * 0.0656 * grams;
          return [
            {
              label: "ราคาทอง ÷ 2",
              value: half,
              format: "currency",
              hint: `${gold} ÷ 2`,
            },
            {
              label: "ราคาทองตามน้ำหนัก",
              value: goldPart,
              format: "currency",
              hint: `${half} × 0.0656 × ${grams}`,
            },
            {
              label: "ราคาขาย (+ ค่าแรง)",
              value: goldPart + labor,
              format: "currency",
            },
          ];
        },
      },
    ],
  },

  /* ── 3c2. ราคาขายเงิน ── */
  {
    id: "sell-price-silver",
    title: "การคำนวณราคาขาย (เงิน)",
    Icon: IconCoins,
    blocks: [
      {
        type: "formula",
        label: "ทั่วไป",
        formula: "(ราคาเงินต่อกรัม × น้ำหนักสินค้า) + ค่าแรง = ราคาขาย",
      },
      {
        type: "calculator",
        title: "ราคาขายเงิน",
        inputs: [
          { id: "rate", label: "ราคาเงิน/กรัม", defaultValue: 30, suffix: "฿" },
          { id: "grams", label: "น้ำหนัก", defaultValue: 15, suffix: "ก." },
          { id: "labor", label: "ค่าแรง", defaultValue: 200, suffix: "฿" },
        ],
        compute: ({ rate, grams, labor }) => [
          {
            label: "ราคาเงินตามน้ำหนัก",
            value: rate * grams,
            format: "currency",
          },
          {
            label: "ราคาขาย (+ ค่าแรง)",
            value: rate * grams + labor,
            format: "currency",
          },
        ],
      },
    ],
  },

  /* ── 3d. การอ่านป้ายสินค้า ── */
  {
    id: "price-tag",
    title: "การอ่านป้ายสินค้า",
    Icon: IconEye,
    blocks: [
      {
        type: "p",
        text: "ป้ายสินค้าแสดงราคาขายต่อชิ้น และค่าแรงขายต่อชิ้น — ใช้ประกอบการคำนวณ",
      },
      {
        type: "image",
        src: "/knowledge/price-tag-diagram.webp",
        alt: "ตัวอย่างป้ายสินค้า",
        caption: "ป้ายแสดงราคาขายต่อชิ้น (บน) และค่าแรงขายต่อชิ้น (ล่าง)",
      },
    ],
  },

  /* ── 3.5 ค่าเปลี่ยน นน. เท่ากัน เริ่มต้น ── */
  {
    id: "change-price",
    title: "ค่าเปลี่ยน นน. เท่ากัน เริ่มต้น (ทอง 96.5%)",
    Icon: IconRepeat,
    blocks: [
      {
        type: "p",
        text: "ค่าเปลี่ยนระหว่างน้ำหนักเท่ากัน — อิงราคาทองวันนี้ อัปเดตอัตโนมัติ",
      },
      { type: "change-price-table" },
    ],
  },

  /* ── 4. ค่าเปลี่ยน ── */
  {
    id: "exchange",
    title: "การคำนวณค่าเปลี่ยน เพิ่มขึ้น - ลดลง (ทอง 96.5%)",
    Icon: IconExchange,
    blocks: [
      { type: "h3", text: "น้ำหนักเพิ่มขึ้น 0.6 กรัม ถึง 2 สลึง" },
      {
        type: "formula",
        formula: "ราคาทองของน้ำหนักที่เพิ่ม + ค่าแรงของน้ำหนักที่เพิ่ม (MD) + ค่าเปลี่ยนทองเก่า",
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — 1 สลึง เพิ่มเป็น 2 สลึง (MD-03)",
        compute: ({ sell }) => {
          const oldChange = changePriceFor("1-saleung", sell);
          const newLabor = 750;
          const md = 300;
          const goldPart = sell / 4;
          const total = goldPart + (newLabor + md) + oldChange;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ค่าเปลี่ยน 1 สลึง (จากตาราง) = ${fmt(oldChange)} ฿`,
              `ราคาทองคำแท่งบาทละ ${fmt(sell)} ฿`,
            ],
            steps: [
              {
                calc: `(${fmt(sell)} ÷ 4) + (${newLabor} + ${md}) + ${fmt(oldChange)} = ${fmt(total)} ฿`,
                meaning: "ราคาค่าเปลี่ยน",
              },
            ],
          };
        },
      },
      {
        type: "callout",
        tone: "note",
        text: "เพิ่มค่า MD เฉพาะค่าแรง (เคสน้ำหนักเพิ่มไม่เกิน 2 สลึง)",
      },
      { type: "h3", text: "น้ำหนักเพิ่มขึ้น 1 บาท ขึ้นไป" },
      {
        type: "formula",
        formula:
          "ราคาทองของน้ำหนักที่เพิ่ม + ค่าแรงของน้ำหนักที่เพิ่ม (MD) + ค่าเปลี่ยนทองเก่า (MD)",
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — 1 บาท เพิ่มเป็น 2 บาท (MD-03)",
        compute: ({ sell }) => {
          const oldChange = changePriceFor("1-baht", sell);
          const newLabor = 1050;
          const md = 300;
          const total = sell + (newLabor + md) + (oldChange + md);
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ค่าเปลี่ยน 1 บาท (จากตาราง) = ${fmt(oldChange)} ฿`,
              `ราคาทองคำแท่งบาทละ ${fmt(sell)} ฿`,
            ],
            steps: [
              {
                calc: `${fmt(sell)} + (${newLabor} + ${md}) + (${fmt(oldChange)} + ${md}) = ${fmt(total)} ฿`,
                meaning: "ราคาค่าเปลี่ยน",
              },
            ],
          };
        },
      },
      {
        type: "callout",
        tone: "note",
        text: "เพิ่มค่า MD ทั้งค่าแรง และค่าเปลี่ยน (เคสน้ำหนักเพิ่ม 1 บาทขึ้นไป)",
      },
      { type: "h3", text: "น้ำหนักลดลง" },
      {
        type: "p",
        text: "รับซื้อทองเก่าก่อน แล้วจึงนำเงินที่ได้มาหักลบกับราคาขายทองใหม่",
      },
    ],
  },

  /* ── ส่วนลด ── */
  {
    id: "discounts",
    title: "ส่วนลด",
    Icon: IconBadgePercent,
    blocks: [
      { type: "h3", text: "ส่วนลดค่าแรง + ค่าเปลี่ยน (ทอง 96.5%)" },
      {
        type: "list",
        items: [
          "ค่าแรง — ปกติลด 15% · HBD ลด 25%",
          "ค่าเปลี่ยน — ปกติลด 5% · HBD ลด 5%",
        ],
      },
      { type: "h3", text: "ส่วนลดสำหรับทอง 90" },
      {
        type: "list",
        items: ["ต่างหูแผง 10%", "พระแผง 10%", "แหวนพลอย 10%", "กรอบพระ 10%"],
      },
    ],
  },

  /* ── 5a0. รับซื้อทอง 99.99% ── */
  {
    id: "buy-price-9999",
    title: "การคำนวณราคารับซื้อ (ทอง 99.99%)",
    Icon: IconSparkles,
    blocks: [
      {
        type: "table",
        columns: ["กรณี", "วิธีคำนวณ"],
        colWidths: ["25%", "75%"],
        colAlign: ["left", "left"],
        rows: [
          ["ทั่วไป", "(ราคาทอง − 5-7%) × 0.0656 × น้ำหนัก = ราคารับซื้อ"],
        ],
      },
      {
        type: "calculator",
        title: "ราคารับซื้อทอง 99.99%",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿",
            goldPriceDefault: true,
          },
          {
            id: "discount",
            label: "หัก %",
            defaultValue: 5,
            options: [
              { value: 5, label: "หัก 5%" },
              { value: 6, label: "หัก 6%" },
              { value: 7, label: "หัก 7%" },
            ],
          },
          { id: "grams", label: "น้ำหนัก", defaultValue: 1, suffix: "ก." },
        ],
        compute: ({ gold, discount, grams }) => {
          const base = gold * (1 - discount / 100);
          const buy = base * 0.0656 * grams;
          return [
            {
              label: "ราคาทองหลังหัก %",
              value: base,
              format: "currency",
              hint: `${gold} − ${discount}%`,
            },
            {
              label: "ราคารับซื้อ",
              value: buy,
              format: "currency",
              hint: `× 0.0656 × ${grams} ก.`,
            },
          ];
        },
      },
    ],
  },

  /* ── 5a. รับซื้อทอง 96.5% ── */
  {
    id: "buy-price-965",
    title: "การคำนวณราคารับซื้อ (ทอง 96.5%)",
    Icon: IconBanknote,
    blocks: [
      {
        type: "table",
        columns: ["น้ำหนัก", "วิธีคำนวณ"],
        colWidths: ["25%", "75%"],
        colAlign: ["left", "left"],
        rows: [
          ["0.6 กรัม", "(ราคาทอง − 5-7%) × 0.0656 × 0.6 = ราคารับซื้อ"],
          ["1 กรัม", "(ราคาทอง − 5-7%) × 0.0656 × 1 = ราคารับซื้อ"],
          ["½ สลึง", "(ราคาทอง − 5-7%) × 0.0656 × 1.895 = ราคารับซื้อ"],
          ["1 สลึง", "(ราคาทอง − 5-7%) × 0.0656 × 3.79 = ราคารับซื้อ"],
          ["2 สลึง", "(ราคาทอง − 5-7%) × 0.0656 × 7.58 = ราคารับซื้อ"],
          ["3 สลึง", "(ราคาทอง − 5-7%) × 0.0656 × 11.37 = ราคารับซื้อ"],
          ["1 บาท", "(ราคาทอง − 5-7%) × 0.0656 × 15.16 = ราคารับซื้อ"],
          ["6 สลึง", "(ราคาทอง − 5-7%) × 0.0656 × 22.74 = ราคารับซื้อ"],
          ["2 บาท ขึ้นไป", "(ราคาทอง − 5-7%) × 0.0656 × จำนวนน้ำหนัก = ราคารับซื้อ"],
          ["ทั่วไป", "(ราคาทอง − 5-7%) × 0.0656 × น้ำหนัก = ราคารับซื้อ"],
        ],
      },
      { type: "buy-price-96-table" },
      {
        type: "calculator",
        title: "ราคารับซื้อทอง 96.5%",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿",
            goldPriceDefault: true,
          },
          {
            id: "discount",
            label: "หัก %",
            defaultValue: 5,
            options: [
              { value: 5, label: "หัก 5%" },
              { value: 6, label: "หัก 6%" },
              { value: 7, label: "หัก 7%" },
            ],
          },
          { id: "grams", label: "น้ำหนัก", defaultValue: 3.79, suffix: "ก." },
        ],
        compute: ({ gold, discount, grams }) => {
          const base = gold * (1 - discount / 100);
          const buy = base * 0.0656 * grams;
          return [
            {
              label: "ราคาทองหลังหัก %",
              value: base,
              format: "currency",
              hint: `${gold} − ${discount}%`,
            },
            {
              label: "ราคารับซื้อ",
              value: buy,
              format: "currency",
              hint: `× 0.0656 × ${grams} ก.`,
            },
          ];
        },
      },
    ],
  },

  /* ── 5b. รับซื้อทอง 90 ── */
  {
    id: "buy-price-90",
    title: "การคำนวณราคารับซื้อ (ทอง 90)",
    Icon: IconBanknote,
    blocks: [
      {
        type: "table",
        columns: ["กรณี", "วิธีคำนวณ"],
        colWidths: ["30%", "70%"],
        colAlign: ["left", "left"],
        rows: [
          ["ทั่วไป", "(ราคาทอง × 60%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ"],
          [
            "มีการตรวจ %",
            "(ราคาทอง × (%จริง − 10)) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ",
          ],
        ],
      },
      {
        type: "calculator",
        title: "ราคารับซื้อทอง 90",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿",
            goldPriceDefault: true,
          },
          {
            id: "mode",
            label: "เลือกวิธี",
            defaultValue: 60,
            options: [
              { value: 60, label: "ทั่วไป (60%)" },
              { value: 999, label: "มีตรวจ %" },
            ],
          },
          {
            id: "realPct",
            label: "% จริง (ถ้าตรวจ)",
            defaultValue: 78,
            suffix: "%",
            disabledWhen: ({ mode }) => mode !== 999,
          },
          { id: "grams", label: "น้ำหนัก", defaultValue: 3.79, suffix: "ก." },
        ],
        compute: ({ gold, mode, realPct, grams }) => {
          const factor = mode === 999 ? (realPct - 10) / 100 : 0.6;
          const buy = gold * factor * 0.0656 * grams;
          return [
            {
              label: "ราคารับซื้อ",
              value: buy,
              format: "currency",
              hint:
                mode === 999
                  ? `${gold} × (${realPct}−10)% × 0.0656 × ${grams}`
                  : `${gold} × 60% × 0.0656 × ${grams}`,
            },
          ];
        },
      },
    ],
  },

  /* ── 5c. รับซื้อนาก ── */
  {
    id: "buy-price-nak",
    title: "การคำนวณราคารับซื้อ (นาก)",
    Icon: IconBanknote,
    blocks: [
      {
        type: "table",
        columns: ["กรณี", "วิธีคำนวณ"],
        colWidths: ["30%", "70%"],
        colAlign: ["left", "left"],
        rows: [
          ["ทั่วไป", "(ราคาทอง × 25%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ"],
          [
            "มีการตรวจ %",
            "(ราคาทอง × (%จริง − 10)) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ",
          ],
        ],
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — นาก 1 สลึง (3.79 กรัม)",
        compute: ({ sell }) => {
          const grams = 3.79;
          const general = sell * 0.25 * 0.0656 * grams;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคาทองคำแท่งบาทละ ${fmt(sell)} ฿`,
              `น้ำหนัก ${grams} กรัม`,
              "กรณี: ทั่วไป (25%)",
            ],
            steps: [
              {
                calc: `${fmt(sell)} × 25% = ${fmt(sell * 0.25)}`,
                meaning: "ราคาทองหลังหัก 75%",
              },
              {
                calc: `${fmt(sell * 0.25)} × 0.0656 × ${grams} = ${fmt(general)} ฿`,
                meaning: "ราคารับซื้อนาก",
              },
            ],
          };
        },
      },
      {
        type: "calculator",
        title: "ราคารับซื้อนาก",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿",
            goldPriceDefault: true,
          },
          {
            id: "mode",
            label: "เลือกวิธี",
            defaultValue: 25,
            options: [
              { value: 25, label: "ทั่วไป (25%)" },
              { value: 999, label: "มีตรวจ %" },
            ],
          },
          {
            id: "realPct",
            label: "% จริง (ถ้าตรวจ)",
            defaultValue: 35,
            suffix: "%",
            disabledWhen: ({ mode }) => mode !== 999,
          },
          { id: "grams", label: "น้ำหนัก", defaultValue: 3.79, suffix: "ก." },
        ],
        compute: ({ gold, mode, realPct, grams }) => {
          const factor = mode === 999 ? (realPct - 10) / 100 : 0.25;
          const buy = gold * factor * 0.0656 * grams;
          return [
            {
              label: "ราคารับซื้อ",
              value: buy,
              format: "currency",
              hint:
                mode === 999
                  ? `${gold} × (${realPct}−10)% × 0.0656 × ${grams}`
                  : `${gold} × 25% × 0.0656 × ${grams}`,
            },
          ];
        },
      },
    ],
  },

  /* ── 5d. รับซื้อเงิน ── */
  {
    id: "buy-price-silver",
    title: "การคำนวณราคารับซื้อ (เงิน)",
    Icon: IconBanknote,
    blocks: [
      {
        type: "formula",
        label: "ทั่วไป",
        formula: "ราคาเงินต่อกรัม × น้ำหนักสินค้า = ราคารับซื้อ",
      },
      {
        type: "calculator",
        title: "ราคารับซื้อเงิน",
        inputs: [
          { id: "rate", label: "ราคาเงิน/กรัม", defaultValue: 30, suffix: "฿" },
          { id: "grams", label: "น้ำหนัก", defaultValue: 15, suffix: "ก." },
        ],
        compute: ({ rate, grams }) => [
          {
            label: "ราคารับซื้อ",
            value: rate * grams,
            format: "currency",
            hint: `${rate} × ${grams}`,
          },
        ],
      },
    ],
  },

  /* ── 6. ค่าบล็อก ── */
  {
    id: "block-cost",
    title: "ค่าบล็อก (ทองคำแท่ง / เงินแท่ง)",
    Icon: IconPackage,
    blocks: [
      { type: "h3", text: "ทองคำแท่ง" },
      {
        type: "table",
        columns: ["น้ำหนัก", "ค่าบล็อก (฿)"],
        colWidths: ["55%", "45%"],
        colAlign: ["left", "right"],
        rows: [
          ["0.05 กรัม – 1 บาท", "300 / 350 / 450"],
          ["2 บาท", "500 / 600 / 900"],
          ["5 บาท", "1,000"],
          ["10 บาท", "1,000"],
          ["1 กิโล", "6,500"],
        ],
      },
      {
        type: "table",
        columns: ["น้ำหนัก (ค่าส่ง)", "ค่าส่ง (฿)"],
        colWidths: ["55%", "45%"],
        colAlign: ["left", "right"],
        rows: [
          ["0.05 กรัม – 10 บาท", "60"],
          ["1 กิโล", "200"],
        ],
      },
      { type: "h3", text: "เงินแท่ง" },
      {
        type: "table",
        columns: ["น้ำหนัก", "ค่าบล็อก (฿)"],
        colWidths: ["55%", "45%"],
        colAlign: ["left", "right"],
        rows: [
          ["½ สลึง – 1 บาท", "350"],
          ["5 บาท", "500"],
          ["10 บาท", "700"],
          ["20 บาท", "1,000"],
          ["1 กิโล", "2,000"],
        ],
      },
      {
        type: "table",
        columns: ["น้ำหนัก (ค่าส่ง)", "ค่าส่ง (฿)"],
        colWidths: ["55%", "45%"],
        colAlign: ["left", "right"],
        rows: [
          ["1 บาท – 10 บาท", "60"],
          ["20 บาท", "100"],
          ["1 กิโล", "200"],
        ],
      },
      { type: "h3", text: "ค่าประกัน" },
      {
        type: "list",
        items: ["1.5% ของราคาสินค้า", "ประกันราคาสินค้ามากสุด 200,000 บาท"],
      },
    ],
  },

  /* ── 7. จำนำ ── */
  {
    id: "pawn-price",
    title: "การคำนวณราคาจำนำ",
    Icon: IconLandmark,
    blocks: [
      {
        type: "table",
        columns: ["ประเภท", "อัตราหัก"],
        colWidths: ["25%", "75%"],
        colAlign: ["left", "left"],
        rows: [
          ["ทอง 99.99%", "หัก 15-20% จากราคารับซื้อทองคำแท่ง"],
          ["ทอง 96.5%", "หัก 15-20% จากราคารับซื้อทองคำแท่ง"],
          [
            "ทอง 90",
            "หัก 40-50% จากราคารับซื้อทองคำแท่ง · หากมีการตรวจ % หักจาก % ที่ได้จากเครื่องตรวจ 25%",
          ],
          [
            "นาก",
            "หัก 80-85% จากราคารับซื้อทองคำแท่ง · หากมีการตรวจ % หักจาก % ที่ได้จากเครื่องตรวจ 25%",
          ],
        ],
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — ทอง 96.5% หัก 17.5%",
        compute: ({ buy }) => {
          const rate = 0.175;
          const pawn = buy * (1 - rate);
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคารับซื้อทองคำแท่งวันนี้ ${fmt(buy)} ฿/บาท`,
              `อัตราหัก 17.5% (เฉลี่ย 15-20%)`,
            ],
            steps: [
              {
                calc: `${fmt(buy)} × 82.5% = ${fmt(pawn)} ฿`,
                meaning: "ราคาจำนำต่อบาท",
              },
            ],
          };
        },
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — ทอง 90 หัก 45% (ทั่วไป)",
        compute: ({ buy }) => {
          const rate = 0.45;
          const pawn = buy * (1 - rate);
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคารับซื้อทองคำแท่งวันนี้ ${fmt(buy)} ฿/บาท`,
              `อัตราหัก 45% (เฉลี่ย 40-50%)`,
            ],
            steps: [
              {
                calc: `${fmt(buy)} × 55% = ${fmt(pawn)} ฿`,
                meaning: "ราคาจำนำต่อบาท",
              },
            ],
          };
        },
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — ทอง 90 มีตรวจ % (%จริง 60%)",
        compute: ({ buy }) => {
          const realPct = 60;
          const effective = realPct - 25;
          const pawn = buy * (effective / 100);
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคารับซื้อทองคำแท่งวันนี้ ${fmt(buy)} ฿/บาท`,
              `%จริง จากเครื่องตรวจ = ${realPct}%`,
              `หัก 25% จาก %จริง → ใช้ ${effective}%`,
            ],
            steps: [
              {
                calc: `${realPct}% − 25% = ${effective}%`,
                meaning: "อัตราที่ใช้คำนวณ",
              },
              {
                calc: `${fmt(buy)} × ${effective}% = ${fmt(pawn)} ฿`,
                meaning: "ราคาจำนำต่อบาท",
              },
            ],
          };
        },
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — นาก หัก 82.5% (ทั่วไป)",
        compute: ({ buy }) => {
          const rate = 0.825;
          const pawn = buy * (1 - rate);
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคารับซื้อทองคำแท่งวันนี้ ${fmt(buy)} ฿/บาท`,
              `อัตราหัก 82.5% (เฉลี่ย 80-85%)`,
            ],
            steps: [
              {
                calc: `${fmt(buy)} × 17.5% = ${fmt(pawn)} ฿`,
                meaning: "ราคาจำนำต่อบาท",
              },
            ],
          };
        },
      },
    ],
  },

  /* ── 7b. ดอกเบี้ยจำนำ ── */
  {
    id: "pawn-interest",
    title: "การคำนวณดอกเบี้ยจำนำ",
    Icon: IconPercent,
    blocks: [
      {
        type: "list",
        items: [
          "ดอกเบี้ยปกติ 1.5% ต่อเดือน",
          "แบ่ง 2 ช่วง — 1-15 วัน 0.75% / 16-31 วัน 1.5%",
          "ดอกเบี้ยขั้นต่ำ 30 บาท",
        ],
      },
      {
        type: "example",
        title: "ตัวอย่าง — จำนำ 1,500 ฿ เป็นเวลา 1 เดือน 13 วัน",
        given: ["เงินจำนำ 1,500 ฿", "ระยะเวลา 1 เดือน 13 วัน"],
        steps: [
          {
            calc: "1 เดือน → 1,500 × 1.5% = 22.50 ฿",
            meaning: "ปรับขั้นต่ำเป็น 30 ฿",
          },
          {
            calc: "13 วัน → 1,500 × 0.75% = 11.25 ฿",
            meaning: "ปรับขั้นต่ำเป็น 30 ฿",
          },
          { calc: "30 + 30 = 60 ฿", meaning: "ดอกเบี้ยที่ลูกค้าต้องเสียทั้งหมด" },
        ],
      },
      {
        type: "calculator",
        title: "ดอกเบี้ยจำนำ (รวมขั้นต่ำ 30 ฿)",
        inputs: [
          {
            id: "principal",
            label: "เงินจำนำ",
            defaultValue: 1500,
            suffix: "฿",
          },
          {
            id: "months",
            label: "ระยะเวลา (เดือนเต็ม)",
            defaultValue: 1,
            suffix: "ด.",
          },
          {
            id: "extraDays",
            label: "วันเศษ (0-31)",
            defaultValue: 13,
            suffix: "ว.",
          },
        ],
        compute: ({ principal, months, extraDays }) => {
          let total = 0;
          for (let i = 0; i < months; i++) {
            total += Math.max(30, principal * 0.015);
          }
          if (extraDays > 0) {
            const rate = extraDays <= 15 ? 0.0075 : 0.015;
            total += Math.max(30, principal * rate);
          }
          return [
            { label: "ดอกเบี้ยรวมทั้งหมด", value: total, format: "currency" },
            {
              label: "ยอดที่ต้องจ่ายเพื่อไถ่",
              value: principal + total,
              format: "currency",
            },
          ];
        },
      },
    ],
  },

  /* ── 8. แต้มสะสม ── */
  {
    id: "points",
    title: "แต้มสะสม",
    Icon: IconStar,
    blocks: [
      { type: "h3", text: "แต้มจากรายการขาย" },
      {
        type: "table",
        columns: ["น้ำหนัก", "แต้ม"],
        colWidths: ["60%", "40%"],
        colAlign: ["left", "right"],
        rows: [
          ["½ สลึง", "0.5"],
          ["1 สลึง", "1"],
          ["2 สลึง", "1"],
          ["3 สลึง", "1"],
          ["1 บาท", "1"],
          ["6 สลึง", "2"],
          ["2 บาท ขึ้นไป", "บาทละ 1 แต้ม"],
        ],
      },
      { type: "h3", text: "แต้มจากรายการเปลี่ยน" },
      {
        type: "table",
        columns: ["เปลี่ยนจาก → เป็น", "แต้ม"],
        colWidths: ["60%", "40%"],
        colAlign: ["left", "right"],
        rows: [
          ["1 บาท → 1 บาท", "1"],
          ["2 บาท → 3 บาท", "3"],
          ["3 บาท → 5 บาท", "5"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "คำนวณจากน้ำหนักสินค้าที่ขาย",
      },
      { type: "h3", text: "สะสมแต้ม แลก ทองคำแท่ง" },
      {
        type: "table",
        columns: ["แต้มที่ใช้", "ได้รับทองคำแท่ง"],
        colWidths: ["40%", "60%"],
        colAlign: ["left", "right"],
        rows: [
          ["20 แต้ม", "0.3 กรัม"],
          ["35 แต้ม", "0.6 กรัม"],
          ["55 แต้ม", "1.0 กรัม"],
          ["100 แต้ม", "1.905 กรัม (½ สลึง)"],
          ["190 แต้ม", "3.811 กรัม (1 สลึง)"],
        ],
      },
    ],
  },

  /* ── 9. แยกชิ้น ── */
  {
    id: "split",
    title: "แยกชิ้นจากใบแชร์",
    Icon: IconScissors,
    blocks: [
      {
        type: "table",
        columns: ["จาก", "แยกเป็น", "เพิ่มเงิน (+ MD แยกชิ้น)"],
        colWidths: ["20%", "50%", "30%"],
        colAlign: ["left", "center", "right"],
        rows: [
          ["1 สลึง", "½ สลึง × 2 ชิ้น", "450 ฿"],
          ["2 สลึง", "1 สลึง × 2 ชิ้น", "550 ฿"],
          ["2 สลึง", "½ สลึง × 4 ชิ้น", "1,350 ฿"],
          ["1 บาท", "2 สลึง × 2 ชิ้น", "650 ฿"],
          ["1 บาท", "1 สลึง × 4 ชิ้น", "1,950 ฿"],
        ],
      },
      {
        type: "example",
        title: "ตัวอย่าง",
        given: [
          "2 สลึง แยกเป็น 1 สลึง × 2 ชิ้น",
          "ชิ้นที่ 1 (MD-03) · ชิ้นที่ 2 (MD-08)",
          "เพิ่มเงิน (ในตาราง) = 550 ฿",
        ],
        steps: [
          {
            calc: "550 + 300 (ชิ้นที่ 1) + 800 (ชิ้นที่ 2) = 1,650 ฿",
            meaning: "เพิ่มเงิน + MD แยกชิ้นแต่ละชิ้น",
          },
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "MD แยกชิ้น: MD-XX = XX × 100 ฿ (เช่น MD-03 = 300, MD-08 = 800) — บวกเพิ่มต่อชิ้นตามที่ระบุ",
      },
    ],
  },

  /* ── 9b. การเปลี่ยนฟรี ── */
  {
    id: "free-exchange",
    title: "การเปลี่ยนฟรี",
    Icon: IconReplace,
    blocks: [
      {
        type: "callout",
        tone: "warn",
        text: "เปลี่ยนฟรีได้ ภายใน 7 วัน ต้องมีใบรับประกันจากทางร้าน เท่านั้น",
      },
      {
        type: "list",
        items: [
          "หากเปลี่ยน MD เท่ากัน หรือ ถูกกว่า ไม่ต้องเพิ่มเงิน",
          "หากเปลี่ยน MD มากกว่า ต้องเพิ่มเงิน เท่ากับ MD เส้นใหม่",
        ],
      },
    ],
  },

  /* ── 10. ผ่อนสินค้าบัตรเครดิต ── */
  {
    id: "installment",
    title: "ผ่อนสินค้าด้วยบัตรเครดิต",
    Icon: IconCreditCard,
    blocks: [
      { type: "h3", text: "สูตรคำนวณ" },
      {
        type: "list",
        items: [
          "ราคาที่รูดจริง = ราคาขาย × 3% (ค่าธรรมเนียม)",
          "ดอกเบี้ยต่อเดือน = ราคารูดจริง × % ดอกเบี้ย",
          "รายจ่ายต่อเดือน = (ราคารูดจริง ÷ จำนวนเดือนผ่อน) + ดอกเบี้ยต่อเดือน",
        ],
      },
      {
        type: "example",
        title: "ตัวอย่าง — ราคา 18,000 ฿ · ดอกเบี้ย 1.2% · 6 เดือน",
        given: ["ราคาขาย 18,000 ฿", "ดอกเบี้ย 1.2%", "จำนวนเดือนผ่อน 6 เดือน"],
        steps: [
          { calc: "18,000 × 3% = 18,540 ฿", meaning: "ราคาที่ใช้รูดจริง" },
          { calc: "18,540 × 1.2% = 222.48 ฿", meaning: "ดอกเบี้ยต่อเดือน" },
          {
            calc: "(18,540 ÷ 6) + 222.48 = 3,312.48 ฿",
            meaning: "รายจ่ายต่อเดือน",
          },
          { calc: "3,312.48 × 6 = 19,874.88 ฿", meaning: "รายจ่ายทั้งหมด" },
        ],
      },
      {
        type: "calculator",
        title: "ผ่อนสินค้าด้วยบัตรเครดิต",
        inputs: [
          { id: "price", label: "ราคาขาย", defaultValue: 18000, suffix: "฿" },
          {
            id: "ratePct",
            label: "ดอกเบี้ย/เดือน",
            defaultValue: 1.2,
            suffix: "%",
          },
          {
            id: "months",
            label: "จำนวนเดือนผ่อน",
            defaultValue: 6,
            suffix: "ด.",
          },
        ],
        compute: ({ price, ratePct, months }) => {
          const swiped = price * 1.03;
          const interest = swiped * (ratePct / 100);
          const perMonth = swiped / months + interest;
          const total = perMonth * months;
          return [
            {
              label: "ราคาที่ใช้รูดจริง",
              value: swiped,
              format: "currency",
              hint: `${price} × 3%`,
            },
            { label: "ดอกเบี้ย/เดือน", value: interest, format: "currency" },
            { label: "รายจ่าย/เดือน", value: perMonth, format: "currency" },
            { label: "รายจ่ายทั้งหมด", value: total, format: "currency" },
          ];
        },
      },
    ],
  },

  /* ── 11. รูดบัตรเป็นเงินสด ── */
  {
    id: "cash-out",
    title: "รูดบัตรเปลี่ยนเป็นเงินสด",
    Icon: IconWallet,
    blocks: [
      {
        type: "callout",
        tone: "info",
        text: "หัก 5% จากยอดรูดเต็ม (ค่าธรรมเนียมธนาคาร 3% + ค่าธรรมเนียมร้านค้า 2%)",
      },
      {
        type: "example",
        title: "ตัวอย่าง — รูด 50,000 ฿",
        given: ["จำนวนรูด 50,000 ฿", "จำนวนหัก 5%"],
        steps: [{ calc: "50,000 − 5% = 47,500 ฿", meaning: "ลูกค้าได้เงินคืน" }],
      },
      {
        type: "calculator",
        title: "รูดบัตรเป็นเงินสด",
        inputs: [
          { id: "amount", label: "ยอดรูดเต็ม", defaultValue: 50000, suffix: "฿" },
        ],
        compute: ({ amount }) => [
          {
            label: "ค่าธรรมเนียม (5%)",
            value: amount * 0.05,
            format: "currency",
          },
          { label: "ลูกค้าได้เงินคืน", value: amount * 0.95, format: "currency" },
        ],
      },
    ],
  },

  /* ── 12. ภาษี VAT ── */
  {
    id: "vat",
    title: "ภาษี VAT ทองรูปพรรณ 96.5%",
    Icon: IconReceipt,
    blocks: [
      { type: "h3", text: "วิธีคำนวณ VAT นอก" },
      {
        type: "list",
        ordered: true,
        items: [
          'หา "ราคาขายทองรูปพรรณรวมค่ากำเหน็จ" (ราคาวันที่คุณซื้อ)',
          'หา "ราคารับซื้อคืนทองรูปพรรณ" (ราคาประกาศของสมาคมค้าทองคำในวันที่คุณขาย)',
          "คำนวณส่วนต่าง — ราคาขาย (รวมค่ากำเหน็จ) − ราคารับซื้อคืน = ฐานภาษี",
          "คำนวณ VAT — ฐานภาษี × 7% = VAT ที่ร้านทองต้องนำส่ง",
        ],
      },
      {
        type: "live-example",
        title: "ตัวอย่าง",
        compute: ({ sell, buy }) => {
          const gamnet = 1000;
          const total = sell + gamnet;
          const diff = total - buy;
          const vat = Math.max(0, diff) * 0.07;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", {
              maximumFractionDigits: 2,
            });
          return {
            given: [
              `ราคาทองคำแท่ง ${fmt(sell)} ฿`,
              `ค่ากำเหน็จ ${fmt(gamnet)} ฿`,
              `รวม ${fmt(total)} ฿`,
              `ราคารับซื้อคืน (สมาคม) ${fmt(buy)} ฿`,
            ],
            steps: [
              {
                calc: `${fmt(total)} − ${fmt(buy)} = ${fmt(diff)} ฿`,
                meaning: "ส่วนต่าง (ฐานภาษี)",
              },
              {
                calc: `${fmt(diff)} × 7% = ${fmt(vat)} ฿`,
                meaning: "VAT ที่ต้องนำส่ง",
              },
            ],
          };
        },
      },
      {
        type: "calculator",
        title: "VAT ทองรูปพรรณ 96.5%",
        inputs: [
          {
            id: "gold",
            label: "ราคาทองคำแท่ง 96.5%",
            defaultValue: 66500,
            suffix: "฿",
            goldPriceDefault: true,
          },
          { id: "gamnet", label: "ค่ากำเหน็จ", defaultValue: 1000, suffix: "฿" },
          {
            id: "buyback",
            label: "ราคารับซื้อคืน",
            defaultValue: 65066.72,
            suffix: "฿",
            buyPriceDefault: true,
          },
        ],
        compute: ({ gold, gamnet, buyback }) => {
          const sellTotal = gold + gamnet;
          const base = sellTotal - buyback;
          const vat = Math.max(0, base) * 0.07;
          return [
            {
              label: "ราคาขายรวม (ทอง + กำเหน็จ)",
              value: sellTotal,
              format: "currency",
            },
            { label: "ส่วนต่าง (ฐานภาษี)", value: base, format: "currency" },
            { label: "VAT ที่ต้องนำส่ง (7%)", value: vat, format: "currency" },
          ];
        },
      },
    ],
  },

  /* ── 13. เครื่องตรวจเปอร์เซ็นต์ — Calibrate ── */
  {
    id: "calibrate-machine",
    title: "เครื่องตรวจ % ทอง — การ Calibrate",
    Icon: IconGauge,
    blocks: [
      {
        type: "p",
        text: "ก่อนใช้งานเครื่องตรวจเปอร์เซ็นต์ Vray VR-X5 ทุกวัน ควร Calibrate ก่อน 1 ครั้ง",
      },
      {
        type: "image",
        src: "/knowledge/vrx5.jpg",
        alt: "เครื่อง Vray VR-X5",
      },
      {
        type: "steps",
        items: [
          "เปิดเครื่องสำรองไฟ (UPS)",
          "เปิดสวิตช์ด้านหลังเครื่อง",
          "เข้าโปรแกรม Vray XRF",
          "เปิดฝาเครื่องด้านบนขึ้น",
          "นำแท่น Calibrate Sample มาวางในช่องตรวจวัด %",
          "ปิดฝาเครื่องด้านบนลง",
          "กดปุ่มที่ 3 (รูปเป้าเล็ง) นับจากทางซ้ายมือ",
          "รอเวลา Calibrate ประมาณ 150 วินาที",
          'หากขึ้น "Please Recalibrate" → กดปุ่มที่ 3 ใหม่อีกครั้ง',
          'หากขึ้น "Peak Calibrate is OK. Please Measure" → เสร็จสิ้น',
          "เปิดฝาเครื่อง → นำ Calibrate Sample ออก → ปิดฝา",
          "เครื่องพร้อมสำหรับการตรวจวัด %",
        ],
      },
      { type: "h3", text: "รูปประกอบ" },
      {
        type: "image",
        src: "/knowledge/ups.jpg",
        alt: "เครื่องสำรองไฟ (UPS)",
        caption: "1. เปิดเครื่องสำรองไฟ",
      },
      {
        type: "image",
        src: "/knowledge/ups-switch.jpg",
        alt: "สวิตช์ด้านหลังเครื่อง",
        caption: "2. เปิดสวิตช์ด้านหลัง",
      },
      {
        type: "image",
        src: "/knowledge/vray-icon.jpg",
        alt: "ไอคอนโปรแกรม Vray XRF",
        caption: "3. เข้าโปรแกรม Vray XRF",
      },
      {
        type: "image",
        src: "/knowledge/machine-open.jpg",
        alt: "เปิดฝาเครื่อง",
        caption: "4. เปิดฝาด้านบน",
      },
      {
        type: "image",
        src: "/knowledge/calibrate-sample.jpg",
        alt: "Calibrate Sample",
        caption: "5. นำ Calibrate Sample มาวาง",
      },
      {
        type: "image",
        src: "/knowledge/calibrate-progress.jpg",
        alt: "หน้าจอกำลัง Calibrate",
        caption: "7-8. กดปุ่มที่ 3 และรอ ~150 วินาที",
      },
      {
        type: "image",
        src: "/knowledge/please-recalibrate.jpg",
        alt: "Please Recalibrate",
        caption: '9. หากขึ้น "Please Recalibrate" → กดปุ่มที่ 3 ใหม่',
      },
      {
        type: "image",
        src: "/knowledge/calibrate-ok.jpg",
        alt: "Peak Calibrate is OK",
        caption: '10. ขึ้น "Peak Calibrate is OK" → เสร็จสิ้น',
      },
    ],
  },

  /* ── 14. เครื่องตรวจเปอร์เซ็นต์ — การใช้งาน ── */
  {
    id: "measure-machine",
    title: "เครื่องตรวจ % ทอง — การใช้งาน",
    Icon: IconPercent,
    blocks: [
      {
        type: "steps",
        items: [
          "เปิดฝาด้านบนขึ้น",
          "นำของที่ต้องการตรวจ % วางลงในช่องตรวจ",
          "วางของให้อยู่ในจุดตัด (วงกลมสีแดง)",
          "ปิดฝาด้านบนลง",
          "กดปุ่มที่ 1 (รูปสามเหลี่ยม) นับจากทางซ้าย",
          "รอประมาณ 50 วินาที",
          'อ่านค่า % ทองได้ที่แท็บ "Gold Value" (เงินจะขึ้น "Silver Value")',
          "ถ้าได้ % แน่นอนแล้วต้องการหยุด → กดปุ่มที่ 2 (สี่เหลี่ยม 2 อัน) + รอ ~3 วินาที",
          "เปิดฝา → หยิบของออก → ปิดฝา",
          "เสร็จสิ้นการตรวจ %",
        ],
      },
      { type: "h3", text: "รูปประกอบ" },
      {
        type: "image",
        src: "/knowledge/sample-loaded.jpg",
        alt: "วางของในช่อง",
        caption: "2-3. วางของในจุดตัด (วงกลมแดง)",
      },
      {
        type: "image",
        src: "/knowledge/measure-target.jpg",
        alt: "ทองอยู่ในจุดตัด",
        caption: "วางทองให้ตรงจุดเล็ง",
      },
      {
        type: "image",
        src: "/knowledge/result-gold.jpg",
        alt: "ผลการตรวจ Gold Value",
        caption: "7. อ่านค่า Gold Value (ในภาพ = 67.02%)",
      },
      {
        type: "image",
        src: "/knowledge/result-panel.jpg",
        alt: "Panel ผลการตรวจ",
        caption: "Panel แสดง Karat + Gold Value",
      },
      {
        type: "image",
        src: "/knowledge/stop-button.jpg",
        alt: "ปุ่มหยุด",
        caption: "8. กดปุ่มที่ 2 (สี่เหลี่ยม 2 อัน) เพื่อหยุด",
      },
    ],
  },

  /* ── 15. AEON i-Dealer ── */
  {
    id: "aeon",
    title: "ผ่อน AEON ผ่าน Website i-Dealer",
    Icon: IconSparkles,
    blocks: [
      { type: "h3", text: "ข้อมูล Login" },
      { type: "p", text: "Website: i-Dealer" },
      { type: "secret", label: "รหัสร้านค้า", value: "509699" },
      { type: "secret", label: "รหัสผ่าน", value: "Aeonmd@10010gd" },
      {
        type: "callout",
        tone: "warn",
        text: "รหัสซ่อนไว้ — แตะปุ่มตาเพื่อแสดง · ห้ามถ่ายภาพ/แชร์",
      },
      {
        type: "image",
        src: "/knowledge/aeon-login.jpg",
        alt: "หน้า login i-Dealer",
        caption: "หน้า Login Website i-Dealer",
      },
      { type: "h3", text: "ขั้นตอนทำรายการ" },
      {
        type: "steps",
        items: [
          "เข้าเมนู บริการ → ทำรายการผ่อนชำระ (คิวอาร์โค้ด)",
          "เลือกโปรแกรมการชำระ: AEON Happy Pay หรือ AEON Happy Plan",
          'ใส่ "จำนวนเงิน" (บาท)',
          'ใส่ "จำนวนงวดผ่อนชำระ" (เดือน)',
          "กด ส่งข้อมูล",
          "ให้ลูกค้า SCAN QR Code จ่ายเงินผ่านมือถือ",
        ],
      },
      {
        type: "image",
        src: "/knowledge/aeon-home.jpg",
        alt: "หน้าแรกหลัง login",
      },
      {
        type: "image",
        src: "/knowledge/aeon-menu.jpg",
        alt: "เมนูบริการ",
      },
      {
        type: "image",
        src: "/knowledge/aeon-form.jpg",
        alt: "ฟอร์มทำรายการผ่อน",
      },
      {
        type: "image",
        src: "/knowledge/aeon-qr.png",
        alt: "QR Code ให้ลูกค้าสแกน",
        caption: "หลังกดส่งข้อมูล → ลูกค้า scan QR จ่ายผ่านมือถือ",
      },
      { type: "h3", text: "บัตรที่ใช้ได้" },
      {
        type: "list",
        items: [
          "AEON Happy Pay — บัตรสมาชิกที่ทำรายการ Happy Pay",
          "AEON Happy Plan — บัตรเครดิตที่ทำรายการ Happy Plan",
        ],
      },
      {
        type: "image",
        src: "/knowledge/aeon-cards.jpg",
        alt: "ประเภทบัตร AEON",
        caption: "ประเภทบัตร AEON Happy Pay และ Happy Plan",
      },
    ],
  },
];

/* sidebar/summary helper */
export interface KnowledgeNavItem {
  id: string;
  title: string;
  Icon: KnowledgeSection["Icon"];
}

export const KNOWLEDGE_NAV: KnowledgeNavItem[] = KNOWLEDGE_SECTIONS.map(
  (s) => ({
    id: s.id,
    title: s.title,
    Icon: s.Icon,
  }),
);

/* re-export for icon consumer */
export const KNOWLEDGE_INTRO_ICON = IconCalculator;
export const KNOWLEDGE_PAGE_ICON = IconGem;
