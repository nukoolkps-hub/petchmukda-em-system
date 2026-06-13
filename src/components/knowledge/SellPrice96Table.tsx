/* ─── SellPrice96Table — ตารางราคาขายทอง 96.5% เริ่มต้นวันนี้ ──────
   subscribe goldPrice live · render แต่ละน้ำหนัก = (ราคาทอง × 0.0656
   × grams) + ค่าแรงเริ่มต้น · ใช้ค่าแรง/น้ำหนักจาก CHANGE_PRICE_WEIGHTS  */

import { ShoppingBag as IconBag } from "lucide-react";
import { useGoldPrice, useLaborCost } from "../../firebase/hooks/useFirestore";
import {
  computeSellPrice96,
  getWeightsWithLabor,
} from "../../utils/changePriceUtils";
import { formatThaiNumber } from "../../utils/format";

export default function SellPrice96Table() {
  const { data: gold } = useGoldPrice();
  const { data: labor } = useLaborCost();
  const weights = getWeightsWithLabor(labor.values);
  // 2 บาท ขึ้นไป — ใช้ค่าแรง/บาท จาก override ของ "1-baht" (key เดียวกัน) หรือ
  // ไม่งั้นใช้ค่า default 1050
  const laborPerBaht =
    labor.values["1-baht"] ??
    weights.find((w) => w.id === "1-baht")?.laborBase ??
    1050;
  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconBag size={13} strokeWidth={2.5} />
        ราคาขาย 96.5% เริ่มต้นวันนี้ — ที่ค่าแรงเริ่มต้น
      </div>
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "60%" }} />
          <col style={{ width: "40%" }} />
        </colgroup>
        <thead className="bg-maroon text-white">
          <tr>
            <th className="px-2.5 py-1.5 text-left font-bold text-xs">น้ำหนัก</th>
            <th className="px-2.5 py-1.5 text-right font-bold text-xs">
              ราคาขาย (฿)
            </th>
          </tr>
        </thead>
        <tbody>
          {weights
            .filter((w) => !w.perBaht)
            .map((w, i) => {
              const r = computeSellPrice96(w, gold.pricePerBaht);
              return (
                <tr
                  key={w.id}
                  className={`border-b border-bdr/40 ${i % 2 === 0 ? "bg-cream/40" : ""}`}
                >
                  <td className="px-2.5 py-1.5 text-txt font-semibold">
                    {w.label}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                    {formatThaiNumber(Math.round(r.total))}
                  </td>
                </tr>
              );
            })}
          {/* 2 บาท — (ราคาทอง + ค่าแรง 1 บาท) × 2 · ค่าแรง/บาท ใช้ override */}
          <tr className="border-b border-bdr/40 last:border-0 bg-white">
            <td className="px-2.5 py-1.5 text-txt font-semibold">2 บาท</td>
            <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
              {formatThaiNumber(
                Math.round((gold.pricePerBaht + laborPerBaht) * 2),
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
