/* ─── GoldPriceHeader — ราคาทองคำแท่งวันนี้ (บนสุดของความรู้ต่างๆ) ──────
   subscribe /config/goldPrice real-time — โชว์ทั้งราคารับซื้อ + ขายออก
   admin เห็นปุ่ม refresh (เรียก Cloud Function fetchGoldPriceNow)        */

import {
  Coins as IconCoins,
  Gem as IconGem,
  RefreshCw as IconRefresh,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { triggerFetchGoldPriceNow } from "../../firebase/goldPrice";
import { useGoldPrice } from "../../firebase/hooks/useFirestore";
import { fmtThaiDateTime } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";

interface Props {
  isAdmin?: boolean;
  showToast?: (msg: string) => void;
}

export default function GoldPriceHeader({ isAdmin, showToast }: Props) {
  const { data: gold, loading } = useGoldPrice();
  const [fetching, setFetching] = useState(false);
  // auto-retry หนึ่งครั้งต่อ session — กัน infinite loop ถ้า fetch fail ซ้ำ
  const autoRetried = useRef(false);

  async function handleFetchNow() {
    if (fetching) return;
    setFetching(true);
    try {
      const res = await triggerFetchGoldPriceNow();
      if (res.stored) {
        showToast?.(`ดึงราคาใหม่: ${formatThaiNumber(res.price)} ฿/บาท`);
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

  // Auto-retry: ถ้า admin เปิดหน้ามาเจอ default state (updatedAt = 0)
  // → trigger fetchGoldPriceNow อัตโนมัติ 1 ครั้ง (silent · ไม่มี toast)
  // กัน user ต้องกดเองทุกครั้งที่ doc ยังไม่มีข้อมูล
  useEffect(() => {
    if (!isAdmin || loading) return;
    if (gold.updatedAt > 0) return; // doc มีข้อมูลแล้ว ไม่ต้อง retry
    if (autoRetried.current) return; // ลองไปแล้วในรอบนี้
    autoRetried.current = true;
    triggerFetchGoldPriceNow().catch((err) => {
      console.warn("[GoldPriceHeader] auto-retry failed:", err);
    });
  }, [isAdmin, loading, gold.updatedAt]);

  const fmtSilver = (n: number) =>
    n.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const hasSilver =
    gold.updatedAt > 0 &&
    (gold.silverBuyPerGram > 0 || gold.silverSellPerGram > 0);

  return (
    <>
      {/* ── ทองคำแท่ง ── */}
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

        {/* prices — ทองคำ (บาทละ) */}
        <div className="grid grid-cols-2 divide-x divide-bdr/50">
          <div className="px-3.5 py-3 text-center">
            <div className="text-[11px] font-bold text-red">รับซื้อ</div>
            <div className="mt-0.5 text-xl font-extrabold text-red">
              {gold.updatedAt > 0 && gold.buyPrice > 0
                ? formatThaiNumber(gold.buyPrice)
                : "—"}
            </div>
          </div>
          <div className="px-3.5 py-3 text-center">
            <div className="text-[11px] font-bold text-green">ขายออก</div>
            <div className="mt-0.5 text-xl font-extrabold text-green">
              {gold.updatedAt > 0 ? formatThaiNumber(gold.pricePerBaht) : "—"}
            </div>
          </div>
        </div>

        {/* updated at */}
        <div className="px-3.5 py-1.5 bg-cream/60 border-t border-bdr/40 text-[10px] text-txt-soft text-center italic">
          อัปเดต {fmtThaiDateTime(gold.updatedAt)}
          {gold.updatedBy ? ` · ${gold.updatedBy}` : ""} · บาทละ (฿)
        </div>
      </div>

      {/* ── เงินแท่ง — แสดงเฉพาะเมื่อมีข้อมูล silver > 0 ── */}
      {hasSilver && (
        <div className="mb-3 rounded-[14px] overflow-hidden border border-silver-lt/60 bg-white shadow-[0_2px_8px_rgba(58,58,64,0.06)]">
          {/* header bar — silver tone (graphite-gray) */}
          <div className="px-3.5 py-2 bg-silver flex items-center gap-2">
            <IconGem
              size={14}
              strokeWidth={2.5}
              className="text-silver-lt shrink-0"
            />
            <div className="flex-1 text-white text-xs font-extrabold">
              ราคาเงินแท่ง 99.99% วันนี้ (ชายนิ่งโกลล์)
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

          {/* prices — เงิน (กรัมละ) */}
          <div className="grid grid-cols-2 divide-x divide-bdr/50">
            <div className="px-3.5 py-3 text-center">
              <div className="text-[11px] font-bold text-red">รับซื้อ</div>
              <div className="mt-0.5 text-xl font-extrabold text-red">
                {gold.silverBuyPerGram > 0
                  ? fmtSilver(gold.silverBuyPerGram)
                  : "—"}
              </div>
            </div>
            <div className="px-3.5 py-3 text-center">
              <div className="text-[11px] font-bold text-green">
                ขายออก{" "}
                <span className="text-[9px] text-txt-soft font-semibold">
                  (รวม VAT 7%)
                </span>
              </div>
              <div className="mt-0.5 text-xl font-extrabold text-green">
                {gold.silverSellPerGram > 0
                  ? fmtSilver(gold.silverSellPerGram)
                  : "—"}
              </div>
            </div>
          </div>

          {/* updated at */}
          <div className="px-3.5 py-1.5 bg-cream/60 border-t border-bdr/40 text-[10px] text-txt-soft text-center italic">
            กรัมละ (฿)
          </div>
        </div>
      )}
    </>
  );
}
