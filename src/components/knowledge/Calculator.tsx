/* ─── Calculator — กล่องคิดเลขสำหรับ block type "calculator" ──────
   render input fields ตาม spec + ปุ่ม "คำนวณ" + แสดง outputs ทันที
   live update ทุกครั้งที่ value เปลี่ยน (ไม่ต้องกดปุ่ม) — ใช้
   useMemo เพื่อ compute ใหม่เมื่อ inputs เปลี่ยน                       */

import { Calculator as IconCalc } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CalcField, CalcOutput } from "../../content/knowledge/types";
import { useGoldPrice } from "../../firebase/hooks/useFirestore";
import {
  caretPosFromDigits,
  formatThaiNumber,
  formatTypedNumber,
} from "../../utils/format";
import ThemedSelect from "../shared/ThemedSelect";
import MathText from "./MathText";

interface Props {
  title: string;
  /** สี header การ์ด · default "gold" · "silver" สำหรับเงิน */
  tone?: "gold" | "silver" | "nak";
  inputs: CalcField[];
  compute: (values: Record<string, number>) => CalcOutput[];
  /** ค่าจากภายนอก (เช่น ตัวช่วยปฏิทินกรอกให้) — sync เข้า internal state
   *  เมื่อ value/key ใน object เปลี่ยน · user แก้ต่อได้ตามปกติ */
  presetValues?: Record<string, number>;
}

