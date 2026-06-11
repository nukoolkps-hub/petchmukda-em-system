/* ─── GoldPriceHeader — ราคาทองคำแท่งวันนี้ (บนสุดของบทเรียน) ──────
   subscribe /config/goldPrice real-time — โชว์ทั้งราคารับซื้อ + ขายออก
   admin เห็นปุ่ม refresh (เรียก Cloud Function fetchGoldPriceNow)        */

import { Coins as IconCoins, RefreshCw as IconRefresh } from "lucide-react";
import { useState } from "react";
import { triggerFetchGoldPriceNow } from "../../firebase/goldPrice";
import { useGoldPrice } from "../../firebase/hooks/useFirestore";
import { fmtThaiDateTime } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";

interface Props {
  isAdmin?: boolean;
  showToast?: (msg: string) => void;
}

export default function GoldPriceHeader({ isAdmin, showToast }: Props) {
  const { data: gold } = useGoldPrice();
  const [fetching, setFetching] = useState(false);

  async function handleFetchNow() {
    if (fetching) return;
    setFetching(true);
    try {
      const res = await triggerFetchGoldPriceNow();
      if (res.stored) {
        showToast?.(`ดึงราคาใหม่: ฿${formatThaiNumber(res.price)}/บาท`);
      } else {
        showToast?.(`ราคาไม่เปลี่ยน (${formatThaiNumber(res.price)} ฿/บาท)`);
      }
    } catch (err) {
      console.error("[GoldPriceHeader] fetch failed:", err);
      showToast?.(err instanceof Error ? err.message : "ดึงราคาไม่สำเร็จ");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="mb-3 rounded-[14px] overflow-hidden border border-gold/40 bg-white shadow-[0_2px_8px_rgba(90,30,10,0.04)]">
      {/* header bar */}
      <div className="px-3.5 py-2 bg-maroon flex items-center gap-2">
        <IconCoins
          size={14}
          strokeWidth={2.5}
          className="text-gold-lt shrink-0"
        />
        <div className="flex-1 text-white text-xs font-extrabold">
          ราคาทองคำแท่ง 96.5% วันนี้ (สมาคม)
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={handleFetchNow}
            disabled={fetching}
            aria-label="ดึงราคาตอนนี้"
            className="shrink-0 w-7 h-7 rounded-[8px] bg-white/15 text-white cursor-pointer flex items-center justify-center disabled:opacity-50 active:scale-[0.92] transition-transform"
          >
            <IconRefresh
              size={13}
              strokeWidth={2.5}
              className={fetching ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>

      {/* prices */}
      <div className="grid grid-cols-2 divide-x divide-bdr/50">
        <div className="px-3.5 py-3 text-center">
          <div className="text-[11px] font-bold text-red">รับซื้อ</div>
          <div className="mt-0.5 text-xl font-extrabold text-red">
            {gold.buyPrice > 0 ? formatThaiNumber(gold.buyPrice) : "—"}
          </div>
        </div>
        <div className="px-3.5 py-3 text-center">
          <div className="text-[11px] font-bold text-green">ขายออก</div>
          <div className="mt-0.5 text-xl font-extrabold text-green">
            {formatThaiNumber(gold.pricePerBaht)}
          </div>
        </div>
      </div>

      {/* updated at */}
      <div className="px-3.5 py-1.5 bg-cream/60 border-t border-bdr/40 text-[10px] text-txt-soft text-center italic">
        อัปเดต {fmtThaiDateTime(gold.updatedAt)}
        {gold.updatedBy ? ` · ${gold.updatedBy}` : ""} · บาทละ (฿)
      </div>
    </div>
  );
}
