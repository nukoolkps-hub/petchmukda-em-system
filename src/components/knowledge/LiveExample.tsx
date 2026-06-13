/* ─── LiveExample — example block ที่คำนวณจากราคาทองวันนี้ ─────────
   เหมือน block "example" แต่ "โจทย์" + steps มาจาก compute(gold)
   → โจทย์ใน demo จะตรงกับราคาในเครื่องคิดเลขที่ default ราคาวันนี้    */

import { ArrowRight as IconArrow } from "lucide-react";
import { useGoldPrice } from "../../firebase/hooks/useFirestore";
import MathText from "./MathText";

interface Props {
  title: string;
  compute: (gold: { sell: number; buy: number }) => {
    given: string[];
    steps: { calc: string; meaning: string }[];
  };
}

export default function LiveExample({ title, compute }: Props) {
  const { data: gold } = useGoldPrice();
  // ก่อน live data โหลด → ใช้ default ราคา 50,000 เพื่อกัน NaN ใน calc
  const { given, steps } = compute({
    sell: gold.pricePerBaht || 50000,
    buy: gold.buyPrice || gold.pricePerBaht || 50000,
  });

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-maroon/25 overflow-hidden">
      <div className="px-3 py-2 bg-maroon text-white text-xs font-bold inline-flex items-center gap-1.5 w-full">
        <IconArrow size={12} strokeWidth={2.5} />
        {title}
        <span className="ml-auto text-[10px] font-bold text-gold-lt">
          อิงราคาวันนี้
        </span>
      </div>
      <div className="p-3 bg-white">
        <div className="text-xs text-txt-soft font-semibold mb-1.5">โจทย์</div>
        <ul className="mb-2.5 space-y-0.5 text-sm text-txt">
          {given.map((g, i) => (
            <li key={`g-${i}`} className="flex items-start gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
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
}
