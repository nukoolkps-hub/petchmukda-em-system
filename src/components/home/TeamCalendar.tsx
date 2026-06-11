import {
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  Lock as IconLock,
  Sparkles as IconSparkles,
  Store as IconStore,
} from "lucide-react";
import { useState } from "react";
import {
  COLORS as colors,
  LEAVE_TYPES,
  TODAY,
  THAI_MONTH_NAMES as thaiMonthNames,
  THAI_SHORT_WEEKDAY_NAMES as thaiShortDayNames,
} from "../../constants";
import type { Employee, LeaveEntry, StoreCalendar } from "../../types";
import { dateRange, toYMD as toDateKey } from "../../utils/dateUtils";
import { isStoreClosed } from "../../utils/storeCalendar";
import AvatarCircle from "../shared/AvatarCircle";

type CalendarEmployee = Pick<
  Employee,
  "id" | "name" | "avatar" | "avatarType" | "avatarImageUrl"
>;

interface TeamCalendarProps {
  leaveEntries: LeaveEntry[];
  employeeDirectory: CalendarEmployee[];
  storeCalendar?: StoreCalendar | null;
}

/* ─── Team Calendar ────────────────────────────────────────────── */
export default function TeamCalendar({
  leaveEntries,
  employeeDirectory,
  storeCalendar,
}: TeamCalendarProps) {
  const now = new Date();
  const [visibleYear, setVisibleYear] = useState(now.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);

  function showPreviousMonth() {
    if (visibleMonth === 0) {
      setVisibleMonth(11);
      setVisibleYear((year) => year - 1);
    } else {
      setVisibleMonth((month) => month - 1);
    }
  }

  function showNextMonth() {
    if (visibleMonth === 11) {
      setVisibleMonth(0);
      setVisibleYear((year) => year + 1);
    } else {
      setVisibleMonth((month) => month + 1);
    }
  }

  function selectDate(dateKey: string) {
    if (dateKey === selectedDate) return;
    setSelectedDate(dateKey);
  }

  const daysInVisibleMonth = new Date(
    visibleYear,
    visibleMonth + 1,
    0,
  ).getDate();
  const firstDayOfVisibleMonth = new Date(
    visibleYear,
    visibleMonth,
    1,
  ).getDay();
  const calendarCells = [
    ...Array(firstDayOfVisibleMonth).fill(null),
    ...Array.from(
      { length: daysInVisibleMonth },
      (_, dayIndex) => dayIndex + 1,
    ),
  ];

  const leavesByDate: Record<string, LeaveEntry[]> = {};
  leaveEntries.forEach((leaveEntry) => {
    dateRange(leaveEntry.start, leaveEntry.end).forEach((dateKey) => {
      if (!leavesByDate[dateKey]) leavesByDate[dateKey] = [];
      leavesByDate[dateKey].push(leaveEntry);
    });
  });
  const selectedDateLeaves = leavesByDate[selectedDate] || [];

  return (
    <div>
      <div className="bg-white rounded-[18px] px-4 pt-4.5 pb-4 shadow-[0_2px_14px_rgba(90,30,10,0.08)] border border-bdr mb-3.5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-maroon text-lg">ปฏิทินการลา</div>
            <div className="text-sm text-txt-soft mt-0.5">
              แตะวันเพื่อดูรายละเอียด
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={showPreviousMonth}
              className="w-8 h-8 rounded-lg border border-bdr bg-cream cursor-pointer flex items-center justify-center"
            >
              <IconChevronLeft
                size={12}
                color={colors.textMedium}
                strokeWidth={2.5}
              />
            </button>
            <span className="text-sm font-semibold text-txt min-w-[108px] text-center">
              {thaiMonthNames[visibleMonth]} {visibleYear + 543}
            </span>
            <button
              onClick={showNextMonth}
              className="w-8 h-8 rounded-lg border border-bdr bg-cream cursor-pointer flex items-center justify-center"
            >
              <IconChevronRight
                size={12}
                color={colors.textMedium}
                strokeWidth={2.5}
              />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 mb-1.5">
          {thaiShortDayNames.map((dayName, dayIndex) => (
            <div
              key={dayName}
              className={`text-center text-sm font-bold py-[3px] ${dayIndex === 6 ? "text-txt-soft/70" : "text-txt-soft"}`}
            >
              {dayName}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[3px]">
          {calendarCells.map((dayOfMonth, cellIndex) => {
            if (!dayOfMonth) {
              return (
                <div
                  key={`blank-${visibleYear}-${visibleMonth}-${cellIndex}`}
                  className="min-h-[50px]"
                  aria-hidden="true"
                />
              );
            }

            const date = new Date(visibleYear, visibleMonth, dayOfMonth);
            const dateKey = toDateKey(date);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 6;
            const isToday = dateKey === TODAY;
            const isSelectedDate = dateKey === selectedDate;
            const leaveEntriesForDate = leavesByDate[dateKey] || [];
            const hasLeaveEntries = leaveEntriesForDate.length > 0;
            // ปฏิทินเปิด-ปิดร้าน: เสาร์ default ปิด · admin เปิดบางเสาร์/ปิด จ-ศ บางวันได้
            const storeClosed = isStoreClosed(dateKey, storeCalendar);
            const isExtraOpenSat =
              dayOfWeek === 6 &&
              !!storeCalendar?.extraOpenSaturdays?.includes(dateKey);

            return (
              <div
                key={dateKey}
                onClick={() => selectDate(dateKey)}
                className="min-h-[50px] rounded-[10px] px-0.5 pt-[5px] pb-1 cursor-pointer transition-[background-color,border-color,box-shadow] duration-150"
                style={{
                  background: isSelectedDate
                    ? colors.goldPale
                    : storeClosed
                      ? colors.creamDark
                      : isExtraOpenSat
                        ? colors.greenLight
                        : isToday
                          ? "#E8E8E8"
                          : colors.white,
                  border: `1.5px solid ${
                    isSelectedDate
                      ? `${colors.gold}70`
                      : isToday
                        ? "#C8C8C8"
                        : hasLeaveEntries
                          ? `${colors.gold}70`
                          : "transparent"
                  }`,
                  boxShadow: isSelectedDate
                    ? `0 1px 4px ${colors.gold}25`
                    : hasLeaveEntries
                      ? `0 1px 4px ${colors.gold}25`
                      : "none",
                }}
              >
                <div
                  className="text-center text-sm leading-none"
                  style={{
                    fontWeight: isToday || isSelectedDate ? 800 : 500,
                    color: isSelectedDate
                      ? colors.gold
                      : storeClosed
                        ? `${colors.textSoft}80`
                        : isExtraOpenSat
                          ? colors.green
                          : isWeekend
                            ? `${colors.textSoft}80`
                            : isToday
                              ? "#666"
                              : colors.text,
                  }}
                >
                  {dayOfMonth}
                </div>
                {/* marker เปิด-ปิดร้าน (ขนาดเล็กใต้เลข) */}
                {(storeClosed || isExtraOpenSat) && !hasLeaveEntries && (
                  <div
                    className="flex justify-center items-center mt-[2px] text-[8px] font-bold leading-none"
                    style={{
                      color: storeClosed ? colors.textSoft : colors.green,
                    }}
                  >
                    {storeClosed ? (
                      <span className="inline-flex items-center gap-px">
                        <IconLock size={7} strokeWidth={3} />
                        ปิด
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-px">
                        <IconStore size={7} strokeWidth={3} />
                        เปิด
                      </span>
                    )}
                  </div>
                )}
                {hasLeaveEntries && (
                  <div className="flex flex-wrap gap-px justify-center mt-[3px]">
                    {leaveEntriesForDate.slice(0, 3).map((leaveEntry) => {
                      const leaveType = LEAVE_TYPES.find(
                        (type) => type.id === leaveEntry.type,
                      );
                      return (
                        <div
                          key={leaveEntry.id}
                          title={`${leaveEntry.employeeName} (${leaveType?.label || leaveEntry.type})`}
                          className="w-2.5 h-2.5 rounded-full border border-white"
                          style={{
                            background: leaveType?.color || colors.gold,
                          }}
                        />
                      );
                    })}
                    {leaveEntriesForDate.length > 3 && (
                      <div className="min-w-5 h-4 px-1 rounded-full bg-txt-soft flex items-center justify-center text-xs leading-none text-white font-bold">
                        +{leaveEntriesForDate.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3.5 mt-3.5 pt-3 border-t border-cream-dk flex-wrap">
          {LEAVE_TYPES.map((lt) => (
            <div key={lt.id} className="flex items-center gap-[5px]">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: lt.color }}
              />
              <span className="text-sm text-txt-soft">{lt.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-[5px]">
            <div
              className="w-2.5 h-2.5 rounded-[3px] border border-bdr"
              style={{ background: colors.creamDark }}
            />
            <span className="text-sm text-txt-soft">ร้านปิด</span>
          </div>
          <div className="flex items-center gap-[5px]">
            <div
              className="w-2.5 h-2.5 rounded-[3px]"
              style={{ background: colors.greenLight }}
            />
            <span className="text-sm text-txt-soft">เสาร์เปิดพิเศษ</span>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-[18px] p-4 mb-3.5 shadow-[0_2px_14px_rgba(90,30,10,0.08)] border border-bdr">
        <div
          className={`font-bold text-maroon text-base ${selectedDateLeaves.length ? "mb-3" : ""}`}
        >
          {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("th-TH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
        {selectedDateLeaves.length === 0 ? (
          <div className="text-txt-soft text-sm mt-2 text-center">
            <span className="inline-flex items-center gap-1">
              <IconSparkles size={14} strokeWidth={2.4} />
              ไม่มีพนักงานลาในวันนี้
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {selectedDateLeaves.map((leaveEntry) => {
              const leaveType = LEAVE_TYPES.find(
                (type) => type.id === leaveEntry.type,
              );
              const employeeInfo = employeeDirectory.find(
                (employee) => employee.name === leaveEntry.employeeName,
              );
              return (
                <div
                  key={leaveEntry.id}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-cream border border-bdr"
                >
                  <AvatarCircle
                    avatar={
                      employeeInfo?.avatar ||
                      leaveEntry.employeeName?.slice(0, 2)
                    }
                    avatarType={employeeInfo?.avatarType || "text"}
                    avatarImageUrl={employeeInfo?.avatarImageUrl || null}
                    size={38}
                    fontSize={13}
                    border={`2px solid ${colors.gold}40`}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-txt text-base">
                      {leaveEntry.employeeName}
                    </div>
                    <div className="text-sm text-txt-mid mt-0.5 inline-flex items-center gap-1.5">
                      {leaveType?.Icon && (
                        <leaveType.Icon
                          size={13}
                          strokeWidth={2.2}
                          style={{ color: leaveType.color }}
                        />
                      )}
                      {leaveType?.label} · {leaveEntry.days} วันทำการ
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
