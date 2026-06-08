/* ─── ปฏิทินหน้าที่ล่วงหน้า (Duty Forecast) ────────────────────────
   แสดง schedule หน้าที่ตั้งแต่วันนี้ → สิ้นปี เพื่อ forecast เตรียมพร้อม
   ใช้ร่วมกันทั้ง admin (profileId = null → เห็นทุกคน) และพนักงาน
   (profileId set → toggle "เฉพาะของฉัน" ได้)

   คำนวณ client-side จาก server snapshot (pool ที่ resolve แล้ว) — ทั้ง
   2 ฝั่งได้ผลตรงกัน (single source of truth กับ rotation จริง)            */

import {
  CalendarClock as IconCalendarClock,
  CalendarRange as IconCalendarRange,
  UserCheck as IconUserCheck,
  X as IconX,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  DutyAssignmentsSnapshot,
  SnapshotPoolMember,
} from "../../firebase/dutyAssignments";
import type { Duty } from "../../types";
import { toYMD } from "../../utils/dateUtils";
import { computeDutyForecast } from "../../utils/dutyUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";

interface Props {
  duties: Duty[];
  dutyAssignmentsToday: DutyAssignmentsSnapshot | null;
  profileId: string | null; // null = admin (ดูทุกคน)
  onClose: () => void;
}

/** label เดือน (พ.ศ.) จาก "YYYY-MM" → "มิถุนายน 2569" */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return `${d.toLocaleDateString("th-TH", { month: "long" })} ${y + 543}`;
}

/** label ช่วงในเดือน — monthly: "ทั้งเดือน" · weekly ในเดือนเดียว: "8-14"
 *  · weekly คร่อมเดือน: "29 มิ.ย. - 5 ก.ค." */
