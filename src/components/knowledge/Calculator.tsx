/* ─── Calculator — กล่องคิดเลขสำหรับ block type "calculator" ──────
   render input fields ตาม spec + ปุ่ม "คำนวณ" + แสดง outputs ทันที
   live update ทุกครั้งที่ value เปลี่ยน (ไม่ต้องกดปุ่ม) — ใช้
   useMemo เพื่อ compute ใหม่เมื่อ inputs เปลี่ยน                       */

import { Calculator as IconCalc } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CalcField, CalcOutput } from "../../content/knowledge/types";
import { useGoldPrice } from "../../firebase/hooks/useFirestore";
import { formatThaiNumber } from "../../utils/format";
import MathText from "./MathText";

interface Props {
  title: string;
  inputs: CalcField[];
  compute: (values: Record<string, number>) => CalcOutput[];
}

function formatOutput(
  value: number,
  format: CalcOutput["format"],
  decimals = 2,
): string {
  if (!Number.isFinite(value)) return "—";
  if (format === "currency") return `${formatThaiNumber(Math.round(value))} ฿`;
  // number: ใช้ Intl กำหนด maximumFractionDigits ตาม decimals (default 2)
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export default function Calculator({ title, inputs, compute }: Props) {
  const { data: gold } = useGoldPrice();
  const hasLiveField = inputs.some(
    (f) =>
      f.goldPriceDefault ||
      f.buyPriceDefault ||
      f.silverSellPriceDefault ||
      f.silverBuyPriceDefault,
  );

  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const f of inputs) init[f.id] = f.defaultValue ?? 0;
    return init;
  });
  // field ที่ผู้ใช้พิมพ์แก้เองแล้ว — จะหยุด sync ราคา live ให้ field นั้น
  const [touched, setTouched] = useState<Set<string>>(() => new Set());

  // ช่อง "ราคาทอง" / "ราคารับซื้อ" / "ราคาเงิน" → sync กับราคา live
  useEffect(() => {
    if (!hasLiveField) return;
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of inputs) {
        const live = f.goldPriceDefault
          ? gold.pricePerBaht
          : f.buyPriceDefault
            ? gold.buyPrice
            : f.silverSellPriceDefault
              ? gold.silverSellPerGram
              : f.silverBuyPriceDefault
                ? gold.silverBuyPerGram
                : null;
        if (live && live > 0 && !touched.has(f.id) && next[f.id] !== live) {
          next[f.id] = live;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    hasLiveField,
    gold.pricePerBaht,
    gold.buyPrice,
    gold.silverSellPerGram,
    gold.silverBuyPerGram,
    inputs,
    touched,
  ]);

  const outputs = useMemo(() => {
    try {
      return compute(values);
    } catch {
      return [] as CalcOutput[];
    }
  }, [compute, values]);

  const allFilled = inputs.every(
    (f) => values[f.id] !== undefined && !Number.isNaN(values[f.id]),
  );

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconCalc size={13} strokeWidth={2.5} />
        เครื่องคิดเลข — {title}
      </div>

      {/* inputs */}
      <div className="p-3 space-y-2.5">
        {inputs.map((field) => {
          const disabled = field.disabledWhen?.(values) ?? false;
          return (
          <div
            key={field.id}
            className={`flex items-center gap-2.5 ${disabled ? "opacity-50" : ""}`}
          >
            <label
              htmlFor={`calc-${field.id}`}
              className="text-xs font-semibold text-txt-mid flex-1 min-w-0 leading-snug"
            >
              <MathText>{field.label}</MathText>
              {(field.goldPriceDefault || field.buyPriceDefault) &&
                !touched.has(field.id) && (
                  <span className="ml-1 text-[10px] text-green font-bold">
                    · ราคาวันนี้
                  </span>
                )}
            </label>
            <div className="flex items-center gap-1.5">
              {field.options ? (
                <select
                  id={`calc-${field.id}`}
                  value={values[field.id] ?? 0}
                  disabled={disabled}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [field.id]: Number(e.target.value),
                    }))
                  }
                  className={`w-[142px] px-2 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt font-[inherit] outline-none truncate ${disabled ? "bg-cream-dk cursor-not-allowed" : "bg-white cursor-pointer"}`}
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`calc-${field.id}`}
                  type="number"
                  inputMode="decimal"
                  value={Number.isNaN(values[field.id]) ? "" : values[field.id]}
                  disabled={disabled}
                  onChange={(e) => {
                    // user แก้เอง → หยุด sync ราคา live ให้ field นี้
                    if (field.goldPriceDefault || field.buyPriceDefault) {
                      setTouched((t) =>
                        t.has(field.id) ? t : new Set(t).add(field.id),
                      );
                    }
                    setValues((v) => ({
                      ...v,
                      [field.id]:
                        e.target.value === ""
                          ? Number.NaN
                          : Number(e.target.value),
                    }));
                  }}
                  className={`w-28 px-2 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt text-right font-[inherit] outline-none ${disabled ? "bg-cream-dk cursor-not-allowed" : "bg-white"}`}
                />
              )}
              {field.suffix && (
                <span className="text-xs text-txt-soft font-semibold w-6 text-center whitespace-nowrap">
                  {field.suffix}
                </span>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* outputs */}
      {allFilled && outputs.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-gold/20 bg-cream/40 space-y-1.5">
          {outputs.map((out, i) => (
            <div
              key={`out-${i}`}
              className="flex items-baseline justify-between gap-3 py-1.5"
            >
              <div className="text-xs text-txt-soft flex-1 min-w-0">
                <MathText>{out.label}</MathText>
                {out.hint && (
                  <div className="text-[10px] text-txt-soft/80 italic mt-0.5">
                    <MathText>{out.hint}</MathText>
                  </div>
                )}
              </div>
              <div className="text-base font-extrabold text-maroon whitespace-nowrap">
                {formatOutput(out.value, out.format, out.decimals)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
