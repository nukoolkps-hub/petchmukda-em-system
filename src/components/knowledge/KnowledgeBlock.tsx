/* ─── Knowledge block renderer ────────────────────────────────────
   render block แต่ละชนิด (heading, paragraph, list, table, formula,
   ตัวอย่าง, รูป, callout, steps) ตาม type discriminator

   ┌─ Typography กฎทอง ───────────────────────────────────────────┐
   │ ตัวอักษร     = Prompt font (default — ห้ามใส่ font-mono บน   │
   │                 wrapper ของ text ใน "ความรู้ต่างๆ")           │
   │ MathText    = font-mono (เฉพาะ + − × ÷ =)                    │
   │ → ทุกข้อความที่อาจมี operator ต้อง wrap <MathText>           │
   │   (p, list, table, formula, example, callout, calculator)    │
   └──────────────────────────────────────────────────────────────┘ */

import {
  ArrowRight as IconArrow,
  Info as IconInfo,
  StickyNote as IconNote,
  AlertTriangle as IconWarn,
} from "lucide-react";
import type { KnowledgeBlock } from "../../content/knowledge/types";
import BlockCostTable from "./BlockCostTable";
import BuyPrice96Table from "./BuyPrice96Table";
import Calculator from "./Calculator";
import ChangePriceTable from "./ChangePriceTable";
import LaborCostTable from "./LaborCostTable";
import LiveExample from "./LiveExample";
import LoyaltyPointsRedeemTable from "./LoyaltyPointsRedeemTable";
import MathText from "./MathText";
import Secret from "./Secret";
import SellPrice96Table from "./SellPrice96Table";

interface Props {
  block: KnowledgeBlock;
  isAdmin?: boolean;
  showToast?: (msg: string) => void;
}

