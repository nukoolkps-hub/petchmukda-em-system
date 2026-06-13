/* ─── ChangePriceTable — ตารางค่าเปลี่ยน นน. เท่ากัน (live) ──────
   subscribe goldPrice ตรงจาก Firestore · เลขเปลี่ยนเอง real-time
   เมื่อ admin update ราคาทอง                                        */

import { Coins as IconCoins, RefreshCw as IconRefresh } from "lucide-react";
import { THAI_MONTH_NAMES } from "../../constants";
import { useGoldPrice, useLaborCost } from "../../firebase/hooks/useFirestore";
import {
  computeChangePriceBreakdown,
  getWeightsWithLabor,
} from "../../utils/changePriceUtils";
import { formatThaiNumber } from "../../utils/format";

function fmtUpdatedAt(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const day = d.getDate();
  const month = THAI_MONTH_NAMES[d.getMonth()];
  const yearBE = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${yearBE} · ${hh}:${mm} น.`;
}

export default function ChangePriceTable() {
  const { data: gold, loading } = useGoldPrice();
  const { data: labor } = useLaborCost();
  const weights = getWeightsWithLabor(labor.values);

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      {/* header — ราคาทองวันนี้ */}
      <div className="px-3 py-2.5 bg-gold-pale border-b border-gold/30">
        <div className="flex items-center gap-1.5 text-maroon text-xs font-extrabold">
          <IconCoins size={13} strokeWidth={2.5} />
          ค่าเปลี่ยน นน. เท่ากัน เริ่มต้น — อัปเดตอัตโนมัติ
        </div>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <span className="text-[11px] text-txt-soft font-semibold">
            ราคาทองคำแท่งวันนี้:
          </span>
          {loading ? (
            <span className="inline-flex items-center gap-1 text-xs text-txt-soft">
              <IconRefresh size={11} className="animate-spin" /> โหลด...
            </span>
          ) : (
            <span className="text-base font-extrabold text-maroon">
              {formatThaiNumber(gold.pricePerBaht)} ฿/บาท
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10px] text-txt-soft/90 italic">
          อัปเดต {fmtUpdatedAt(gold.updatedAt)}
          {gold.updatedBy ? ` · โดย ${gold.updatedBy}` : ""}
        </div>
      </div>

      {/* table */}
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "60%" }} />
          <col style={{ width: "40%" }} />
        </colgroup>
        <thead className="bg-maroon text-white">
          <tr>
            <th className="px-2.5 py-1.5 text-left font-bold text-xs">น้ำหนัก</th>
            <th className="px-2.5 py-1.5 text-right font-bold text-xs">
              ค่าเปลี่ยน (฿)
            </th>
          </tr>
        </thead>
        <tbody>
          {weights.map((w) => {
            const breakdown = computeChangePriceBreakdown(w, gold.pricePerBaht);
            return (
              <tr
                key={w.id}
                className="border-b border-bdr/40 last:border-0 odd:bg-cream/40"
              >
                <td className="px-2.5 py-1.5 text-txt font-semibold">
                  {w.label}
                </td>
                <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                  {formatThaiNumber(breakdown.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
