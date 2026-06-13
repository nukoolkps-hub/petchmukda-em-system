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
      { type: "h3", text: "น้ำหนักทองคำแท่ง" },
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
      { type: "h3", tone: "silver-text", text: "น้ำหนักเงินแท่ง" },
      {
        type: "table",
        tone: "silver",
        columns: ["น้ำหนัก", "กรัม", "น้ำหนัก", "กรัม"],
        colWidths: ["25%", "25%", "25%", "25%"],
        colAlign: ["left", "right", "left", "right"],
        rows: [
          ["½ สลึง", "1.905", "5 บาท", "76.22"],
          ["1 สลึง", "3.811", "10 บาท", "152.44"],
          ["2 สลึง", "7.622", "20 บาท", "304.88"],
          ["1 บาท", "15.244", "1 กิโล", "1,000"],
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
      {
        type: "calculator",
        title: "แปลงน้ำหนัก → กรัม",
        inputs: [
          { id: "baht", label: "จำนวน", suffix: "บาท" },
        ],
        compute: ({ baht }) => [
          {
            label: "ทองแท่ง / เงินแท่ง",
            value: baht * 15.244,
            format: "number",
            decimals: 3,
            unit: "กรัม",
            hint: `${baht} × 15.244 กรัม/บาท`,
          },
          {
            label: "ทองรูปพรรณ",
            value: baht * 15.16,
            format: "number",
            unit: "กรัม",
            hint: `${baht} × 15.16 กรัม/บาท`,
          },
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
        adminOnly: true,
        text: "ราคาเริ่มต้นของค่าแรง สำหรับทองรูปพรรณ 96.5% — ADMIN แตะปุ่มแก้ไขในตารางด้านล่างเพื่อปรับค่า (sync ทั้งระบบทันที)",
      },
      { type: "labor-cost-table" },
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
        label: "ตามน้ำหนักสินค้า (ต่อกรัม)",
        formula: "(ราคาขายออกทองคำแท่ง + 3.6%) × 0.0656 + ค่าแรง = ราคาขาย/กรัม",
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
              `ราคาขายออกทองคำแท่งวันนี้ ${fmt(sell)} ฿/บาท`,
              `ค่าแรง ${fmt(labor)} ฿`,
              `น้ำหนักสินค้า ${grams} กรัม`,
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
            label: "ราคาขายออกทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿/บ.",
            goldPriceDefault: true,
          },
          { id: "labor", label: "ค่าแรง", suffix: "฿" },
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
        ],
        compute: ({ gold, labor, grams }) => {
          const gold9999 = gold * 1.036;
          const perGram = gold9999 * 0.0656;
          const sellPerGram = perGram + labor;
          const total = sellPerGram * grams;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return [
            {
              label: "ราคาทองคำ 99.99%",
              value: gold9999,
              format: "currency",
              hint: `${gold} × 1.036`,
            },
            {
              label: "ราคา 99.99% ต่อกรัม",
              value: perGram,
              format: "currency",
              hint: `${fmt(gold9999)} × 0.0656`,
            },
            {
              label: "ราคาขายต่อกรัม (+ ค่าแรง)",
              value: sellPerGram,
              format: "currency",
              hint: `${fmt(perGram)} + ${labor}`,
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
      { type: "h3", text: "วิธีการคำนวณราคาขายทองรูปพรรณ 96.5%" },
      {
        type: "table",
        columns: ["น้ำหนัก", "วิธีคำนวณ"],
        colWidths: ["25%", "75%"],
        colAlign: ["left", "left"],
        rows: [
          ["0.6 กรัม", "(ราคาขายออกทองคำแท่ง × 0.0656 × 0.6) + ค่าแรง = ราคาขาย"],
          ["1 กรัม", "(ราคาขายออกทองคำแท่ง × 0.0656 × 1) + ค่าแรง = ราคาขาย"],
          ["½ สลึง", "(ราคาขายออกทองคำแท่ง × 0.125) + ค่าแรง = ราคาขาย"],
          ["1 สลึง", "(ราคาขายออกทองคำแท่ง × 0.25) + ค่าแรง = ราคาขาย"],
          ["2 สลึง", "(ราคาขายออกทองคำแท่ง × 0.50) + ค่าแรง = ราคาขาย"],
          ["3 สลึง", "(ราคาขายออกทองคำแท่ง × 0.75) + ค่าแรง = ราคาขาย"],
          ["1 บาท", "ราคาขายออกทองคำแท่ง + ค่าแรง = ราคาขาย"],
          ["6 สลึง", "(ราคาขายออกทองคำแท่ง × 1.50) + ค่าแรง = ราคาขาย"],
          ["2 บาท ขึ้นไป", "(ราคาขายออกทองคำแท่ง + ค่าแรงต่อบาท) × จำนวนบาท = ราคาขาย"],
          ["ตามน้ำหนักชั่ง", "(ราคาขายออกทองคำแท่ง × 0.0656 × น้ำหนักสินค้า) + ค่าแรง = ราคาขาย"],
        ],
      },
      { type: "sell-price-96-table" },
      {
        type: "calculator",
        title: "ราคาขายทองรูปพรรณ 96.5% ตามน้ำหนักชั่ง",
        inputs: [
          {
            id: "gold",
            label: "ราคาขายออกทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿/บ.",
            goldPriceDefault: true,
          },
          { id: "labor", label: "ค่าแรง", suffix: "฿" },
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
        ],
        compute: ({ gold, labor, grams }) => {
          const goldPart = gold * 0.0656 * grams;
          const total = goldPart + labor;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return [
            {
              label: "ราคาขายออกทองคำแท่งตามน้ำหนักสินค้า",
              value: goldPart,
              format: "currency",
              hint: `${gold} × 0.0656 × ${grams}`,
            },
            {
              label: "ราคาขาย (+ ค่าแรง)",
              value: total,
              format: "currency",
              hint: `${fmt(goldPart)} + ${labor}`,
            },
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
        label: "ตามน้ำหนักชั่ง",
        formula: "(ราคาขายออกทองคำแท่ง × 0.50) × 0.0656 × น้ำหนักสินค้า + ค่าแรง = ราคาขาย",
      },
      {
        type: "calculator",
        title: "ราคาขายนาก",
        inputs: [
          {
            id: "gold",
            label: "ราคาขายออกทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿/บ.",
            goldPriceDefault: true,
          },
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
          { id: "labor", label: "ค่าแรง", suffix: "฿" },
        ],
        compute: ({ gold, grams, labor }) => {
          const half = gold / 2;
          const goldPart = half * 0.0656 * grams;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return [
            {
              label: "ราคาขายออกทองคำแท่ง × 0.50",
              value: half,
              format: "currency",
              hint: `${gold} × 0.50`,
            },
            {
              label: "ราคาขายออกทองคำแท่งตามน้ำหนักสินค้า",
              value: goldPart,
              format: "currency",
              hint: `${half} × 0.0656 × ${grams}`,
            },
            {
              label: "ราคาขาย (+ ค่าแรง)",
              value: goldPart + labor,
              format: "currency",
              hint: `${fmt(goldPart)} + ${labor}`,
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
        label: "ตามน้ำหนักชั่ง",
        formula: "(ราคาขายออกเงินแท่ง × น้ำหนักสินค้า) + ค่าแรง = ราคาขาย",
      },
      {
        type: "calculator",
        title: "ราคาขายเงิน",
        tone: "silver",
        inputs: [
          {
            id: "rate",
            label: "ราคาขายออกเงินแท่ง 99.99%",
            defaultValue: 30,
            suffix: "฿/ก.",
            silverSellPriceDefault: true,
          },
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
          { id: "labor", label: "ค่าแรง", suffix: "฿" },
        ],
        compute: ({ rate, grams, labor }) => {
          const silverPart = rate * grams;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return [
            {
              label: "ราคาเงินตามน้ำหนักสินค้า",
              value: silverPart,
              format: "currency",
              hint: `${rate} × ${grams}`,
            },
            {
              label: "ราคาขาย (+ ค่าแรง)",
              value: silverPart + labor,
              format: "currency",
              hint: `${fmt(silverPart)} + ${labor}`,
            },
          ];
        },
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
        text: "ค่าเปลี่ยนระหว่างน้ำหนักเท่ากัน — อิงราคาขายออกทองคำแท่งวันนี้ อัปเดตอัตโนมัติ",
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
        formula: "ราคาขายออกทองคำแท่งของน้ำหนักที่เพิ่ม + ค่าแรงของน้ำหนักที่เพิ่ม (MD) + ค่าเปลี่ยนทองเก่า",
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — 1 สลึง เพิ่มเป็น 2 สลึง (MD-03)",
        compute: ({ sell, labor }) => {
          const oldChange = changePriceFor("1-saleung", sell);
          // ค่าแรงของน้ำหนักที่เพิ่ม = 1 สลึง (2 − 1 สลึง) · default 750
          const newLabor = labor["1-saleung"] || 750;
          const md = 300;
          const goldPart = sell * 0.25;
          const total = goldPart + (newLabor + md) + oldChange;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ค่าเปลี่ยน 1 สลึง (จากตาราง) = ${fmt(oldChange)} ฿`,
              `ราคาขายออกทองคำแท่งวันนี้ ${fmt(sell)} ฿/บาท`,
            ],
            steps: [
              {
                calc: `(${fmt(sell)} × 0.25) + (${newLabor} + ${md}) + ${fmt(oldChange)} = ${fmt(total)} ฿`,
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
          "ราคาขายออกทองคำแท่งของน้ำหนักที่เพิ่ม + ค่าแรงของน้ำหนักที่เพิ่ม (MD) + ค่าเปลี่ยนทองเก่า (MD)",
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — 1 บาท เพิ่มเป็น 2 บาท (MD-03)",
        compute: ({ sell, labor }) => {
          const oldChange = changePriceFor("1-baht", sell);
          // ค่าแรงของน้ำหนักที่เพิ่ม = 1 บาท (2 − 1 บาท) · default 1050
          const newLabor = labor["1-baht"] || 1050;
          const md = 300;
          const total = sell + (newLabor + md) + (oldChange + md);
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ค่าเปลี่ยน 1 บาท (จากตาราง) = ${fmt(oldChange)} ฿`,
              `ราคาขายออกทองคำแท่งวันนี้ ${fmt(sell)} ฿/บาท`,
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
      { type: "h3", text: "ส่วนลด (ทอง 99.99%)" },
      {
        type: "list",
        items: [
          "ปกติ ลด 15% (ค่าแรงขาย/กรัม)",
          "HBD ลด 25% (ค่าแรงขาย/กรัม)",
          "ปกติ ลด 15% (ค่าแรงขาย)",
          "HBD ลด 25% (ค่าแรงขาย)",
        ],
      },
      {
        type: "callout",
        tone: "warn",
        text: "ทองคำแท่ง ไม่ได้ร่วมรายการ ส่วนลด",
      },
      { type: "h3", text: "ส่วนลด (ทอง 96.5%)" },
      {
        type: "list",
        items: ["ปกติ ลด 15% (ค่าแรงขาย)", "HBD ลด 25% (ค่าแรงขาย)"],
      },
      {
        type: "callout",
        tone: "warn",
        text: "ทองคำแท่ง ไม่ได้ร่วมรายการ ส่วนลด",
      },
      { type: "h3", text: "ส่วนลดค่าเปลี่ยน (ทอง 96.5%)" },
      {
        type: "list",
        items: ["ปกติ ลด 5%", "HBD ลด 5%"],
      },
      { type: "h3", text: "ส่วนลด (ทอง 90)" },
      {
        type: "list",
        items: [
          "ต่างหูแผง (ราคาขาย)\nปกติ ลด 10% HBD ลด 15%",
          "ต่างหู (ค่าแรงขาย)\nปกติ ลด 15% HBD ลด 25%",
          "พระแผง (ราคาขาย)\nปกติ ลด 10% HBD ลด 15%",
          "กรอบพระ (ค่าแรงขาย)\nปกติ ลด 15% HBD ลด 25%",
          "Italy 18k (ค่าแรงขาย/กรัม)\nปกติ ลด 15% HBD ลด 25%",
        ],
      },
      { type: "h3", text: "ส่วนลด (นาก)" },
      {
        type: "list",
        items: ["ปกติ ลด 15% (ค่าแรงขาย)", "HBD ลด 25% (ค่าแรงขาย)"],
      },
      { type: "h3", tone: "silver-text", text: "ส่วนลด (เงิน)" },
      {
        type: "list",
        items: ["ปกติ ลด 15% (ค่าแรงขาย)", "HBD ลด 25% (ค่าแรงขาย)"],
      },
      {
        type: "callout",
        tone: "warn",
        text: "เงินแท่ง ไม่ได้ร่วมรายการ ส่วนลด",
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
          ["ตามน้ำหนักชั่ง", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ"],
        ],
      },
      {
        type: "calculator",
        title: "ราคารับซื้อทอง 99.99%",
        inputs: [
          {
            id: "gold",
            label: "ราคารับซื้อทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿/บ.",
            buyPriceDefault: true,
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
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
        ],
        compute: ({ gold, discount, grams }) => {
          const base = gold * (1 - discount / 100);
          const buy = base * 0.0656 * grams;
          return [
            {
              label: "ราคารับซื้อทองคำแท่งหลังหัก %",
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
        type: "callout",
        tone: "warn",
        text: "ทองแท่ง (MD) 96.5% ไม่หัก % รับซื้อ ให้เต็มตาม ราคารับซื้อทองคำแท่ง 96.5%\nหากเป็นของที่อื่น น้ำหนักสินค้า 0.05 - 1 บาท หัก 100 บาท/แท่ง และ 2 บาทขึ้นไป หัก 100 ฿/บาท",
      },
      { type: "h3", text: "วิธีการคำนวณราคารับซื้อทองรูปพรรณ" },
      {
        type: "table",
        columns: ["น้ำหนัก", "วิธีคำนวณ"],
        colWidths: ["25%", "75%"],
        colAlign: ["left", "left"],
        rows: [
          ["0.6 กรัม", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.0656 × 0.6 = ราคารับซื้อ"],
          ["1 กรัม", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.0656 × 1 = ราคารับซื้อ"],
          ["½ สลึง", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.125 = ราคารับซื้อ"],
          ["1 สลึง", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.25 = ราคารับซื้อ"],
          ["2 สลึง", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.50 = ราคารับซื้อ"],
          ["3 สลึง", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.75 = ราคารับซื้อ"],
          ["1 บาท", "ราคารับซื้อทองคำแท่ง − 5-7% = ราคารับซื้อ"],
          ["6 สลึง", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 1.5 = ราคารับซื้อ"],
          ["2 บาท ขึ้นไป", "(ราคารับซื้อทองคำแท่ง − 5-7%) × จำนวนบาททอง = ราคารับซื้อ"],
          ["ตามน้ำหนักชั่ง", "(ราคารับซื้อทองคำแท่ง − 5-7%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ"],
        ],
      },
      { type: "buy-price-96-table" },
      {
        type: "calculator",
        title: "ราคารับซื้อทองรูปพรรณ 96.5% ตามน้ำหนักชั่ง",
        inputs: [
          {
            id: "gold",
            label: "ราคารับซื้อทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿/บ.",
            buyPriceDefault: true,
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
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
        ],
        compute: ({ gold, discount, grams }) => {
          const base = gold * (1 - discount / 100);
          const buy = base * 0.0656 * grams;
          return [
            {
              label: "ราคารับซื้อทองคำแท่งหลังหัก %",
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
          ["ตามน้ำหนักชั่ง", "(ราคารับซื้อทองคำแท่ง × 60%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ"],
          [
            "มีการตรวจ %",
            "(ราคารับซื้อทองคำแท่ง × (%จริง − 10)%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ",
          ],
        ],
      },
      {
        type: "calculator",
        title: "ราคารับซื้อทอง 90",
        inputs: [
          {
            id: "gold",
            label: "ราคารับซื้อทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿/บ.",
            buyPriceDefault: true,
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
            suffix: "%",
            disabledWhen: ({ mode }) => mode !== 999,
          },
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
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
          ["ตามน้ำหนักชั่ง", "(ราคารับซื้อทองคำแท่ง × 25%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ"],
          [
            "มีการตรวจ %",
            "(ราคารับซื้อทองคำแท่ง × (%จริง − 10)%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ",
          ],
        ],
      },
      {
        type: "live-example",
        title: "ตัวอย่าง — นาก 1 สลึง (3.79 กรัม)",
        compute: ({ buy }) => {
          const grams = 3.79;
          const general = buy * 0.25 * 0.0656 * grams;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคารับซื้อทองคำแท่งวันนี้ ${fmt(buy)} ฿/บาท`,
              `น้ำหนักสินค้า ${grams} กรัม`,
              "กรณี: ทั่วไป (25%)",
            ],
            steps: [
              {
                calc: `${fmt(buy)} × 25% = ${fmt(buy * 0.25)}`,
                meaning: "ราคารับซื้อทองคำแท่งหลังหัก 75%",
              },
              {
                calc: `${fmt(buy * 0.25)} × 0.0656 × ${grams} = ${fmt(general)} ฿`,
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
            label: "ราคารับซื้อทองคำแท่ง 96.5%",
            defaultValue: 50000,
            suffix: "฿/บ.",
            buyPriceDefault: true,
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
            suffix: "%",
            disabledWhen: ({ mode }) => mode !== 999,
          },
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
        ],
        compute: ({ gold, mode, realPct, grams }) => {
          const factor = mode === 999 ? (realPct - 10) / 100 : 0.25;
          const base = gold * factor;
          const buy = base * 0.0656 * grams;
          return [
            {
              label: "ราคารับซื้อทองคำแท่งหลังหัก %",
              value: base,
              format: "currency",
              hint:
                mode === 999 ? `${gold} × (${realPct}−10)%` : `${gold} × 25%`,
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

  /* ── 5d. รับซื้อเงิน ── */
  {
    id: "buy-price-silver",
    title: "การคำนวณราคารับซื้อ (เงิน)",
    Icon: IconBanknote,
    blocks: [
      {
        type: "callout",
        tone: "warn",
        text: "เงินแท่ง (MD) 99.99% ไม่หัก % รับซื้อ ให้เต็มตาม ราคารับซื้อเงินแท่ง 99.99%\nหากเป็นของที่อื่น น้ำหนักสินค้า ½ สลึง - 1 บาท หัก 100 บาท/แท่ง และ 2 บาทขึ้นไป หัก 100 ฿/บาท",
      },
      {
        type: "table",
        tone: "silver",
        columns: ["กรณี", "วิธีคำนวณ"],
        colWidths: ["30%", "70%"],
        colAlign: ["left", "left"],
        rows: [
          [
            "ตามน้ำหนักชั่ง",
            "(ราคารับซื้อเงินแท่ง × 25%) × น้ำหนักสินค้า = ราคารับซื้อ",
          ],
          [
            "มีการตรวจ %",
            "(ราคารับซื้อเงินแท่ง × (%จริง − 20)%) × น้ำหนักสินค้า = ราคารับซื้อ",
          ],
        ],
      },
      {
        type: "calculator",
        title: "ราคารับซื้อเงิน",
        tone: "silver",
        inputs: [
          {
            id: "rate",
            label: "ราคารับซื้อเงินแท่ง 99.99%",
            defaultValue: 30,
            suffix: "฿/ก.",
            silverBuyPriceDefault: true,
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
            suffix: "%",
            disabledWhen: ({ mode }) => mode !== 999,
          },
          { id: "grams", label: "น้ำหนักสินค้า", suffix: "ก." },
        ],
        compute: ({ rate, mode, realPct, grams }) => {
          const factor = mode === 999 ? (realPct - 20) / 100 : 0.25;
          const base = rate * factor;
          const buy = base * grams;
          return [
            {
              label: "ราคารับซื้อเงินแท่งหลังหัก %",
              value: base,
              format: "currency",
              hint:
                mode === 999 ? `${rate} × (${realPct}−20)%` : `${rate} × 25%`,
            },
            {
              label: "ราคารับซื้อ",
              value: buy,
              format: "currency",
              hint: `× ${grams} ก.`,
            },
          ];
        },
      },
    ],
  },

  /* ── 6. ค่าบล็อก ── */
  {
    id: "block-cost",
    title: "ค่าบล็อก (ทองคำแท่ง / เงินแท่ง)",
    Icon: IconPackage,
    blocks: [
      {
        type: "p",
        adminOnly: true,
        muted: true,
        text: 'ADMIN กดปุ่ม "แก้ไข" บน header เพื่อปรับค่าบล็อก / ค่าส่ง / ค่าประกัน — sync ทุกคนทันที',
      },
      { type: "block-cost-table" },
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
          [
            "เงิน 99.99%",
            "หัก 30-35% จากราคารับซื้อเงินแท่ง · หากมีการตรวจ % หักจาก % ที่ได้จากเครื่องตรวจ 35%",
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
      {
        type: "live-example",
        title: "ตัวอย่าง — เงิน หัก 32.5%",
        tone: "silver",
        compute: ({ silverBuy }) => {
          const rate = 0.325;
          const pawn = silverBuy * (1 - rate);
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return {
            given: [
              `ราคารับซื้อเงินแท่งวันนี้ ${fmt(silverBuy)} ฿/กรัม`,
              `อัตราหัก 32.5% (เฉลี่ย 30-35%)`,
            ],
            steps: [
              {
                calc: `${fmt(silverBuy)} × 67.5% = ${fmt(pawn)} ฿`,
                meaning: "ราคาจำนำต่อกรัม",
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
            suffix: "฿",
          },
          {
            id: "months",
            label: "ระยะเวลา (เดือนเต็ม)",
            suffix: "ด.",
          },
          {
            id: "extraDays",
            label: "วันเศษ (0-31)",
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
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          const extraRate = extraDays <= 15 ? "0.75%" : "1.5%";
          const hintExtra =
            extraDays > 0
              ? ` + (${principal} × ${extraRate}, ขั้นต่ำ 30 ฿) วันเศษ`
              : "";
          return [
            {
              label: "ดอกเบี้ยรวมทั้งหมด",
              value: total,
              format: "currency",
              hint: `(${principal} × 1.5%, ขั้นต่ำ 30 ฿) × ${months} ด.${hintExtra}`,
            },
            {
              label: "ยอดที่ต้องจ่ายเพื่อไถ่",
              value: principal + total,
              format: "currency",
              hint: `${principal} + ${fmt(total)}`,
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
      { type: "loyalty-points-redeem-table" },
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
          "หากเปลี่ยน MD เท่ากัน หรือ ถูกกว่า **ไม่ต้องเพิ่มเงิน**",
          "หากเปลี่ยน MD มากกว่า **ต้องเพิ่มเงิน** เท่ากับ MD เส้นใหม่",
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
          "ราคาที่รูดจริง = ราคาขาย + 3% (ค่าธรรมเนียม)",
          "ดอกเบี้ยต่อเดือน = ราคารูดจริง × % ดอกเบี้ย",
          "รายจ่ายต่อเดือน = (ราคารูดจริง ÷ จำนวนเดือนผ่อน) + ดอกเบี้ยต่อเดือน",
        ],
      },
      {
        type: "example",
        title: "ตัวอย่าง — ราคา 18,000 ฿ · ดอกเบี้ย 1.2% · 6 เดือน",
        given: ["ราคาขาย 18,000 ฿", "ดอกเบี้ย 1.2%", "จำนวนเดือนผ่อน 6 เดือน"],
        steps: [
          { calc: "18,000 + 3% = 18,540 ฿", meaning: "ราคาที่ใช้รูดจริง" },
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
          { id: "price", label: "ราคาขาย", suffix: "฿" },
          {
            id: "ratePct",
            label: "ดอกเบี้ย/เดือน",
            suffix: "%",
          },
          {
            id: "months",
            label: "จำนวนเดือนผ่อน",
            suffix: "ด.",
          },
        ],
        compute: ({ price, ratePct, months }) => {
          const swiped = price * 1.03;
          const interest = swiped * (ratePct / 100);
          const perMonth = swiped / months + interest;
          const total = perMonth * months;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return [
            {
              label: "ราคาที่ใช้รูดจริง",
              value: swiped,
              format: "currency",
              hint: `${price} + 3%`,
            },
            {
              label: "ดอกเบี้ย/เดือน",
              value: interest,
              format: "currency",
              hint: `${fmt(swiped)} × ${ratePct}%`,
            },
            {
              label: "รายจ่าย/เดือน",
              value: perMonth,
              format: "currency",
              hint: `${fmt(swiped)} ÷ ${months} + ${fmt(interest)}`,
            },
            {
              label: "รายจ่ายทั้งหมด",
              value: total,
              format: "currency",
              hint: `${fmt(perMonth)} × ${months}`,
            },
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
          { id: "amount", label: "ยอดรูดเต็ม", suffix: "฿" },
        ],
        compute: ({ amount }) => [
          {
            label: "ค่าธรรมเนียม (5%)",
            value: amount * 0.05,
            format: "currency",
            hint: `${amount} × 5%`,
          },
          {
            label: "ลูกค้าได้เงินคืน",
            value: amount * 0.95,
            format: "currency",
            hint: `${amount} × 95%`,
          },
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
          "(ราคาขายออกทองคำแท่ง × 0.0656 × น้ำหนักสินค้า) + ค่าแรง (ตามตาราง) = ราคาขาย",
          "(ราคารับซื้อทองคำแท่ง × 98%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อคืน (VAT)",
          "ราคาขาย − ราคารับซื้อคืน (VAT) = ฐานภาษี",
          "ฐานภาษี × 7% = VAT ที่ร้านทองต้องนำส่ง",
        ],
      },
      {
        type: "live-example",
        title: "ตัวอย่าง",
        compute: ({ sell, buy, laborBaht }) => {
          const total = sell + laborBaht;
          // ราคารับซื้อคืน (VAT) = ราคารับซื้อทองคำแท่ง × 98%
          const buyback = buy * 0.98;
          const diff = total - buyback;
          const vat = Math.max(0, diff) * 0.07;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", {
              maximumFractionDigits: 2,
            });
          return {
            given: [
              `ราคาขายออกทองคำแท่งวันนี้ ${fmt(sell)} ฿/บาท`,
              `ค่าแรง ${fmt(laborBaht)} ฿`,
              `รวม ${fmt(total)} ฿`,
              `ราคารับซื้อคืน (VAT) ${fmt(buyback)} ฿`,
            ],
            steps: [
              {
                calc: `${fmt(total)} − ${fmt(buyback)} = ${fmt(diff)} ฿`,
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
            label: "ราคาขายออกทองคำแท่ง 96.5%",
            defaultValue: 66500,
            suffix: "฿/บ.",
            goldPriceDefault: true,
          },
          { id: "labor", label: "ค่าแรง", suffix: "฿" },
          {
            id: "weight",
            label: "น้ำหนักสินค้า",
            suffix: "ก.",
          },
          {
            id: "buyback",
            label: "ราคารับซื้อทองคำแท่ง × 98%",
            defaultValue: 63994,
            suffix: "฿/บ.",
            buyPriceDefault: true,
            buyPriceMultiplier: 0.98,
            // ซ่อนจาก input section · ใช้คำนวณภายใน
            hidden: true,
          },
        ],
        compute: ({ gold, labor, weight, buyback }) => {
          const goldPart = gold * 0.0656 * weight;
          const sellTotal = goldPart + labor;
          const buybackVat = buyback * 0.0656 * weight;
          const base = sellTotal - buybackVat;
          const vat = Math.max(0, base) * 0.07;
          const fmt = (n: number) =>
            n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
          return [
            {
              label: "ราคาขายรวม (ทอง + ค่าแรง)",
              value: sellTotal,
              format: "currency",
              hint: `(${gold} × 0.0656 × ${weight}) + ${labor}`,
            },
            {
              label: "ราคารับซื้อคืน (VAT)",
              value: buybackVat,
              format: "currency",
              hint: `(ราคารับซื้อทองคำแท่ง × 98%) × 0.0656 × ${weight}`,
            },
            {
              label: "ส่วนต่าง (ฐานภาษี)",
              value: base,
              format: "currency",
              hint: `${fmt(sellTotal)} − ${fmt(buybackVat)}`,
            },
            {
              label: "VAT ที่ต้องนำส่ง (7%)",
              value: vat,
              format: "currency",
              hint: `${fmt(Math.max(0, base))} × 7%`,
            },
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
        src: "/knowledge/vrx5.webp",
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
        src: "/knowledge/ups.webp",
        alt: "เครื่องสำรองไฟ (UPS)",
        caption: "1. เปิดเครื่องสำรองไฟ",
      },
      {
        type: "image",
        src: "/knowledge/ups-switch.webp",
        alt: "สวิตช์ด้านหลังเครื่อง",
        caption: "2. เปิดสวิตช์ด้านหลัง",
      },
      {
        type: "image",
        src: "/knowledge/vray-icon.webp",
        alt: "ไอคอนโปรแกรม Vray XRF",
        caption: "3. เข้าโปรแกรม Vray XRF",
      },
      {
        type: "image",
        src: "/knowledge/machine-open.webp",
        alt: "เปิดฝาเครื่อง",
        caption: "4. เปิดฝาด้านบน",
      },
      {
        type: "image",
        src: "/knowledge/calibrate-sample.webp",
        alt: "Calibrate Sample",
        caption: "5. นำ Calibrate Sample มาวาง",
      },
      {
        type: "image",
        src: "/knowledge/calibrate-progress.webp",
        alt: "หน้าจอกำลัง Calibrate",
        caption: "7-8. กดปุ่มที่ 3 และรอ ~150 วินาที",
      },
      {
        type: "image",
        src: "/knowledge/please-recalibrate.webp",
        alt: "Please Recalibrate",
        caption: '9. หากขึ้น "Please Recalibrate" → กดปุ่มที่ 3 ใหม่',
      },
      {
        type: "image",
        src: "/knowledge/calibrate-ok.webp",
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
        src: "/knowledge/sample-loaded.webp",
        alt: "วางของในช่อง",
        caption: "2-3. วางของในจุดตัด (วงกลมแดง)",
      },
      {
        type: "image",
        src: "/knowledge/measure-target.webp",
        alt: "ทองอยู่ในจุดตัด",
        caption: "วางทองให้ตรงจุดเล็ง",
      },
      {
        type: "image",
        src: "/knowledge/result-gold.webp",
        alt: "ผลการตรวจ Gold Value",
        caption: "7. อ่านค่า Gold Value (ในภาพ = 67.02%)",
      },
      {
        type: "image",
        src: "/knowledge/result-panel.webp",
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
