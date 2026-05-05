import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { C, TH_DAYS_SHORT, TH_MONTHS, TODAY } from "../../constants";
import { fmtShort, toYMD } from "../../utils/dateUtils";

/* ─── Calendar date picker ─────────────────────────────────────── */
export default function CalendarPicker({ value, onChange, minDate, error }) {
  const [open, setOpen] = useState(false);
  const initD = value ? new Date(`${value}T00:00:00`) : new Date();
  const [vy, setVy] = useState(initD.getFullYear());
  const [vm, setVm] = useState(initD.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (value) {
      const d = new Date(`${value}T00:00:00`);
      setVy(d.getFullYear());
      setVm(d.getMonth());
    }
  }, [value]);
  const dim = new Date(vy, vm + 1, 0).getDate(),
    fd = new Date(vy, vm, 1).getDay();
  const cells = [
    ...Array(fd).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  function prevM() {
    if (vm === 0) {
      setVm(11);
      setVy((y) => y - 1);
    } else setVm((m) => m - 1);
  }
  function nextM() {
    if (vm === 11) {
      setVm(0);
      setVy((y) => y + 1);
    } else setVm((m) => m + 1);
  }
  function pick(d) {
    onChange(toYMD(new Date(vy, vm, d)));
    setOpen(false);
  }
  function cState(d) {
    if (!d) return "empty";
    const dow = new Date(vy, vm, d).getDay(),
      ds = toYMD(new Date(vy, vm, d));
    if (minDate && ds < minDate) return "disabled";
    if (dow === 6) return "weekend";
    if (value && ds === value) return "selected";
    if (ds === TODAY) return "today";
    return "normal";
  }
  const has = !!value;
  return (
    <div ref={ref} className="relative mb-3.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] cursor-pointer font-[inherit] box-border transition-all border-[1.5px]
          ${has ? "bg-gold-pale/30" : "bg-white"}
          ${open ? "shadow-[0_0_0_3px_var(--color-gold)/0.13]" : "shadow-none"}
          ${error ? "border-red" : open ? "border-gold" : has ? "border-[#C9973A90]" : "border-bdr"}`}
      >
        <div
          className={`w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center ${has ? "bg-linear-135 from-gold to-gold-lt" : "bg-cream-dk"}`}
        >
          <IconCalendar
            size={18}
            color={has ? "#fff" : C.textSoft}
            stroke={2}
          />
        </div>
        <div className="flex-1 text-left">
          <div
            className={`text-base ${has ? "font-semibold text-txt" : "font-normal text-txt-soft"}`}
          >
            {has ? fmtShort(value) : "เลือกวันที่"}
          </div>
        </div>
        <IconChevronDown
          size={16}
          color={C.textSoft}
          stroke={2.5}
          className={`transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>
      {error && <div className="text-red text-[13px] mt-1.5">⚠ {error}</div>}
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-400 bg-white rounded-2xl px-4 pt-4.5 pb-3.5 shadow-[0_16px_48px_rgba(90,30,10,0.15)] border border-bdr animate-[calFade_0.18s_ease]">
          <div className="flex items-center justify-between mb-3.5">
            <button
              onClick={prevM}
              className="w-8 h-8 rounded-lg border border-bdr bg-cream cursor-pointer flex items-center justify-center"
            >
              <IconChevronLeft size={14} color={C.textMid} stroke={2.5} />
            </button>
            <div className="font-bold text-[15px] text-maroon">
              {TH_MONTHS[vm]} {vy + 543}
            </div>
            <button
              onClick={nextM}
              className="w-8 h-8 rounded-lg border border-bdr bg-cream cursor-pointer flex items-center justify-center"
            >
              <IconChevronRight size={14} color={C.textMid} stroke={2.5} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1.5">
            {TH_DAYS_SHORT.map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs font-semibold py-1 ${i === 6 ? "text-txt-soft/40" : "text-txt-soft"}`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-[3px]">
            {cells.map((d, i) => {
              const st = cState(d),
                ok = st === "normal" || st === "today";
              return (
                <button
                  key={i}
                  onClick={() => ok && pick(d)}
                  className={`h-[34px] rounded-lg font-[inherit] text-[13px] border-none
                  ${!d ? "cursor-default" : ok ? "cursor-pointer" : "cursor-not-allowed"}
                  ${st === "selected" || st === "today" ? "font-bold" : "font-normal"}`}
                  style={{
                    background:
                      st === "selected"
                        ? `linear-gradient(135deg,${C.gold},${C.goldLt})`
                        : st === "today"
                          ? "#E8E8E8"
                          : "transparent",
                    color: !d
                      ? "transparent"
                      : st === "selected"
                        ? "#fff"
                        : st === "disabled" || st === "weekend"
                          ? C.border
                          : st === "today"
                            ? "#666"
                            : C.text,
                    boxShadow:
                      st === "selected" ? `0 2px 8px ${C.gold}50` : "none",
                  }}
                >
                  {d || ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