function formatRangeInMonth(
  start: string,
  end: string,
  period: string,
): string {
  if (period === "monthly") return "ทั้งเดือน";
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}-${e.getDate()}`;
  }
  const sMonth = s.toLocaleDateString("th-TH", { month: "short" });
  const eMonth = e.toLocaleDateString("th-TH", { month: "short" });
  return `${s.getDate()} ${sMonth} - ${e.getDate()} ${eMonth}`;
}

interface ForecastItem {
  start: string;
  end: string;
  dutyId: string;
  dutyName: string;
  period: "weekly" | "monthly";
  primaryEmpId: string | null;
}

export default function DutyForecastModal({
  duties,
  dutyAssignmentsToday,
  profileId,
  onClose,
}: Props) {
  // พนักงาน default = เฉพาะของฉัน · admin ไม่มี profileId → ดูทั้งหมดเสมอ
  const [mineOnly, setMineOnly] = useState<boolean>(!!profileId);

  const todayYmd = toYMD(new Date());
  const endYmd = `${new Date().getFullYear()}-12-31`;
  const beYear = new Date().getFullYear() + 543;

  // pool ที่ resolve แล้ว + ข้อมูลคน จาก snapshot (self-contained)
  const { poolByDutyId, empById } = useMemo(() => {
    const pools = new Map<string, string[]>();
    const emps = new Map<string, SnapshotPoolMember>();
    for (const a of dutyAssignmentsToday?.assignments || []) {
      pools.set(
        a.dutyId,
        a.pool.map((m) => m.id),
      );
      for (const m of a.pool) emps.set(m.id, m);
    }
    return { poolByDutyId: pools, empById: emps };
  }, [dutyAssignmentsToday]);

  const forecast = useMemo(
    () => computeDutyForecast(duties, poolByDutyId, todayYmd, endYmd),
    [duties, poolByDutyId, todayYmd, endYmd],
  );

  // flatten ทุก period → item เดียว เรียงตามวันที่ (แล้วชื่อหน้าที่)
  const allItems = useMemo(() => {
    const items: ForecastItem[] = [];
    for (const f of forecast) {
      for (const p of f.periods) {
        items.push({
          start: p.start,
          end: p.end,
          dutyId: f.dutyId,
          dutyName: f.dutyName,
          period: f.period,
          primaryEmpId: p.primaryEmpId,
        });
      }
    }
    items.sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.dutyName.localeCompare(b.dutyName, "th"),
    );
    return items;
  }, [forecast]);

  // group เป็นเดือน (ตาม start) — "ทั้งเดือนแยกเป็นเดือนๆ"
  const months = useMemo(() => {
    const filtered =
      profileId && mineOnly
        ? allItems.filter((it) => it.primaryEmpId === profileId)
        : allItems;
    const map = new Map<string, ForecastItem[]>();
    for (const it of filtered) {
      const ym = it.start.slice(0, 7);
      const list = map.get(ym);
      if (list) list.push(it);
      else map.set(ym, [it]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, items]) => ({ ym, label: monthLabel(ym), items }));
  }, [allItems, profileId, mineOnly]);

  const hasData = (dutyAssignmentsToday?.assignments?.length || 0) > 0;
  const showPerson = !(profileId && mineOnly);

  return (
    <BaseModal onClose={onClose} maxWidthClass="max-w-[560px]">
      <div className="sticky top-0 z-10 bg-cream px-5 py-4 border-b border-bdr flex items-center gap-3">
        <div className="w-10 h-10 rounded-[11px] bg-gold-pale flex items-center justify-center shrink-0">
          <IconCalendarRange
            size={20}
            strokeWidth={2.4}
            className="text-maroon"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">ปฏิทินหน้าที่ล่วงหน้า</div>
          <div className="text-xs text-txt-soft mt-0.5">
            ตารางหมุนเวียนถึงสิ้นปี พ.ศ. {beYear}
          </div>
        </div>
        <button
          type="button"
          aria-label="ปิด"
          onClick={onClose}
          className="w-9 h-9 rounded-[10px] border border-bdr bg-white text-txt-mid cursor-pointer flex items-center justify-center"
        >
          <IconX size={18} strokeWidth={2.3} />
        </button>
      </div>

      <div className="px-4 py-3.5">
        {/* toggle เฉพาะของฉัน — เฉพาะฝั่งพนักงาน */}
        {profileId && (
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMineOnly(true)}
              className={`flex-1 py-2 rounded-[9px] text-sm font-semibold cursor-pointer font-[inherit] border-[1.5px] active:scale-[0.98] transition-transform ${
                mineOnly
                  ? "bg-maroon text-white border-maroon"
                  : "bg-white text-txt-mid border-bdr"
              }`}
            >
              เฉพาะของคุณ
            </button>
            <button
              type="button"
              onClick={() => setMineOnly(false)}
              className={`flex-1 py-2 rounded-[9px] text-sm font-semibold cursor-pointer font-[inherit] border-[1.5px] active:scale-[0.98] transition-transform ${
                !mineOnly
                  ? "bg-maroon text-white border-maroon"
                  : "bg-white text-txt-mid border-bdr"
              }`}
            >
              ทั้งหมด
            </button>
          </div>
        )}

        {/* note */}
        <div className="text-xs text-txt-soft mb-3 leading-relaxed">
          ตารางตามรอบหมุนเวียน (ยังไม่รวมการลา/คนแทน) — ใช้สำหรับวางแผนล่วงหน้า
        </div>

        {!hasData ? (
          <div className="text-center text-txt-soft py-10 px-6">
            ยังไม่มีข้อมูลตาราง — ลองรีเฟรชหลัง admin ตั้งค่าหน้าที่
          </div>
        ) : months.length === 0 ? (
          <div className="text-center text-txt-soft py-10 px-6">
            <div className="flex justify-center mb-3 text-gold">
              <IconUserCheck size={40} strokeWidth={1.8} />
            </div>
            คุณยังไม่มีหน้าที่ในช่วงที่เหลือของปีนี้
          </div>
        ) : (
          /* ─── view: แยกตามเดือน ─── */
          <div className="flex flex-col gap-3.5">
            {months.map((mth) => (
              <div
                key={mth.ym}
                className="rounded-[12px] border border-bdr bg-white overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 bg-maroon">
                  <IconCalendarClock
                    size={16}
                    strokeWidth={2.4}
                    className="text-gold-lt shrink-0"
                  />
                  <div className="flex-1 min-w-0 font-bold text-sm text-gold-lt">
                    {mth.label}
                  </div>
                </div>
                <div className="flex flex-col">
                  {mth.items.map((it, i) => {
                    const emp = it.primaryEmpId
                      ? empById.get(it.primaryEmpId)
                      : null;
                    const isMe = !!profileId && it.primaryEmpId === profileId;
                    return (
                      <div
                        key={`${it.dutyId}-${it.start}-${i}`}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm border-t border-bdr/60 ${
                          isMe ? "bg-gold-pale/70" : "bg-white"
                        }`}
                      >
                        <div className="w-[78px] shrink-0 font-bold text-maroon text-center">
                          {formatRangeInMonth(it.start, it.end, it.period)}
                        </div>
                        <div className="flex-1 min-w-0 font-semibold text-txt truncate">
                          {it.dutyName}
                        </div>
                        {showPerson &&
                          (emp ? (
                            <div className="shrink-0 flex items-center gap-1.5 max-w-[42%]">
                              <AvatarCircle
                                avatar={emp.avatar}
                                avatarType={emp.avatarType}
                                avatarImageUrl={emp.avatarImageUrl}
                                size={22}
                                fontSize={10}
                                border="none"
                              />
                              <span
                                className={`truncate text-xs ${isMe ? "font-bold text-maroon" : "font-semibold text-txt-mid"}`}
                              >
                                {emp.nickname || emp.name}
                                {isMe && (
                                  <span className="ml-1 text-[11px] text-maroon-lt font-bold">
                                    (คุณ)
                                  </span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="shrink-0 text-txt-soft italic text-xs">
                              ยังไม่มีคน
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
