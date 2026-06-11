/* ─── Calculator — กล่องคิดเลขสำหรับ block type "calculator" ──────
   render input fields ตาม spec + ปุ่ม "คำนวณ" + แสดง outputs ทันที
   live update ทุกครั้งที่ value เปลี่ยน (ไม่ต้องกดปุ่ม) — ใช้
   useMemo เพื่อ compute ใหม่เมื่อ inputs เปลี่ยน                       */

import { Calculator as IconCalc } from "lucide-react";
import { useMemo, useState } from "react";
import type { CalcField, CalcOutput } from "../../content/knowledge/types";
import { formatThaiNumber } from "../../utils/format";

interface Props {
  title: string;
  inputs: CalcField[];
  compute: (values: Record<string, number>) => CalcOutput[];
}

function formatOutput(value: number, format: CalcOutput["format"]): string {
  if (!Number.isFinite(value)) return "—";
  if (format === "currency") return `฿${formatThaiNumber(Math.round(value))}`;
  return formatThaiNumber(Math.round(value * 100) / 100);
}

export default function Calculator({ title, inputs, compute }: Props) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const f of inputs) init[f.id] = f.defaultValue ?? 0;
    return init;
  });

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
        {inputs.map((field) => (
          <div key={field.id} className="flex items-center gap-2.5">
            <label
              htmlFor={`calc-${field.id}`}
              className="text-xs font-semibold text-txt-mid flex-1 min-w-0 leading-snug"
            >
              {field.label}
            </label>
            <div className="flex items-center gap-1.5">
              {field.options ? (
                <select
                  id={`calc-${field.id}`}
                  value={values[field.id] ?? 0}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [field.id]: Number(e.target.value),
                    }))
                  }
                  className="px-2 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt bg-white font-[inherit] outline-none cursor-pointer"
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
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [field.id]:
                        e.target.value === ""
                          ? Number.NaN
                          : Number(e.target.value),
                    }))
                  }
                  className="w-28 px-2 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt text-right bg-white font-[inherit] outline-none"
                />
              )}
              {field.suffix && (
                <span className="text-xs text-txt-soft font-semibold w-8">
                  {field.suffix}
                </span>
              )}
            </div>
          </div>
        ))}
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
                {out.label}
                {out.hint && (
                  <div className="text-[10px] text-txt-soft/80 italic mt-0.5">
                    {out.hint}
                  </div>
                )}
              </div>
              <div className="text-base font-extrabold text-maroon whitespace-nowrap">
                {formatOutput(out.value, out.format)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
