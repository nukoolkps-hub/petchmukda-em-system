/* ─── Knowledge block renderer ────────────────────────────────────
   render block แต่ละชนิด (heading, paragraph, list, table, formula,
   ตัวอย่าง, รูป, callout, steps) ตาม type discriminator              */

import {
  ArrowRight as IconArrow,
  Info as IconInfo,
  StickyNote as IconNote,
  AlertTriangle as IconWarn,
} from "lucide-react";
import type { KnowledgeBlock } from "../../content/knowledge/types";
import Calculator from "./Calculator";
import ChangePriceTable from "./ChangePriceTable";
import Secret from "./Secret";

interface Props {
  block: KnowledgeBlock;
}

export default function KnowledgeBlockView({ block }: Props) {
  switch (block.type) {
    case "h3":
      return (
        <h3 className="text-base font-extrabold text-maroon mt-4 mb-2 pb-1.5 border-b-[1.5px] border-gold/30">
          {block.text}
        </h3>
      );

    case "p":
      return (
        <p
          className={`text-sm leading-relaxed mb-2.5 ${block.muted ? "text-txt-soft" : "text-txt"}`}
        >
          {block.text}
        </p>
      );

    case "list":
      if (block.ordered) {
        return (
          <ol className="list-decimal list-outside pl-5 mb-2.5 space-y-1 text-sm text-txt">
            {block.items.map((item, i) => (
              <li key={`${item.slice(0, 16)}-${i}`} className="leading-relaxed">
                {item}
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
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <div className="mb-3 overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm border-collapse rounded-[10px] overflow-hidden">
            <thead>
              <tr className="bg-maroon text-white">
                {block.columns.map((col, i) => (
                  <th
                    key={`${col}-${i}`}
                    className="px-2.5 py-1.5 text-left font-bold text-xs whitespace-nowrap"
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
                      className="px-2.5 py-1.5 text-txt border-b border-bdr/40"
                    >
                      {cell}
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

    case "formula":
      return (
        <div className="mb-3 p-3 rounded-[10px] bg-gold-pale/40 border border-gold/30">
          {block.label && (
            <div className="text-xs text-txt-soft mb-1 font-semibold">
              {block.label}
            </div>
          )}
          <div className="text-sm font-bold text-maroon leading-relaxed">
            {block.formula}
          </div>
          {block.result && (
            <div className="text-sm font-semibold text-txt-mid mt-1">
              = {block.result}
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
            <ul className="mb-2.5 space-y-0.5 text-sm text-txt">
              {block.given.map((g, i) => (
                <li key={`g-${i}`} className="flex items-start gap-2">
                  <span className="text-gold mt-0.5">·</span>
                  <span>{g}</span>
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
                      {step.calc}
                    </div>
                    <div className="text-xs text-txt-soft mt-0.5">
                      ({step.meaning})
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
          <div className="text-sm leading-snug">{block.text}</div>
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
          inputs={block.inputs}
          compute={block.compute}
        />
      );

    case "secret":
      return <Secret label={block.label} value={block.value} />;

    case "change-price-table":
      return <ChangePriceTable />;
  }
}
