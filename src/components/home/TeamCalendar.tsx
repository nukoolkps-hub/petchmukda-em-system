import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import {
  C,
  LEAVE_TYPES,
  TH_DAYS_SHORT,
  TH_MONTHS,
  TODAY,
} from "../../constants";
import { dateRange, toYMD } from "../../utils/dateUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Team Calendar ────────────────────────────────────────────── */
export default function TeamCalendar({ allLeaves, empDir }) {
  const now = new Date();
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());
  const [sel, setSel] = useState<string | null>(TODAY);
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
  const dim = new Date(vy, vm + 1, 0).getDate(),
    fd = new Date(vy, vm, 1).getDay();
  const cells = [
    ...Array(fd).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  const leaveMap = {};
  allLeaves.forEach((lv) => {
    dateRange(lv.start, lv.end).forEach((ds) => {
      if (!leaveMap[ds]) leaveMap[ds] = [];
      leaveMap[ds].push(lv);
    });
  });
  const selLeaves = sel ? leaveMap[sel] || [] : [];
  return (
    <div>
      <div className="bg-white rounded-[18px] px-4 pt-4.5 pb-4 shadow-[0_2px_14px_rgba(90,30,10,0.08)] border border-bdr mb-3.5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-maroon text-[17px]">ปฏิทินการลา</div>
            <div className="text-[13px] text-txt-soft mt-0.5">
              แตะวันเพื่อดูรายละเอียด
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevM}
              className="w-8 h-8 rounded-lg border border-bdr bg-cream cursor-pointer flex items-center justify-center"
            >
              <IconChevronLeft size={12} color={C.textMid} stroke={2.5} />
            </button>
            <span className="text-sm font-semibold text-txt min-w-[108px] text-center">
              {TH_MONTHS[vm]} {vy + 543}
            </span>
            <button
              onClick={nextM}
              className="w-8 h-8 rounded-lg border border-bdr bg-cream cursor-pointer flex items-center justify-center"
            >
              <IconChevronRight size={12} color={C.textMid} stroke={2.5} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 mb-1.5">
          {TH_DAYS_SHORT.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-bold py-[3px] ${i === 6 ? "text-txt-soft/70" : "text-txt-soft"}`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[3px]">
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} />;
            const ds = toYMD(new Date(vy, vm, d)),
              dow = new Date(vy, vm, d).getDay();
            const isWknd = dow === 6,
              isToday = ds === TODAY,
              isSel = ds === sel;
            const lvList = leaveMap[ds] || [],
              hasLv = lvList.length > 0;
            return (
              <div
                key={idx}
                onClick={() => setSel(isSel ? null : ds)}
                className="min-h-[50px] rounded-[10px] px-0.5 pt-[5px] pb-1 cursor-pointer transition-all"
                style={{
                  background: isSel
                    ? "#E8E8E8"
                    : isToday
                      ? C.goldPale
                      : C.white,
                  border: `1.5px solid ${isSel ? "#C8C8C8" : hasLv ? `${C.gold}70` : "transparent"}`,
                  boxShadow: isSel
                    ? "0 2px 6px rgba(0,0,0,0.10)"
                    : hasLv
                      ? `0 1px 4px ${C.gold}25`
                      : "none",
                }}
              >
                <div
                  className="text-center text-[13px] leading-none"
                  style={{
                    fontWeight: isToday || isSel ? 800 : 500,
                    color: isSel
                      ? "#666"
                      : isWknd
                        ? `${C.textSoft}80`
                        : isToday
                          ? C.gold
                          : C.text,
                  }}
                >
                  {isToday && !isSel ? (
                    <span className="inline-flex w-[22px] h-[22px] rounded-full bg-gold text-white items-center justify-center text-xs font-extrabold">
                      {d}
                    </span>
                  ) : (
                    d
                  )}
                </div>
                {hasLv && (
                  <div className="flex flex-wrap gap-px justify-center mt-[3px]">
                    {lvList.slice(0, 3).map((lv, i) => {
                      const lt = LEAVE_TYPES.find((t) => t.id === lv.type);
                      return (
                        <div
                          key={i}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] text-white font-bold border border-white"
                          style={{ background: lt?.color || C.gold }}
                        >
                          {lv.av?.charAt(0) || "?"}
                        </div>
                      );
                    })}
                    {lvList.length > 3 && (
                      <div className="w-3.5 h-3.5 rounded-full bg-txt-soft flex items-center justify-center text-[7px] text-white font-bold">
                        +{lvList.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3.5 mt-3.5 pt-3 border-t border-cream-dk">
          <div className="flex items-center gap-[5px]">
            <div className="w-2.5 h-2.5 rounded-full bg-gold" />
            <span className="text-xs text-txt-soft">ลากิจ</span>
          </div>
          <div className="flex items-center gap-[5px]">
            <div className="w-2.5 h-2.5 rounded-full bg-red" />
            <span className="text-xs text-txt-soft">ลาป่วย</span>
          </div>
        </div>
      </div>
      {sel && (
        <div className="bg-white rounded-[18px] p-4 mb-3.5 shadow-[0_2px_14px_rgba(90,30,10,0.08)] border border-bdr">
          <div
            className={`font-bold text-maroon text-[15px] ${selLeaves.length ? "mb-3" : ""}`}
          >
            {new Date(`${sel}T00:00:00`).toLocaleDateString("th-TH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          {selLeaves.length === 0 ? (
            <div className="text-txt-soft text-sm mt-2 text-center">
              ✨ ไม่มีพนักงานลาในวันนี้
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {selLeaves.map((lv, i) => {
                const lt = LEAVE_TYPES.find((t) => t.id === lv.type);
                const empInfo = empDir.find((e) => e.name === lv.empName);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-cream border border-bdr"
                  >
                    <AvatarCircle
                      av={empInfo?.av || lv.av}
                      avType={empInfo?.avType || "text"}
                      img={empInfo?.img || null}
                      size={38}
                      fontSize={13}
                      border={`2px solid ${C.gold}40`}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-txt text-[15px]">
                        {lv.empName}
                      </div>
                      <div className="text-[13px] text-txt-mid mt-0.5">
                        {lt?.icon} {lt?.label} · {lv.days} วันทำการ
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