function formatOutput(
  value: number,
  format: CalcOutput["format"],
  decimals = 2,
  unit?: string,
): string {
  if (!Number.isFinite(value)) return "—";
  if (format === "currency") return `${formatThaiNumber(Math.round(value))} ฿`;
  // number: ใช้ Intl กำหนด maximumFractionDigits ตาม decimals (default 2)
  const formatted = value.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

export default function Calculator({
  title,
  tone = "gold",
  inputs,
  compute,
  presetValues,
}: Props) {
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
    for (const f of inputs) {
      // option fields ต้องมี default (dropdown ต้องเลือกอะไรสักอย่าง)
      // gold/silver fields ที่มี live flag จะถูก sync ทับใน useEffect ด้านล่าง
      // field อื่นๆ ไม่มี defaultValue → ปล่อยว่าง (NaN) ให้ user กรอกเอง
      if (f.defaultValue !== undefined) {
        init[f.id] = f.defaultValue;
      } else {
        init[f.id] = Number.NaN;
      }
    }
    return init;
  });
  // field ที่ผู้ใช้พิมพ์แก้เองแล้ว — จะหยุด sync ราคา live ให้ field นั้น
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  // field ที่กำลัง focus → แสดง raw number (ไม่มี comma) เพื่อให้พิมพ์ทศนิยมได้
  // เมื่อ blur → แสดง formatted (1,234,567) อ่านง่าย
  const [focusedField, setFocusedField] = useState<string | null>(null);
  // raw text ตอนกำลังพิมพ์ — preserve "3." ระหว่างพิมพ์ทศนิยม (Number("3.")=3
  // จะทำให้ค่าสูญหายระหว่างพิมพ์) · clear เมื่อ blur
  const [rawTexts, setRawTexts] = useState<Record<string, string>>({});
  // หลังใส่ comma สดๆ ตอนพิมพ์ ต้องคืนตำแหน่ง cursor (comma ที่แทรกเข้ามา
  // ทำให้ index เลื่อน) — เก็บ "จำนวนตัวอักษรสำคัญ (เลข/จุด/ลบ) ก่อน cursor"
  // แล้ว map กลับเป็น index ใน string ที่ format แล้วใน useLayoutEffect
  const pendingCaret = useRef<{ id: string; digits: number } | null>(null);
  useLayoutEffect(() => {
    const p = pendingCaret.current;
    if (!p) return;
    pendingCaret.current = null;
    const el = document.getElementById(
      `calc-${p.id}`,
    ) as HTMLInputElement | null;
    if (!el) return;
    const pos = caretPosFromDigits(el.value, p.digits);
    el.setSelectionRange(pos, pos);
  });

  // ช่อง "ราคาทอง" / "ราคารับซื้อ" / "ราคาเงิน" → sync กับราคา live
  useEffect(() => {
    if (!hasLiveField) return;
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of inputs) {
        const rawLive = f.goldPriceDefault
          ? gold.pricePerBaht
          : f.buyPriceDefault
            ? gold.buyPrice
            : f.silverSellPriceDefault
              ? gold.silverSellPerGram
              : f.silverBuyPriceDefault
                ? gold.silverBuyPerGram
                : null;
        const live =
          rawLive !== null && f.buyPriceMultiplier
            ? rawLive * f.buyPriceMultiplier
            : rawLive;
        // readOnly → ข้าม touched flag (sync ตลอด · user แก้ไม่ได้)
        const skipTouch = f.readOnly;
        if (
          live &&
          live > 0 &&
          (skipTouch || !touched.has(f.id)) &&
          next[f.id] !== live
        ) {
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

  // sync presetValues (จาก parent · เช่น date helper) เข้า state เมื่อค่าเปลี่ยน
  // ใช้ stringify เพื่อ detect การเปลี่ยนของ object content (กัน re-run ไม่จำเป็น)
  const presetKey = presetValues
    ? Object.entries(presetValues)
        .map(([k, v]) => `${k}=${v}`)
        .join(",")
    : "";
  useEffect(() => {
    if (!presetValues) return;
    setValues((prev) => ({ ...prev, ...presetValues }));
    // biome-ignore lint/correctness/useExhaustiveDependencies: ใช้ presetKey เป็น stable signal แทน object identity
  }, [presetKey]);

  const outputs = useMemo(() => {
    try {
      return compute(values);
    } catch {
      return [] as CalcOutput[];
    }
  }, [compute, values]);

  const allFilled = inputs.every((f) => {
    // ข้าม hidden + disabled field (ไม่นับเป็น input ที่ user ต้องกรอก)
    if (f.hidden) return true;
    if (f.disabledWhen?.(values)) return true;
    return values[f.id] !== undefined && !Number.isNaN(values[f.id]);
  });

  const isSilver = tone === "silver";
  const isNak = tone === "nak";
  const cardBorder = isSilver
    ? "border-silver-lt/60"
    : isNak
      ? "border-rose-gold-lt/60"
      : "border-gold/40";
  const headerBg = isSilver
    ? "bg-silver-lt/30 text-silver-dk border-b border-silver-lt/60"
    : isNak
      ? "bg-rose-gold-lt/30 text-rose-gold-dk border-b border-rose-gold-lt/60"
      : "bg-gold-pale text-maroon border-b border-gold/30";

  return (
    <div
      className={`mb-3 rounded-[12px] border-[1.5px] ${cardBorder} overflow-hidden bg-white`}
    >
      <div
        className={`px-3 py-2 ${headerBg} text-xs font-extrabold inline-flex items-center gap-1.5 w-full`}
      >
        <IconCalc size={13} strokeWidth={2.5} />
        เครื่องคิดเลข — {title}
      </div>

      {/* inputs */}
      <div className="p-3 space-y-2.5">
        {inputs.map((field) => {
          // hidden field — ค่ายังอยู่ใน values แต่ไม่ render UI
          if (field.hidden) return null;
          const disabled = field.disabledWhen?.(values) ?? false;
          // คำนวณ live value ตอนนี้ (เทียบกับค่าใน values เพื่อแสดง "ราคาวันนี้")
          // ถ้า user แก้ค่าให้ตรงราคาวันนี้พอดี → badge กลับมาแสดงอีก
          const rawLiveBadge = field.goldPriceDefault
            ? gold.pricePerBaht
            : field.buyPriceDefault
              ? gold.buyPrice
              : field.silverSellPriceDefault
                ? gold.silverSellPerGram
                : field.silverBuyPriceDefault
                  ? gold.silverBuyPerGram
                  : null;
          const liveBadge =
            rawLiveBadge !== null && field.buyPriceMultiplier
              ? rawLiveBadge * field.buyPriceMultiplier
              : rawLiveBadge;
          const showLiveBadge =
            (field.goldPriceDefault ||
              field.buyPriceDefault ||
              field.silverSellPriceDefault ||
              field.silverBuyPriceDefault) &&
            liveBadge !== null &&
            liveBadge > 0 &&
            Math.abs((values[field.id] ?? 0) - liveBadge) < 0.005;
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
                {showLiveBadge && (
                  <span
                    className={`ml-1 text-[10px] font-bold ${
                      field.buyPriceDefault || field.silverBuyPriceDefault
                        ? "text-red"
                        : "text-green"
                    }`}
                  >
                    · ราคาวันนี้
                  </span>
                )}
              </label>
              <div className="flex items-center gap-1.5">
                {field.options ? (
                  <ThemedSelect
                    value={String(values[field.id] ?? 0)}
                    disabled={disabled}
                    onChange={(v) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.id]: Number(v),
                      }))
                    }
                    options={field.options.map((opt) => ({
                      value: String(opt.value),
                      label: opt.label,
                    }))}
                    inline
                    className={`w-[142px] flex items-center px-2 pr-7 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt font-[inherit] truncate text-left ${disabled ? "bg-cream-dk cursor-not-allowed" : "bg-white cursor-pointer"}`}
                  />
                ) : field.readOnly ? (
                  // readOnly → render เป็นตัวเลขเฉยๆ ไม่มี input box (auto-calc)
                  <span className="w-28 px-2 py-1 text-sm font-bold text-txt text-right tabular-nums">
                    {Number.isFinite(values[field.id])
                      ? values[field.id].toLocaleString("th-TH", {
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </span>
                ) : (
                  <input
                    id={`calc-${field.id}`}
                    type="text"
                    inputMode="decimal"
                    value={
                      focusedField === field.id &&
                      rawTexts[field.id] !== undefined
                        ? formatTypedNumber(rawTexts[field.id])
                        : Number.isNaN(values[field.id])
                          ? ""
                          : values[field.id].toLocaleString("th-TH", {
                              maximumFractionDigits: 4,
                            })
                    }
                    disabled={disabled}
                    onFocus={() => {
                      setFocusedField(field.id);
                      setRawTexts((r) => ({
                        ...r,
                        [field.id]: Number.isNaN(values[field.id])
                          ? ""
                          : String(values[field.id]),
                      }));
                    }}
                    onBlur={() => {
                      setFocusedField(null);
                      setRawTexts((r) => {
                        const next = { ...r };
                        delete next[field.id];
                        return next;
                      });
                    }}
                    onChange={(e) => {
                      // เก็บตำแหน่ง cursor เป็น "จำนวนตัวอักษรสำคัญก่อน cursor"
                      // เพื่อคืนตำแหน่งหลัง comma ถูกแทรก (ดู useLayoutEffect)
                      const caret =
                        e.target.selectionStart ?? e.target.value.length;
                      const digitsBefore = e.target.value
                        .slice(0, caret)
                        .replace(/[^\d.-]/g, "").length;
                      pendingCaret.current = {
                        id: field.id,
                        digits: digitsBefore,
                      };
                      // user แก้เอง → หยุด sync ราคา live ให้ field นี้
                      if (
                        field.goldPriceDefault ||
                        field.buyPriceDefault ||
                        field.silverSellPriceDefault ||
                        field.silverBuyPriceDefault
                      ) {
                        setTouched((t) =>
                          t.has(field.id) ? t : new Set(t).add(field.id),
                        );
                      }
                      // strip commas + non-numeric (ยกเว้นจุดทศนิยม + ลบ)
                      const raw = e.target.value.replace(/,/g, "");
                      // เก็บ raw text เพื่อให้พิมพ์ "3." ต่อ "79" ได้
                      setRawTexts((r) => ({ ...r, [field.id]: raw }));
                      setValues((v) => ({
                        ...v,
                        [field.id]:
                          raw === "" || raw === "-" || raw === "."
                            ? Number.NaN
                            : Number(raw),
                      }));
                    }}
                    className={`w-28 px-2 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt text-right font-[inherit] outline-none tabular-nums ${disabled ? "bg-cream-dk cursor-not-allowed" : "bg-white"}`}
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
            <div key={`out-${i}`} className="py-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-txt-soft flex-1 min-w-0">
                  <MathText>{out.label}</MathText>
                </div>
                <div className="text-base font-extrabold text-maroon whitespace-nowrap">
                  {formatOutput(out.value, out.format, out.decimals, out.unit)}
                </div>
              </div>
              {out.hint && (
                <div className="text-[10px] text-txt-soft/80 italic mt-0.5">
                  <MathText>{out.hint}</MathText>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
