/* ─── BuyPrice96Table — ตารางราคารับซื้อทอง 96.5% เริ่มต้นวันนี้ ──────
   subscribe goldPrice live · render 3 column (น้ำหนัก / รับซื้อ หัก 5%
   / รับซื้อ หัก 7%) — สูตร: (ราคาทอง × (1−x%)) × 0.0656 × grams         */

import { Banknote as IconBank } from "lucide-react";
import { useGoldPrice } from "../../firebase/hooks/useFirestore";
import {
  CHANGE_PRICE_WEIGHTS,
  computeBuyPrice96,
} from "../../utils/changePriceUtils";
import { formatThaiNumber } from "../../utils/format";

export default function BuyPrice96Table() {
  const { data: gold } = useGoldPrice();
  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconBank size={13} strokeWidth={2.5} />
        ราคารับซื้อ 96.5% เริ่มต้นวันนี้
      </div>
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "34%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "22%" }} />
        </colgroup>
        <thead className="bg-maroon text-white">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold text-xs">น้ำหนัก</th>
            <th className="px-2 py-1.5 text-right font-bold text-xs">
              หัก 5%
            </th>
            <th className="px-2 py-1.5 text-right font-bold text-xs">
              หัก 6%
            </th>
            <th className="px-2 py-1.5 text-right font-bold text-xs">
              หัก 7%
            </th>
          </tr>
        </thead>
        <tbody>
          {CHANGE_PRICE_WEIGHTS.filter((w) => !w.perBaht).map((w) => (
            <tr
              key={w.id}
              className="border-b border-bdr/40 last:border-0 odd:bg-cream/40"
            >
              <td className="px-2 py-1.5 text-txt font-semibold">{w.label}</td>
              {[5, 6, 7].map((pct) => (
                <td
                  key={pct}
                  className="px-2 py-1.5 text-right font-extrabold text-maroon"
                >
                  {formatThaiNumber(
                    Math.round(computeBuyPrice96(w, gold.pricePerBaht, pct)),
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