export default function KnowledgeBlockView({
  block,
  isAdmin,
  showToast,
}: Props) {
  switch (block.type) {
    case "h3": {
      // tone "maroon"/"silver"/"gradient" → pill with bg + white text (เด่นขึ้น)
      // tone "silver-text" → text-silver + silver border (ไม่มี pill bg)
      // default → text-maroon + bottom gold border (style เดิม)
      if (
        block.tone === "maroon" ||
        block.tone === "silver" ||
        block.tone === "gradient"
      ) {
        const bg =
          block.tone === "silver"
            ? "bg-silver"
            : block.tone === "gradient"
              ? "bg-linear-to-r from-maroon via-silver-dk to-silver"
              : "bg-maroon";
        return (
          <h3
            className={`text-sm font-extrabold text-white mt-4 mb-2 px-3 py-1.5 rounded-[8px] ${bg}`}
          >
            {block.text}
          </h3>
        );
      }
      if (block.tone === "silver-text") {
        return (
          <h3 className="text-base font-extrabold text-silver mt-4 mb-2 pb-1.5 border-b-[1.5px] border-silver-lt/60">
            {block.text}
          </h3>
        );
      }
      return (
        <h3 className="text-base font-extrabold text-maroon mt-4 mb-2 pb-1.5 border-b-[1.5px] border-gold/30">
          {block.text}
        </h3>
      );
    }

    case "p":
      // adminOnly: ซ่อนสำหรับพนักงาน (เช่น คำอธิบาย "ADMIN กดแก้ไข...")
      if (block.adminOnly && !isAdmin) return null;
      return (
        <p
          className={`text-sm leading-relaxed mb-2.5 ${block.muted ? "text-txt-soft" : "text-txt"}`}
        >
          <MathText>{block.text}</MathText>
        </p>
      );

    case "list":
      if (block.ordered) {
        return (
          <ol className="list-decimal list-outside pl-5 mb-2.5 space-y-1 text-sm text-txt">
            {block.items.map((item, i) => (
              <li key={`${item.slice(0, 16)}-${i}`} className="leading-relaxed">
                <MathText>{item}</MathText>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="mb-2.5 space-y-1.5 text-sm text-txt">
          {block.items.map((item, i) => (
            <li
              key={`${item.slice(0, 16)}-${i}`}
              className="leading-relaxed flex items-start gap-2"
            >
              <span className="mt-[0.5em] w-2 h-2 rounded-full bg-gold shrink-0" />
              {/* whitespace-pre-line — รองรับ \n ใน item string เพื่อให้
                  ทำ "ย่อหน้า" (บรรทัดที่ 2 แสดงต่อบรรทัดที่ 1 ใน bullet เดียว) */}
              <span className="whitespace-pre-line">
                <MathText>{item}</MathText>
              </span>
            </li>
          ))}
        </ul>
      );

    case "table": {
      const alignClass = (i: number) => {
        const a = block.colAlign?.[i];
        return a === "center"
          ? "text-center"
          : a === "right"
            ? "text-right"
            : "text-left";
      };
      const fixed = block.colWidths && block.colWidths.length > 0;
      return (
        <div className="mb-3 overflow-x-auto -mx-1 px-1">
          <table
            className={`w-full text-sm border-collapse rounded-[10px] overflow-hidden ${fixed ? "table-fixed" : ""}`}
          >
            {fixed && (
              <colgroup>
                {block.colWidths?.map((w, i) => (
                  <col key={`cw-${i}`} style={{ width: w }} />
                ))}
              </colgroup>
            )}
            <thead>
              <tr
                className={`text-white ${
                  block.tone === "silver"
                    ? "bg-silver"
                    : block.tone === "gradient"
                      ? "bg-linear-to-r from-maroon via-silver-dk to-silver"
                      : "bg-maroon"
                }`}
              >
                {block.columns.map((col, i) => (
                  <th
                    key={`${col}-${i}`}
                    className={`px-2.5 py-1.5 font-bold text-xs leading-tight ${alignClass(i)}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={`r-${ri}`}
                  className={ri % 2 === 0 ? "bg-white" : "bg-cream/50"}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={`c-${ri}-${ci}`}
                      className={`px-2.5 py-1.5 text-txt border-b border-bdr/40 ${alignClass(ci)}`}
                    >
                      <MathText>{cell}</MathText>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.note && (
            <div className="text-xs text-txt-soft mt-1 italic">
              {block.note}
            </div>
          )}
        </div>
      );
    }

    case "formula":
      return (
        <div className="mb-3 p-3 rounded-[10px] bg-gold-pale/40 border border-gold/30">
          {block.label && (
            <div className="text-xs text-txt-soft mb-1 font-semibold">
              {block.label}
            </div>
          )}
          <div className="text-sm font-bold text-maroon leading-relaxed">
            <MathText>{block.formula}</MathText>
          </div>
          {block.result && (
            <div className="text-sm font-semibold text-txt-mid mt-1">
              <MathText>{`= ${block.result}`}</MathText>
            </div>
          )}
        </div>
      );

    case "example":
      return (
        <div className="mb-3 rounded-[12px] border-[1.5px] border-maroon/25 overflow-hidden">
          <div className="px-3 py-2 bg-maroon text-white text-xs font-bold inline-flex items-center gap-1.5 w-full">
            <IconArrow size={12} strokeWidth={2.5} />
            {block.title}
          </div>
          <div className="p-3 bg-white">
            <div className="text-xs text-txt-soft font-semibold mb-1.5">
              โจทย์
            </div>
            <ul className="mb-2.5 space-y-1 text-sm text-txt">
              {block.given.map((g, i) => (
                <li
                  key={`g-${i}`}
                  className="leading-relaxed flex items-start gap-2"
                >
                  <span className="mt-[0.5em] w-2 h-2 rounded-full bg-gold shrink-0" />
                  <span>
                    <MathText>{g}</MathText>
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-xs text-txt-soft font-semibold mb-1.5">
              วิธีคำนวณ
            </div>
            <ol className="space-y-1.5 text-sm">
              {block.steps.map((step, i) => (
                <li
                  key={`s-${i}`}
                  className="flex items-start gap-2.5 p-2 rounded-[8px] bg-cream/60 border border-bdr/40"
                >
                  <span className="shrink-0 w-5 h-5 rounded-full bg-maroon text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-txt leading-snug">
                      <MathText>{step.calc}</MathText>
                    </div>
                    <div className="text-xs text-txt-soft mt-0.5">
                      (<MathText>{step.meaning}</MathText>)
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      );

    case "image":
      return (
        <figure className="mb-3">
          <img
            src={block.src}
            alt={block.alt}
            className="w-full max-w-md rounded-[10px] border border-bdr"
            loading="lazy"
          />
          {block.caption && (
            <figcaption className="text-xs text-txt-soft mt-1 italic">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case "callout": {
      const tone = block.tone;
      const Icon =
        tone === "warn" ? IconWarn : tone === "note" ? IconNote : IconInfo;
      const palette =
        tone === "warn"
          ? "bg-red-lt/40 border-red/30 text-red"
          : tone === "note"
            ? "bg-gold-pale/40 border-gold/30 text-maroon"
            : "bg-amber/10 border-amber/30 text-txt";
      return (
        <div
          className={`mb-3 px-3 py-2 rounded-[10px] border flex items-start gap-2 ${palette}`}
        >
          <Icon size={16} strokeWidth={2.4} className="shrink-0 mt-0.5" />
          <div className="text-sm leading-snug">
            <MathText>{block.text}</MathText>
          </div>
        </div>
      );
    }

    case "steps":
      return (
        <ol className="mb-3 space-y-1.5">
          {block.items.map((step, i) => (
            <li
              key={`step-${i}`}
              className="flex items-start gap-2.5 text-sm text-txt"
            >
              <span className="shrink-0 w-6 h-6 rounded-full bg-gold text-maroon text-xs font-bold flex items-center justify-center mt-px">
                {i + 1}
              </span>
              <span className="flex-1 leading-relaxed pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      );

    case "calculator":
      return (
        <Calculator
          title={block.title}
          tone={block.tone}
          inputs={block.inputs}
          compute={block.compute}
        />
      );

    case "secret":
      return <Secret label={block.label} value={block.value} />;

    case "change-price-table":
      return <ChangePriceTable />;

    case "sell-price-96-table":
      return <SellPrice96Table />;

    case "buy-price-96-table":
      return <BuyPrice96Table />;

    case "labor-cost-table":
      return <LaborCostTable isAdmin={isAdmin} showToast={showToast} />;

    case "block-cost-table":
      return <BlockCostTable isAdmin={isAdmin} showToast={showToast} />;

    case "loyalty-points-redeem-table":
      return (
        <LoyaltyPointsRedeemTable isAdmin={isAdmin} showToast={showToast} />
      );

    case "live-example":
      return (
        <LiveExample
          title={block.title}
          tone={block.tone}
          compute={block.compute}
        />
      );
  }
}
