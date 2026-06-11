/* ─── KnowledgeView — รวมทุก section "บทเรียน" ─────────────────────
   layout: collapsible accordion ทุก section (mobile-first)
   เปิดทีละ section + remember last opened ใน sessionStorage           */

import {
  Brain as IconBrain,
  ChevronDown as IconChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { COLORS } from "../../constants";
import { KNOWLEDGE_SECTIONS } from "../../content/knowledge";
import GoldPriceHeader from "./GoldPriceHeader";
import KnowledgeBlockView from "./KnowledgeBlock";

const STORAGE_KEY = "knowledge:openSection";

interface Props {
  isAdmin?: boolean;
  showToast?: (msg: string) => void;
}

export default function KnowledgeView({ isAdmin, showToast }: Props) {
  const [openId, setOpenId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (openId) sessionStorage.setItem(STORAGE_KEY, openId);
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [openId]);

  return (
    <div>
      {/* header */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="w-10 h-10 rounded-[11px] bg-gold-pale flex items-center justify-center shrink-0">
          <IconBrain size={20} strokeWidth={2.4} color={COLORS.maroon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt leading-tight">
            ความรู้ต่างๆ
          </div>
          <div className="text-xs text-txt-soft">
            วิธีการและตัวอย่างต่างๆ ที่ใช้ในการคำนวณราคา ภายในห้างเพชรทองมุกดา · ฉบับปี 2569
          </div>
        </div>
      </div>

      {/* ราคาทองคำแท่งวันนี้ — real-time จาก /config/goldPrice */}
      <GoldPriceHeader isAdmin={isAdmin} showToast={showToast} />

      {/* sections */}
      <div className="flex flex-col gap-2">
        {KNOWLEDGE_SECTIONS.map((section) => {
          const isOpen = openId === section.id;
          const Icon = section.Icon;
          return (
            <div
              key={section.id}
              className="bg-white rounded-[14px] border border-bdr overflow-hidden shadow-[0_2px_8px_rgba(90,30,10,0.04)]"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : section.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 cursor-pointer font-[inherit] text-left active:scale-[0.995] transition-transform duration-100"
              >
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                    isOpen ? "bg-maroon" : "bg-gold-pale"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={2.4}
                    color={isOpen ? COLORS.goldLight : COLORS.maroon}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-txt leading-snug">
                    {section.title}
                  </div>
                </div>
                <IconChevronDown
                  size={16}
                  strokeWidth={2.5}
                  className={`shrink-0 text-txt-soft transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-3.5 pb-4 pt-1 border-t border-bdr/50">
                  {section.blocks.map((block, i) => (
                    <KnowledgeBlockView key={`b-${i}`} block={block} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
