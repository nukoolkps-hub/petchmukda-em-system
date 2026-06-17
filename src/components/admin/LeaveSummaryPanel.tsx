import {
  AlertOctagon as IconAlertOctagon,
  Briefcase as IconBriefcase,
  CalendarDays as IconCalendar,
  CalendarRange as IconCalendarRange,
  ChevronDown as IconChevronDown,
  Cross as IconCross,
  Sun as IconSun,
} from "lucide-react";
import { useMemo, useState } from "react";
import { COLORS } from "../../constants";
import type { Employee, LeaveEntry } from "../../types";
import { fmtDateWithWeekday, todayYmd } from "../../utils/dateUtils";
import AvatarCircle from "../shared/AvatarCircle";
import MonthChevronNav from "../shared/MonthChevronNav";

/* ─── แสดง breakdown วันธรรมดา/อาทิตย์ บรรทัดเดียว ใต้ยอดรวมวันลา ──── */
function LeaveDayBreakdown({
  weekdays,
  sundays,
}: {
  weekdays: number;
  sundays: number;
}) {
  if (weekdays <= 0 && sundays <= 0) return null;
  return (
    <div className="text-[11px] text-txt-soft font-medium mt-0.5 leading-snug whitespace-nowrap flex flex-col items-end gap-0.5">
      {weekdays > 0 && (
        <span className="inline-flex items-center gap-1">
          <IconCalendarRange size={10} strokeWidth={2.4} />
          วันธรรมดา × {weekdays}
        </span>
      )}
      {sundays > 0 && (
        <span className="inline-flex items-center gap-1">
          <IconSun size={10} strokeWidth={2.4} />
          วันอาทิตย์ × {sundays}
          <span className="opacity-70">(×1.5)</span>
        </span>
      )}
    </div>
  );
}

// นับวันธรรมดา/อาทิตย์ในช่วงวันลา (ข้ามเสาร์)
function countByDayType(start: string, end: string) {
  let weekdays = 0;
  let sundays = 0;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const c = new Date(s);
  while (c <= e) {
    const dow = c.getDay();
    if (dow === 0) sundays++;
    else if (dow !== 6) weekdays++;
    c.setDate(c.getDate() + 1);
  }
  return { weekdays, sundays };
}
function sumDayType(leaves: LeaveEntry[]) {
  let weekdays = 0;
  let sundays = 0;
  leaves.forEach((lv) => {
    const r = countByDayType(lv.start, lv.end);
    weekdays += r.weekdays;
    sundays += r.sundays;
  });
  return { weekdays, sundays };
}

