/* ─── เอกสารอ้างอิงสำหรับให้ AI ช่วยตรวจข้อสอบ ─────────────────────────
   แปลงเนื้อหา "ความรู้ต่างๆ" (block-based) เป็นข้อความล้วน แล้วแปะราคาที่
   ตรึงไว้ตอนสอบไว้ข้างบน → ส่งไปเป็น context ให้ Claude ตอนตรวจ

   **ทำไมต้อง build จากฝั่ง client แล้วส่งไป ไม่ใช่เก็บสำเนาไว้ที่ functions:**
   `src/content/knowledge/index.ts` เป็นไฟล์ frontend (import lucide icon +
   มี `compute` เป็นฟังก์ชัน) ฝั่ง functions import ตรงไม่ได้ · ถ้า copy
   เนื้อหาไปไว้อีกชุด จะกลายเป็น 2 แหล่งที่ drift หากันเงียบๆ แล้ววันหนึ่ง
   AI จะตรวจด้วยกฎที่ห้างเลิกใช้ไปแล้ว โดยไม่มีอะไรฟ้อง — สร้างจากตัวเดียว
   กับที่หน้า "ความรู้ต่างๆ" render จริงปลอดภัยกว่า

   **block ที่แปลงไม่ได้ก็ข้ามไป ไม่ต้องฝืน** — `calculator`/`live-example`
   เนื้อในเป็นฟังก์ชัน ไม่ใช่ข้อความ · ตารางราคาสดก็ประกอบจาก snapshot ที่
   ส่วนหัวอยู่แล้ว การพยายามรัน compute ตรงนี้จะได้เลขจากราคา "วันที่ตรวจ"
   ซึ่งผิดทั้งประเด็น                                                      */

import type {
  KnowledgeBlock,
  KnowledgeSection,
} from "../content/knowledge/types";
import type { QuizPriceSnapshot } from "./quizAttempt";

/** ตัดเนื้อหาไม่ให้ยาวเกิน (กัน payload บวม) — ตัดที่ขอบ section เสมอ */
const MAX_CHARS = 60_000;

function fmt(n: number): string {
  return Number(n || 0).toLocaleString("en-US");
}

/** ส่วนหัว: ราคาที่ตรึงไว้ตอนเริ่มสอบ — AI ต้องคิดจากชุดนี้เท่านั้น */
export function formatPriceSnapshot(snap: QuizPriceSnapshot): string {
  const lines = [
    `- ราคาทองคำแท่ง 96.5% ขายออก: ${fmt(snap.goldSellPerBaht)} บาท/บาททอง`,
    `- ราคาทองคำแท่ง 96.5% รับซื้อ: ${fmt(snap.goldBuyPerBaht)} บาท/บาททอง`,
  ];
  if (snap.silverSellPerGram > 0) {
    lines.push(`- ราคาเงินขายออก: ${fmt(snap.silverSellPerGram)} บาท/กรัม`);
  }
  if (snap.silverBuyPerGram > 0) {
    lines.push(`- ราคาเงินรับซื้อ: ${fmt(snap.silverBuyPerGram)} บาท/กรัม`);
  }
  const rates = Object.entries(snap.changeRates ?? {});
  if (rates.length > 0) {
    lines.push(
      `- ค่าเปลี่ยน นน. เท่ากัน ตามจอราคาร้าน (คิดที่ราคาทอง ${fmt(snap.changeRatesForPrice)}):`,
    );
    for (const [id, value] of rates)
      lines.push(`    ${id} = ${fmt(value)} บาท`);
  }
  return lines.join("\n");
}

/** block → ข้อความล้วน · คืน "" ถ้า block นี้ไม่มีเนื้อหาที่เป็นตัวอักษร */
function blockToText(block: KnowledgeBlock): string {
  switch (block.type) {
    case "h3":
      return `\n### ${block.text}`;
    case "p":
      return block.text;
    case "list":
      return block.items.map((i) => `- ${i}`).join("\n");
    case "steps":
      return block.items.map((i, n) => `${n + 1}. ${i}`).join("\n");
    case "callout":
      return `[${block.tone}] ${block.text}`;
    case "formula":
      return [
        block.label ? `${block.label}:` : "",
        block.formula,
        block.result ? `= ${block.result}` : "",
      ]
        .filter(Boolean)
        .join(" ");
    case "table": {
      const head = `| ${block.columns.join(" | ")} |`;
      const rows = block.rows.map((r) => `| ${r.join(" | ")} |`);
      return [head, ...rows, block.note ? `หมายเหตุ: ${block.note}` : ""]
        .filter(Boolean)
        .join("\n");
    }
    case "example": {
      const given = block.given.map((g) => `- ${g}`).join("\n");
      const steps = block.steps
        .map((st) => `  ${st.calc}  → ${st.meaning}`)
        .join("\n");
      return `ตัวอย่าง: ${block.title}\n${given}\n${steps}`;
    }
    // secret = PIN/รหัสภายใน · image = รูป · calculator/live-example = ฟังก์ชัน
    // · ตารางราคาสดประกอบจาก snapshot ส่วนหัวแล้ว → ข้ามทั้งหมด
    default:
      return "";
  }
}

/** เนื้อหาของ 1 section → ข้อความล้วน (ว่าง = ไม่มีอะไรให้อ่าน) */
export function sectionToText(section: KnowledgeSection): string {
  const body = section.blocks
    .map(blockToText)
    .filter((t) => t.trim().length > 0)
    .join("\n");
  if (!body.trim()) return "";
  return `## ${section.title}\n${body.trim()}`;
}

/** ประกอบเอกสารอ้างอิงทั้งชุด — ราคาที่ตรึงไว้ + กฎจาก "ความรู้ต่างๆ"
 *
 *  ยาวเกิน `MAX_CHARS` จะตัด **ที่ขอบ section** เท่านั้น ไม่ตัดกลางตาราง
 *  (ตารางที่ขาดครึ่งอ่านแล้วเข้าใจผิดได้ แย่กว่าไม่มีตารางนั้นเลย)         */
export function buildGradingReference(
  sections: KnowledgeSection[],
  snapshot: QuizPriceSnapshot | null | undefined,
): string {
  const parts: string[] = [];
  if (snapshot) {
    parts.push(
      `# ราคา ณ วันที่ทำข้อสอบ (ใช้ชุดนี้เท่านั้นในการตรวจ)\n${formatPriceSnapshot(snapshot)}`,
    );
  }
  parts.push("# กฎและสูตรของห้าง (จากหน้า “ความรู้ต่างๆ”)");

  let used = parts.join("\n\n").length;
  for (const section of sections) {
    const text = sectionToText(section);
    if (!text) continue;
    if (used + text.length + 2 > MAX_CHARS) break;
    parts.push(text);
    used += text.length + 2;
  }
  return parts.join("\n\n");
}
