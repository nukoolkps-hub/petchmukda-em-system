/* ─── LaborCostTable — ค่าแรง เริ่มต้น (ทอง 96.5%) live ──────────────
   subscribe /config/laborCost · admin แก้ค่าได้จาก admin panel ·
   render ตามรูปแบบเดียวกับตารางใน knowledge (ก่อนหน้านี้ hardcode)      */

import { Tag as IconTag } from "lucide-react";
import { useLaborCost } from "../../firebase/hooks/useFirestore";
import { getWeightsWithLabor } from "../../utils/changePriceUtils";
import { formatThaiNumber } from "../../utils/format";

export default function LaborCostTable() {
  const { data: labor } = useLaborCost();
  const weights = getWeightsWithLabor(labor.values);
  // แยก "2 บาท ขึ้นไป" ออกมาบรรทัดสุดท้าย (perBaht: true)
  const normalWeights = weights.filter((w) => !w.perBaht);
  const perBaht = weights.find((w) => w.perBaht);

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconTag size={13} strokeWidth={2.5} />
        ค่าแรง เริ่มต้น — ที่ admin ตั้งไว้
      </div>
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: "60%" }} />
          <col style={{ width: "40%" }} />
        </colgroup>
        <thead className="bg-maroon text-white">
          <tr>
            <th className="px-2.5 py-1.5 text-left font-bold text-xs">
              น้ำหนัก
            </th>
            <th className="px-2.5 py-1.5 text-right font-bold text-xs">
              ค่าแรงเริ่มต้น (฿)
            </th>
          </tr>
        </thead>
        <tbody>
          {normalWeights.map((w, i) => (
            <tr
              key={w.id}
              className={`border-b border-bdr/40 ${i % 2 === 0 ? "bg-cream/40" : ""}`}
            >
              <td className="px-2.5 py-1.5 text-txt font-semibold">
                {w.label}
              </td>
              <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                {formatThaiNumber(w.laborBase)}
              </td>
            </tr>
          ))}
          {perBaht && (
            <tr className="border-b border-bdr/40 last:border-0 bg-white">
              <td className="px-2.5 py-1.5 text-txt font-semibold">
                2 บาท ขึ้นไป
              </td>
              <td className="px-2.5 py-1.5 text-right font-extrabold text-maroon">
                บาทละ {formatThaiNumber(perBaht.laborBase)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