interface LeaveSummaryPanelProps {
  allLeaves: LeaveEntry[];
  employeeDirectory: Employee[];
  /** เดือนที่ดู (YYYY-MM) — controlled โดย AdminPanel · share กับ section
   *  อื่น (LeaveListPanel · SalaryAdminEdit · PayrollSummaryPanel) */
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

/* ─── Admin: Leave Summary (รายเดือน + รายปี) ──────────────────── */
export default function LeaveSummaryPanel({
  allLeaves,
  employeeDirectory,
  selectedMonth,
  onSelectMonth,
}: LeaveSummaryPanelProps) {
  const today = todayYmd();
  const currentMonth = today.slice(0, 7);
  const [selYear, setSelYear] = useState(today.slice(0, 4));
  // key = `${empId}:${type}` — chip ที่ถูกกดให้แสดงรายการวัน
  const [expandedChip, setExpandedChip] = useState<string | null>(null);

  // navMonths = current ∪ selectedMonth ∪ เดือนที่มีใบลา · เรียงใหม่→เก่า
  // (selectedMonth อยู่ใน list เสมอ → effectiveMonth = selectedMonth ตรงๆ)
  const months: string[] = useMemo(
    () =>
      [
        ...new Set([
          currentMonth,
          selectedMonth,
          ...(allLeaves.map((lv) => lv.start.slice(0, 7)) as string[]),
        ]),
      ]
        .sort()
        .reverse(),
    [allLeaves, currentMonth, selectedMonth],
  );
  const effectiveMonth = months.includes(selectedMonth)
    ? selectedMonth
    : currentMonth;
  const years: string[] = (
    [...new Set(allLeaves.map((lv) => lv.start.slice(0, 4)))] as string[]
  )
    .sort()
    .reverse();

  return (
    <div>
      {/* Monthly summary */}
      <div className="bg-white rounded-2xl p-4 mb-3.5 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr">
        <div className="flex items-center justify-between mb-3.5">
          <div className="font-bold text-maroon text-base flex items-center gap-1.5">
            <IconCalendar size={16} strokeWidth={2.4} />
            สรุปรายเดือน
          </div>
          <MonthChevronNav
            months={months}
            selected={effectiveMonth}
            onSelect={onSelectMonth}
          />
        </div>
        {employeeDirectory.length === 0 && (
          <div className="text-txt-soft text-sm text-center py-4">ไม่มีข้อมูล</div>
        )}
        <div className="flex flex-col gap-2">
          {employeeDirectory
            .map((employeeInfo) => {
              const empId = employeeInfo.id;
              const name = employeeInfo.nickname || employeeInfo.name;
              const monthLeaves = allLeaves.filter(
                (lv) =>
                  lv.employeeId === empId &&
                  lv.start.startsWith(effectiveMonth),
              );
              const totalTimes = monthLeaves.length;
              if (totalTimes === 0) return null;
              const { weekdays, sundays } = sumDayType(monthLeaves);
              const totalDays = weekdays + sundays;
              const personalDays = monthLeaves
                .filter((lv) => lv.type === "personal")
                .reduce((s, lv) => s + lv.days, 0);
              const sickDays = monthLeaves
                .filter((lv) => lv.type === "sick")
                .reduce((s, lv) => s + lv.days, 0);
              const overQuota = totalTimes > 2;
              return (
                <div
                  key={empId}
                  className={`px-3.5 py-3 rounded-xl border ${overQuota ? "bg-red-lt border-[#C0392B30]" : "bg-cream border-bdr"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <AvatarCircle
                      avatar={employeeInfo?.avatar || name.slice(0, 2)}
                      avatarType={employeeInfo?.avatarType || "text"}
                      avatarImageUrl={employeeInfo?.avatarImageUrl || null}
                      size={36}
                      fontSize={12}
                      border={`2px solid ${COLORS.gold}40`}
                    />
                    <div className="flex-1">
                      <div className="font-bold text-txt text-sm">{name}</div>
                      <div className="text-xs text-txt-soft">
                        {employeeInfo?.role || "-"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-extrabold text-lg ${overQuota ? "text-red" : "text-maroon"}`}
                      >
                        {totalDays}{" "}
                        <span className="text-xs font-medium text-txt-soft">
                          วัน
                        </span>
                      </div>
                      <LeaveDayBreakdown
                        weekdays={weekdays}
                        sundays={sundays}
                      />
                      {overQuota && (
                        <div className="text-xs text-red font-bold inline-flex items-center gap-1 mt-0.5">
                          <IconAlertOctagon size={11} strokeWidth={2.4} />
                          เกินโควต้า
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {personalDays > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedChip((prev) =>
                            prev === `${empId}:personal`
                              ? null
                              : `${empId}:personal`,
                          )
                        }
                        className={`rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#DDEEFF] text-[#1E40AF] cursor-pointer font-[inherit] border inline-flex items-center gap-1 ${expandedChip === `${empId}:personal` ? "border-[#A8C8F0]" : "border-transparent"}`}
                      >
                        <IconBriefcase size={12} strokeWidth={2.4} />
                        ลากิจ {personalDays} วัน
                      </button>
                    )}
                    {sickDays > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedChip((prev) =>
                            prev === `${empId}:sick` ? null : `${empId}:sick`,
                          )
                        }
                        className={`rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#CCFBF1] text-[#0F766E] cursor-pointer font-[inherit] border inline-flex items-center gap-1 ${expandedChip === `${empId}:sick` ? "border-[#0F766E]" : "border-transparent"}`}
                      >
                        <IconCross size={12} strokeWidth={2.4} />
                        ลาป่วย {sickDays} วัน
                      </button>
                    )}
                  </div>
                  {expandedChip?.startsWith(`${empId}:`) && (
                    <div className="mt-2 pl-2.5 text-xs text-txt-mid border-l-2 border-gold/40 flex flex-col gap-0.5">
                      {monthLeaves
                        .filter((lv) => lv.type === expandedChip.split(":")[1])
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((lv) => (
                          <div key={lv.id} className="flex items-center gap-1">
                            <IconCalendar size={11} strokeWidth={2.4} />
                            {fmtDateWithWeekday(lv.start)}
                            {lv.start !== lv.end
                              ? ` - ${fmtDateWithWeekday(lv.end)}`
                              : ""}{" "}
                            <span className="text-txt-soft">
                              ({lv.days} วัน)
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })
            .filter(Boolean)}
          {employeeDirectory.every(
            (emp) =>
              allLeaves.filter(
                (lv) =>
                  lv.employeeId === emp.id &&
                  lv.start.startsWith(effectiveMonth),
              ).length === 0,
          ) && (
            <div className="text-txt-soft text-sm text-center py-4">
              ไม่มีการลาในเดือนนี้
            </div>
          )}
        </div>
      </div>

      {/* Yearly summary */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr">
        <div className="flex items-center justify-between mb-3.5">
          <div className="font-bold text-maroon text-base flex items-center gap-1.5">
            <IconCalendar size={16} strokeWidth={2.4} />
            สรุปรายปี
          </div>
          <div className="relative inline-block">
            <select
              value={selYear}
              onChange={(e) => setSelYear(e.target.value)}
              className="appearance-none cursor-pointer pl-2.5 pr-7 py-1.5 rounded-lg border border-bdr text-sm text-txt bg-cream font-[inherit] outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  ปี {parseInt(y, 10) + 543}
                </option>
              ))}
            </select>
            <IconChevronDown
              size={12}
              strokeWidth={2.4}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
            />
          </div>
        </div>
        {employeeDirectory.length === 0 && (
          <div className="text-txt-soft text-sm text-center py-4">ไม่มีข้อมูล</div>
        )}
        <div className="flex flex-col gap-2">
          {employeeDirectory
            .map((employeeInfo) => {
              const empId = employeeInfo.id;
              const name = employeeInfo.nickname || employeeInfo.name;
              const yearLeaves = allLeaves.filter(
                (lv) => lv.employeeId === empId && lv.start.startsWith(selYear),
              );
              const totalTimes = yearLeaves.length;
              if (totalTimes === 0) return null;
              const { weekdays, sundays } = sumDayType(yearLeaves);
              const totalDays = weekdays + sundays;
              const personalDays = yearLeaves
                .filter((lv) => lv.type === "personal")
                .reduce((s, lv) => s + lv.days, 0);
              const sickDays = yearLeaves
                .filter((lv) => lv.type === "sick")
                .reduce((s, lv) => s + lv.days, 0);
              const barPct = Math.min(100, (totalDays / 30) * 100);
              return (
                <div
                  key={empId}
                  className="p-3.5 rounded-xl bg-cream border border-bdr"
                >
                  <div className="flex items-center gap-3 mb-2.5">
                    <AvatarCircle
                      avatar={employeeInfo?.avatar || name.slice(0, 2)}
                      avatarType={employeeInfo?.avatarType || "text"}
                      avatarImageUrl={employeeInfo?.avatarImageUrl || null}
                      size={38}
                      fontSize={12}
                      border={`2px solid ${COLORS.gold}40`}
                    />
                    <div className="flex-1">
                      <div className="font-bold text-txt text-sm">{name}</div>
                      <div className="text-sm text-txt-soft">
                        {employeeInfo?.role || "-"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-xl text-maroon">
                        {totalDays}{" "}
                        <span className="text-xs font-medium text-txt-soft">
                          วัน
                        </span>
                      </div>
                      <LeaveDayBreakdown
                        weekdays={weekdays}
                        sundays={sundays}
                      />
                    </div>
                  </div>
                  <div className="bg-cream-dk rounded-md h-[7px] overflow-hidden mb-2.5">
                    <div
                      className="h-full rounded-md bg-linear-to-r from-gold to-gold-lt"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {personalDays > 0 && (
                      <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#DDEEFF] text-[#1E40AF] inline-flex items-center gap-1">
                        <IconBriefcase size={12} strokeWidth={2.4} />
                        ลากิจ {personalDays} วัน
                      </div>
                    )}
                    {sickDays > 0 && (
                      <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#CCFBF1] text-[#0F766E] inline-flex items-center gap-1">
                        <IconCross size={12} strokeWidth={2.4} />
                        ลาป่วย {sickDays} วัน
                      </div>
                    )}
                  </div>
                </div>
              );
            })
            .filter(Boolean)}
          {employeeDirectory.every(
            (emp) =>
              allLeaves.filter(
                (lv) =>
                  lv.employeeId === emp.id && lv.start.startsWith(selYear),
              ).length === 0,
          ) && (
            <div className="text-txt-soft text-sm text-center py-4">
              ไม่มีการลาในปีนี้
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
