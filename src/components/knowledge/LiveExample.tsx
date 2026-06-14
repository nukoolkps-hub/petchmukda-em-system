/* ─── LiveExample — example block ที่คำนวณจากราคาทองวันนี้ ─────────
   เหมือน block "example" แต่ "โจทย์" + steps มาจาก compute(gold)
   → โจทย์ใน demo จะตรงกับราคาในเครื่องคิดเลขที่ default ราคาวันนี้    */

import { ArrowRight as IconArrow } from "lucide-react";
import { useGoldPrice, useLaborCost } from "../../firebase/hooks/useFirestore";
import { getWeightsWithLabor } from "../../utils/changePriceUtils";
import MathText from "./MathText";

interface Props {
  title: string;
  /** สี header การ์ด · default "maroon" (สำหรับทอง) · "silver" สำหรับเงิน */
  tone?: "maroon" | "silver";
  compute: (gold: {
    sell: number;
    buy: number;
    silverBuy: number;
    laborBaht: number;
    labor: Record<string, number>;
  }) => {
    given: string[];
    steps: { calc: string; meaning: string }[];
  };
}

export default function LiveExample({
  title,
  tone = "maroon",
  compute,
}: Props) {
  const { data: gold } = useGoldPrice();
  const { data: laborData } = useLaborCost();
  // ค่าแรงทั้งตาราง · default fallback ถ้ายังไม่ load
  const weights = getWeightsWithLabor(laborData.values);
  const laborRecord: Record<string, number> = {};
  for (const w of weights) laborRecord[w.id] = w.laborBase;
  const labor1Baht = laborRecord["1-baht"] || 1050;
  // ก่อน live data โหลด → ใช้ default ราคา 50,000 / silver 30 ฿/กรัม กัน NaN
  const { given, steps } = compute({
    sell: gold.pricePerBaht || 50000,
    buy: gold.buyPrice || gold.pricePerBaht || 50000,
    silverBuy: gold.silverBuyPerGram || 30,
    laborBaht: labor1Baht,
    labor: laborRecord,
  });

  const isSilver = tone === "silver";
  const headerBg = isSilver ? "bg-silver" : "bg-maroon";
  const stepBg = isSilver ? "bg-silver" : "bg-maroon";
  const borderColor = isSilver ? "border-silver/25" : "border-maroon/25";
  const tagColor = isSilver ? "text-silver-lt" : "text-gold-lt";
  const dotBg = isSilver ? "bg-silver" : "bg-gold";

  return (
    <div
      className={`mb-3 rounded-[12px] border-[1.5px] ${borderColor} overflow-hidden`}
    >
      <div
        className={`px-3 py-2 ${headerBg} text-white text-xs font-bold inline-flex items-center gap-1.5 w-full`}
      >
        <IconArrow size={12} strokeWidth={2.5} />
        {title}
        <span className={`ml-auto text-[10px] font-bold ${tagColor}`}>
          อิงราคาวันนี้
        </span>
      </div>
      <div className="p-3 bg-white">
        <div className="text-xs text-txt-soft font-semibold mb-1.5">โจทย์</div>
        <ul className="mb-2.5 space-y-1 text-sm text-txt">
          {given.map((g, i) => (
            <li
              key={`g-${i}`}
              className="leading-relaxed flex items-start gap-2"
            >
              <span
                className={`mt-[9px] w-2 h-2 rounded-full ${dotBg} shrink-0`}
              />
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
          {steps.map((step, i) => (
            <li
              key={`s-${i}`}
              className="flex items-start gap-2.5 p-2 rounded-[8px] bg-cream/60 border border-bdr/40"
            >
              <span
                className={`shrink-0 w-5 h-5 rounded-full ${stepBg} text-white text-[10px] font-bold flex items-center justify-center mt-0.5`}
              >
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
}
