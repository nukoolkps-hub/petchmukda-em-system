/* ─── GoldPricePanel — admin update ราคาทองคำไทย ──────────────────
   doc เดียว: /config/goldPrice
   - กรอกราคาทองคำแท่งบาทละ → บันทึก
   - ค่า real-time sync ไปทุกหน้า (calculators + change-price-table)   */

import {
  AlertTriangle as IconAlert,
  Coins as IconCoins,
  RefreshCw as IconRefresh,
  Save as IconSave,
  TrendingUp as IconTrend,
  Zap as IconZap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";
import { triggerFetchGoldPriceNow } from "../../firebase/goldPrice";
import type { GoldPrice } from "../../types";
import { formatThaiNumber } from "../../utils/format";

interface Props {
  goldPrice: GoldPrice;
  /** ชื่อ admin ที่ login (เก็บ trail ว่าใคร update) */
  adminName: string;
  onUpdate: (pricePerBaht: number, updatedBy: string) => Promise<void>;
  showToast?: (msg: string) => void;
}

function fmtUpdatedAt(ms: number): string {
  if (!ms) return "ยังไม่เคยอัปเดต";
  const d = new Date(ms);
  const day = d.getDate();
  const month = THAI_MONTH_NAMES[d.getMonth()];
  const yearBE = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${yearBE} เวลา ${hh}:${mm} น.`;
}

export default function GoldPricePanel({
  goldPrice,
  adminName,
  onUpdate,
  showToast,
}: Props) {
  const [draft, setDraft] = useState<string>(
    String(goldPrice.pricePerBaht || ""),
  );
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  const isAutoSource = goldPrice.updatedBy.startsWith("auto");

  // sync draft เมื่อ goldPrice เปลี่ยน (เช่น admin ตัวอื่น update)
  useEffect(() => {
    setDraft(String(goldPrice.pricePerBaht || ""));
  }, [goldPrice.pricePerBaht]);

  const parsed = Number(draft);
  const isValid = Number.isFinite(parsed) && parsed > 0;
  const dirty = parsed !== goldPrice.pricePerBaht;
  const diff = isValid ? parsed - goldPrice.pricePerBaht : 0;

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onUpdate(parsed, adminName);
      showToast?.(`บันทึกราคาทอง ฿${formatThaiNumber(parsed)}/บาท แล้ว`);
    } catch (err) {
      console.error("[GoldPrice] save failed:", err);
      showToast?.("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

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
      console.error("[GoldPrice] fetch failed:", err);
      const msg = err instanceof Error ? err.message : "ดึงราคาไม่สำเร็จ";
      showToast?.(msg);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div>
      {/* header */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="w-10 h-10 rounded-[11px] bg-gold-pale flex items-center justify-center shrink-0">
          <IconCoins size={20} strokeWidth={2.4} className="text-maroon" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt leading-tight">
            ราคาทองคำวันนี้
          </div>
          <div className="text-xs text-txt-soft">
            อัปเดตเมื่อราคาขยับ · ใช้คำนวณค่าเปลี่ยนในบทเรียนแบบ real-time
          </div>
        </div>
      </div>

      {/* current price card */}
      <div className="bg-white rounded-[14px] border border-bdr p-4 mb-4 shadow-[0_2px_8px_rgba(90,30,10,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-txt-soft font-semibold uppercase tracking-wide">
              ราคาปัจจุบัน
            </div>
            <div className="mt-1 text-2xl font-extrabold text-maroon">
              ฿{formatThaiNumber(goldPrice.pricePerBaht)}
              <span className="text-sm font-bold text-txt-soft">/บาท</span>
            </div>
          </div>
          {isAutoSource && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-lt border border-green/40 text-green text-[10px] font-bold">
              <IconZap size={10} strokeWidth={3} />
              อัตโนมัติ
            </span>
          )}
        </div>
        <div className="mt-2 text-xs text-txt-soft">
          อัปเดต {fmtUpdatedAt(goldPrice.updatedAt)}
          {goldPrice.updatedBy ? ` · โดย ${goldPrice.updatedBy}` : ""}
        </div>
        <button
          type="button"
          onClick={handleFetchNow}
          disabled={fetching}
          className="mt-3 w-full px-3 py-2 rounded-[10px] bg-gold-pale border border-gold/40 text-maroon font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          <IconRefresh
            size={12}
            strokeWidth={2.5}
            className={fetching ? "animate-spin" : ""}
          />
          {fetching ? "กำลังดึงราคา..." : "ดึงราคาตอนนี้ (สมาคมค้าทองคำ)"}
        </button>
        <div className="mt-2 text-[10px] text-txt-soft/80 italic text-center">
          ระบบดึงอัตโนมัติทุก 15 นาที · กดปุ่มเพื่อดึงทันที
        </div>
        {goldPrice.lastFetchError &&
          goldPrice.lastFetchErrorAt > goldPrice.updatedAt && (
            <div className="mt-2 px-3 py-2 rounded-[8px] bg-red/10 border border-red/30 flex items-start gap-2">
              <IconAlert
                size={13}
                strokeWidth={2.5}
                className="text-red shrink-0 mt-px"
              />
              <div className="text-[11px] text-red leading-relaxed break-all">
                <strong>ดึงราคาล่าสุดไม่สำเร็จ:</strong> {goldPrice.lastFetchError}
              </div>
            </div>
          )}
      </div>

      {/* edit card */}
      <div className="bg-white rounded-[14px] border border-bdr p-4 shadow-[0_2px_8px_rgba(90,30,10,0.04)]">
        <label
          htmlFor="gold-price-input"
          className="text-xs font-bold text-txt-mid block mb-2"
        >
          ราคาใหม่ (บาท / บาททอง)
        </label>
        <div className="flex items-stretch gap-2">
          <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] border-bdr focus-within:border-maroon bg-cream/30">
            <span className="text-base font-extrabold text-txt-soft">฿</span>
            <input
              id="gold-price-input"
              type="number"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 min-w-0 text-base font-extrabold text-txt bg-transparent font-[inherit] outline-none"
              placeholder="เช่น 50,000"
            />
            <span className="text-xs text-txt-soft font-semibold">/บาท</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || !dirty || saving}
            className="px-4 rounded-[10px] bg-maroon text-white font-extrabold text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96] transition-transform"
          >
            <IconSave size={14} strokeWidth={2.5} />
            บันทึก
          </button>
        </div>

        {dirty && isValid && goldPrice.pricePerBaht > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <IconTrend
              size={12}
              strokeWidth={2.5}
              className={diff >= 0 ? "text-green" : "text-red rotate-180"}
            />
            <span
              className={
                diff >= 0 ? "text-green font-bold" : "text-red font-bold"
              }
            >
              {diff >= 0 ? "+" : ""}
              {formatThaiNumber(Math.round(diff))} ฿/บาท
            </span>
            <span className="text-txt-soft">เทียบราคาเดิม</span>
          </div>
        )}

        <div className="mt-3 px-3 py-2 rounded-[8px] bg-gold-pale/60 border border-gold/30 text-[11px] text-txt-mid leading-relaxed">
          <strong className="text-maroon">หมายเหตุ:</strong> ใช้ราคาทองคำแท่ง
          (ไม่ใช่รูปพรรณ) อ้างอิงจากสมาคมค้าทองคำ — เปลี่ยนเมื่อราคาขยับ
        </div>
      </div>
    </div>
  );
}
