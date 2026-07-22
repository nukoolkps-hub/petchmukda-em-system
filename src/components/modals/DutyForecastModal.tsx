/* ─── ปฏิทินหน้าที่ล่วงหน้า (Duty Forecast) ────────────────────────
   แสดง schedule หน้าที่ตั้งแต่วันนี้ → สิ้นปี เพื่อ forecast เตรียมพร้อม
   ใช้ร่วมกันทั้ง admin (profileId = null → เห็นทุกคน) และพนักงาน
   (profileId set → toggle "เฉพาะของฉัน" ได้)

   คำนวณ client-side จาก server snapshot (pool ที่ resolve แล้ว) — ทั้ง
   2 ฝั่งได้ผลตรงกัน (single source of truth กับ rotation จริง)            */

import {
  ArrowRight as IconArrowRight,
  CalendarClock as IconCalendarClock,
  CalendarRange as IconCalendarRange,
  CalendarX as IconCalendarX,
  UserCheck as IconUserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  CoverageForecastItem,
  DutyAssignmentsSnapshot,
  SnapshotPoolMember,
} from "../../firebase/dutyAssignments";
import type { Duty, Employee, LeaveEntry, StoreCalendar } from "../../types";
import { toYMD } from "../../utils/dateUtils";
import {
  type CoverageSegment,
  computeCoverageCounts,
  computeDutyCounts,
  computeDutyForecast,
  computeDutyHistory,
} from "../../utils/dutyUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";
import ModalHeader from "../shared/ModalHeader";
import ThemedSelect from "../shared/ThemedSelect";

interface Props {
  duties: Duty[];
  dutyAssignmentsToday: DutyAssignmentsSnapshot | null;
  /** การลาทั้งหมด → ใช้คำนวณคนแทนล่วงหน้า (ใครลา ใครแทน วันไหน) */
  allLeaves: LeaveEntry[];
  storeCalendar?: StoreCalendar | null;
  profileId: string | null; // null = admin (ดูทุกคน)
  /** admin: employee directory → ใช้นับ coverage counts (แท็บ "จำนวนครั้ง")
   *  ไม่ส่ง = ฝั่งพนักงาน → แท็บจำนวนครั้งแสดงเฉพาะหน้าที่หมุนเวียน */
  employees?: Employee[];
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
  coverage?: CoverageSegment[];
}

/** label วันที่สั้นในเดือน · ช่วง 1 วัน = "3" · หลายวัน = "3-5" */
function segDayLabel(start: string, end: string): string {
  const sd = Number(start.slice(8, 10));
  const ed = Number(end.slice(8, 10));
  return sd === ed ? `${sd}` : `${sd}-${ed}`;
}

/** label วันของการ์ดคนแทน — วันเดียวโชว์เลขเดียว ("8" ไม่ใช่ "8-8" กันสับสน) ·
 *  หลายวันใช้ช่วง (same-month "8-10" · คร่อมเดือน "29 มิ.ย. - 2 ก.ค.") */
function formatCoverageDay(start: string, end: string): string {
  if (start === end) return `${new Date(`${start}T00:00:00`).getDate()}`;
  return formatRangeInMonth(start, end, "weekly");
}

/** รายการในเดือน — การ์ดช่วงวัน (rotation) หรือการ์ดคนแทน (coverage)
 *  รวมเรียงตามวันเริ่มใน list เดียว → การ์ดคนแทนแทรกต่อจากการ์ดสัปดาห์
 *  ที่ครอบวันลานั้น (ไม่กองอยู่ท้ายเดือน) */
type MonthEntry =
  | {
      type: "dates";
      start: string;
      end: string;
      period: "weekly" | "monthly";
      items: ForecastItem[];
    }
  | { type: "coverage"; start: string; item: CoverageForecastItem };

export default function DutyForecastModal({
  duties,
  dutyAssignmentsToday,
  allLeaves,
  storeCalendar,
  profileId,
  employees,
  onClose,
}: Props) {
  // พนักงาน default = เฉพาะของฉัน · admin ไม่มี profileId → ดูทั้งหมดเสมอ
  const [mineOnly, setMineOnly] = useState<boolean>(!!profileId);
  // ล่วงหน้า (default) / ย้อนหลัง / จำนวนครั้ง (สรุปนับทั้งปี · เฉพาะที่ทำแล้ว)
  const [view, setView] = useState<"future" | "past" | "counts">("future");
  // กรองเฉพาะหน้าที่เดียว ("" = ทุกหน้าที่) — ช่วยดูว่าหน้าที่นั้นคนซ้ำไหม
  const [dutyFilter, setDutyFilter] = useState<string>("");
  const isPast = view === "past";
  const isCounts = view === "counts";

  const todayYmd = toYMD(new Date());
  const endYmd = `${new Date().getFullYear()}-12-31`;
  const beYear = new Date().getFullYear() + 543;
  // ย้อนหลัง 3 เดือน (ตั้งแต่วันที่ 1 ของเดือน 3 เดือนก่อน)
  const historyFromYmd = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 3);
    return toYMD(d);
  }, []);

  // pool ที่ resolve แล้ว + ข้อมูลคน จาก snapshot (self-contained)
  // แหล่ง pool = dutyPools (roster ของทุก duty) เพื่อให้ forecast มี pool แม้
  // วันอาทิตย์ที่ weekly+skipSundays ถูกตัดจาก assignments · fallback assignments
  // สำหรับ snapshot เก่าที่ยังไม่มี dutyPools (backward compat)
  const { poolByDutyId, empById } = useMemo(() => {
    const pools = new Map<string, string[]>();
    const emps = new Map<string, SnapshotPoolMember>();
    const dutyPools = dutyAssignmentsToday?.dutyPools;
    if (dutyPools) {
      for (const [dutyId, dp] of Object.entries(dutyPools)) {
        pools.set(
          dutyId,
          dp.pool.map((m) => m.id),
        );
        for (const m of dp.pool) emps.set(m.id, m);
      }
    } else {
      for (const a of dutyAssignmentsToday?.assignments || []) {
        pools.set(
          a.dutyId,
          a.pool.map((m) => m.id),
        );
        for (const m of a.pool) emps.set(m.id, m);
      }
    }
    return { poolByDutyId: pools, empById: emps };
  }, [dutyAssignmentsToday]);

  const forecast = useMemo(
    () =>
      computeDutyForecast(
        duties,
        poolByDutyId,
        todayYmd,
        endYmd,
        allLeaves,
        storeCalendar,
      ),
    [duties, poolByDutyId, todayYmd, endYmd, allLeaves, storeCalendar],
  );

  // ประวัติย้อนหลัง — คำนวณเฉพาะตอนเปิด view "ย้อนหลัง"
  const history = useMemo(
    () =>
      isPast
        ? computeDutyHistory(duties, poolByDutyId, historyFromYmd, todayYmd)
        : [],
    [isPast, duties, poolByDutyId, historyFromYmd, todayYmd],
  );

  const activeForecast = isPast ? history : forecast;

  // สรุป "จำนวนครั้ง" รวมทั้งปี — นับเฉพาะที่ทำไปแล้ว (ตั้งแต่ต้นปี → วันนี้ ·
  // ไม่รวมล่วงหน้า) · rotation จากสูตร · coverage นับจากใบลาจริง (admin ส่ง
  // employees → นับ coverage ได้ · ฝั่งพนักงานไม่มี employees → แสดงเฉพาะหมุนเวียน)
  const yearStartYmd = `${todayYmd.slice(0, 4)}-01-01`;
  const hasEmployees = !!employees && employees.length > 0;
  const dutyCounts = useMemo(() => {
    if (!isCounts) return new Map<string, Map<string, number>>();
    const merged = computeDutyCounts(
      duties,
      poolByDutyId,
      yearStartYmd,
      todayYmd,
    );
    if (hasEmployees && employees) {
      for (const [dutyId, m] of computeCoverageCounts(
        duties,
        employees,
        allLeaves,
        yearStartYmd,
        todayYmd,
      )) {
        merged.set(dutyId, m);
      }
    }
    return merged;
  }, [
    isCounts,
    yearStartYmd,
    duties,
    poolByDutyId,
    todayYmd,
    hasEmployees,
    employees,
    allLeaves,
  ]);

  // แถวสรุปจำนวน — ต่อหน้าที่ (rotation ก่อน coverage) · เรียงคนตาม count มาก→น้อย
  // coverage แสดงเฉพาะเมื่อมี employees (คำนวณได้) · ไม่งั้นซ่อน (กันขึ้น 0 ลวง)
  const countRows = useMemo(() => {
    if (!isCounts) return [];
    const ordered = [
      ...duties.filter((d) => d.kind !== "coverage"),
      ...(hasEmployees ? duties.filter((d) => d.kind === "coverage") : []),
    ];
    return ordered
      .filter((d) => !dutyFilter || d.id === dutyFilter)
      .map((d) => {
        const m = dutyCounts.get(d.id) || new Map<string, number>();
        const people = [...m.entries()]
          .sort(
            (a, b) =>
              b[1] - a[1] ||
              (empById.get(a[0])?.nickname || "").localeCompare(
                empById.get(b[0])?.nickname || "",
                "th",
              ),
          )
          .map(([empId, count]) => ({
            empId,
            count,
            emp: empById.get(empId),
          }));
        return { duty: d, people };
      });
  }, [isCounts, duties, dutyFilter, dutyCounts, empById, hasEmployees]);

  // flatten ทุก period → item เดียว เรียงตามวันที่ (แล้วชื่อหน้าที่)
  const allItems = useMemo(() => {
    const items: ForecastItem[] = [];
    for (const f of activeForecast) {
      for (const p of f.periods) {
        items.push({
          start: p.start,
          end: p.end,
          dutyId: f.dutyId,
          dutyName: f.dutyName,
          period: f.period,
          primaryEmpId: p.primaryEmpId,
          coverage: p.coverage,
        });
      }
    }
    items.sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.dutyName.localeCompare(b.dutyName, "th"),
    );
    return items;
  }, [activeForecast]);

  // coverage duty (แทนคนลา) ล่วงหน้า — server-computed ใน snapshot · เฉพาะ
  // ของฉัน = ฉันเป็นคนแทน หรือฉันคือคนที่ลา · ย้อนหลังไม่มี coverage (แสดงคนหลัก)
  const coverageForecast = useMemo<CoverageForecastItem[]>(() => {
    if (isPast) return [];
    const all = dutyAssignmentsToday?.coverageForecast || [];
    if (!(profileId && mineOnly)) return all;
    return all.filter(
      (c) => c.substituteEmpId === profileId || c.targetEmpId === profileId,
    );
  }, [isPast, dutyAssignmentsToday, profileId, mineOnly]);

  // group 2 ชั้น: เดือน → วัน (card ต่อช่วงวัน · ในการ์ดมีหลายหน้าที่) +
  // coverage entries ของเดือนนั้น (แยกการ์ด amber)
  const months = useMemo(() => {
    // เฉพาะของฉัน = เป็น primary หรือเป็น "คนแทน" ในช่วงไหนของ period นี้
    // (พนักงานจะได้เห็นว่าต้องไปแทนใครวันไหนด้วย ไม่ใช่แค่เวรตัวเอง)
    // + กรองเฉพาะหน้าที่ที่เลือก (dutyFilter) ถ้าตั้งไว้
    const filtered = allItems.filter((it) => {
      if (dutyFilter && it.dutyId !== dutyFilter) return false;
      if (profileId && mineOnly) {
        return (
          it.primaryEmpId === profileId ||
          it.coverage?.some((s) => s.substituteEmpId === profileId)
        );
      }
      return true;
    });
    // ym → { dates: dateKey → items[], coverage: [] }
    const byMonth = new Map<
      string,
      { dates: Map<string, ForecastItem[]>; coverage: CoverageForecastItem[] }
    >();
    const ensure = (ym: string) => {
      let e = byMonth.get(ym);
      if (!e) {
        e = { dates: new Map(), coverage: [] };
        byMonth.set(ym, e);
      }
      return e;
    };
    for (const it of filtered) {
      const { dates } = ensure(it.start.slice(0, 7));
      const dateKey = `${it.start}__${it.end}`;
      const list = dates.get(dateKey);
      if (list) list.push(it);
      else dates.set(dateKey, [it]);
    }
    for (const c of coverageForecast) {
      if (dutyFilter && c.dutyId !== dutyFilter) continue;
      ensure(c.start.slice(0, 7)).coverage.push(c);
    }
    // รวมการ์ด rotation + การ์ดคนแทนเป็น list เดียวเรียงตามวันเริ่ม —
    // วันเริ่มตรงกันให้ rotation มาก่อน (การ์ดคนแทนอยู่ใต้สัปดาห์ที่ครอบวันลา)
    // ย้อนหลัง: เรียงเดือน + ช่วงวัน จากใหม่→เก่า (ล่าสุดอยู่บนสุด)
    const dir = isPast ? -1 : 1;
    return [...byMonth.entries()]
      .sort((a, b) => dir * a[0].localeCompare(b[0]))
      .map(([ym, e]) => {
        const entries: MonthEntry[] = [
          ...[...e.dates.values()].map(
            (items): MonthEntry => ({
              type: "dates",
              start: items[0].start,
              end: items[0].end,
              period: items[0].period,
              items,
            }),
          ),
          ...e.coverage.map(
            (c): MonthEntry => ({ type: "coverage", start: c.start, item: c }),
          ),
        ].sort(
          (a, b) =>
            dir * a.start.localeCompare(b.start) ||
            (a.type === b.type ? 0 : a.type === "dates" ? -1 : 1),
        );
        return { ym, label: monthLabel(ym), entries };
      });
  }, [allItems, coverageForecast, profileId, mineOnly, dutyFilter, isPast]);

  const hasData =
    (dutyAssignmentsToday?.assignments?.length || 0) > 0 ||
    Object.keys(dutyAssignmentsToday?.dutyPools || {}).length > 0;
  const showPerson = !(profileId && mineOnly);

  return (
    <BaseModal onClose={onClose} maxWidthClass="max-w-[560px]">
      <ModalHeader
        Icon={IconCalendarRange}
        title="ปฏิทินหน้าที่"
        subtitle={
          isCounts
            ? `จำนวนครั้ง — รวมทั้งปี พ.ศ. ${beYear} (เฉพาะที่ทำไปแล้ว)`
            : isPast
              ? "ย้อนหลัง 3 เดือน (คำนวณจากสูตรหมุนเวียน)"
              : `ตารางหมุนเวียนถึงสิ้นปี พ.ศ. ${beYear}`
        }
        onClose={onClose}
      />

      <div className="px-4 py-3.5">
        {/* toggle ล่วงหน้า / ย้อนหลัง / จำนวนครั้ง */}
        <div className="flex gap-2 mb-3">
          {(
            [
              ["future", "ล่วงหน้า"],
              ["past", "ย้อนหลัง"],
              ["counts", "จำนวนครั้ง"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-[9px] text-sm font-semibold cursor-pointer font-[inherit] border-[1.5px] active:scale-[0.98] transition-transform ${
                view === v
                  ? "bg-maroon text-white border-maroon"
                  : "bg-white text-txt-mid border-bdr"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* กรองเฉพาะหน้าที่ — ช่วยดูว่าหน้าที่นั้นคนซ้ำในเดือนไหม (รวม coverage) */}
        <div className="mb-3">
          <ThemedSelect
            value={dutyFilter}
            onChange={setDutyFilter}
            options={[
              { value: "", label: "ทุกหน้าที่" },
              ...duties.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>

        {/* note ย้อนหลัง — ไม่ใช่ log จริง */}
        {isPast && (
          <div className="text-xs text-txt-mid mb-3 leading-relaxed bg-gold-pale/50 border border-gold/30 rounded-[9px] px-3 py-2">
            <IconCalendarX
              size={12}
              strokeWidth={2.4}
              className="inline mr-1 -mt-0.5 text-maroon"
            />
            ย้อนหลังคำนวณจากสูตรหมุนเวียนด้วยรายชื่อปัจจุบัน (ระบบไม่ได้เก็บ log เวรรายวัน) —
            ตรงกับที่เกิดจริงเฉพาะช่วงที่คนในตำแหน่งไม่เปลี่ยน · แสดง "คนหลัก" ตามรอบ
            ไม่รวมผลการลา/คนแทน
          </div>
        )}

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

        {/* note (ล่วงหน้า) */}
        {view === "future" && (
          <div className="text-xs text-txt-soft mb-3 leading-relaxed">
            ตารางตามรอบหมุนเวียน + คนแทนช่วงที่มีคนลา (เท่าที่ยื่นลาไว้ล่วงหน้า) —
            ใช้สำหรับวางแผนล่วงหน้า
          </div>
        )}

        {/* note (จำนวนครั้ง) */}
        {isCounts && (
          <div className="text-xs text-txt-mid mb-3 leading-relaxed bg-gold-pale/50 border border-gold/30 rounded-[9px] px-3 py-2">
            นับ <b>ตั้งแต่ต้นปีถึงวันนี้</b> — เฉพาะที่ทำไปแล้ว (ไม่รวมล่วงหน้า) ·
            หน้าที่หมุนเวียนนับจากสูตร · แทนคนลานับจากใบลาจริง
            {!hasEmployees && " · (ฝั่งนี้แสดงเฉพาะหน้าที่หมุนเวียน)"}
          </div>
        )}

        {isCounts ? (
          countRows.every((r) => r.people.length === 0) ? (
            <div className="text-center text-txt-soft py-10 px-6">
              ยังไม่มีใครทำหน้าที่ในปีนี้
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {countRows.map(({ duty, people }) => (
                <div
                  key={duty.id}
                  className="rounded-[11px] border border-bdr bg-white overflow-hidden"
                >
                  <div className="px-3 py-1.5 bg-gold-pale/60 border-b border-bdr flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-maroon truncate">
                      {duty.name}
                    </span>
                    <span className="text-[11px] text-txt-soft shrink-0">
                      {duty.kind === "coverage" ? "แทนคนลา" : "หมุนเวียน"}
                    </span>
                  </div>
                  {people.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-txt-soft italic">
                      ยังไม่มีในปีนี้
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {people.map(({ empId, count, emp }) => (
                        <div
                          key={empId}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm border-t border-bdr/50 first:border-t-0"
                        >
                          {emp && (
                            <AvatarCircle
                              avatar={emp.avatar}
                              avatarType={emp.avatarType}
                              avatarImageUrl={emp.avatarImageUrl}
                              size={22}
                              fontSize={10}
                              border="none"
                            />
                          )}
                          <span className="flex-1 min-w-0 font-semibold text-txt truncate">
                            {emp?.nickname || emp?.name || empId}
                          </span>
                          <span className="shrink-0 font-bold text-maroon">
                            {count} ครั้ง
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : !hasData ? (
          <div className="text-center text-txt-soft py-10 px-6">
            ยังไม่มีข้อมูลตาราง — ลองรีเฟรชหลัง ADMIN ตั้งค่าหน้าที่
          </div>
        ) : months.length === 0 ? (
          <div className="text-center text-txt-soft py-10 px-6">
            <div className="flex justify-center mb-3 text-gold">
              <IconUserCheck size={40} strokeWidth={1.8} />
            </div>
            {isPast
              ? "ไม่มีประวัติในช่วง 3 เดือนที่ผ่านมา"
              : profileId && mineOnly
                ? "คุณยังไม่มีหน้าที่ในช่วงที่เหลือของปีนี้"
                : "ยังไม่มีหน้าที่ในช่วงที่เหลือของปีนี้"}
          </div>
        ) : (
          /* ─── view: เดือน → การ์ดต่อวัน → หน้าที่ + ชื่อ ─── */
          <div className="flex flex-col gap-3.5">
            {months.map((mth) => (
              <div key={mth.ym}>
                {/* หัวข้อเดือน */}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-maroon rounded-[12px] mb-2">
                  <IconCalendarClock
                    size={16}
                    strokeWidth={2.4}
                    className="text-gold-lt shrink-0"
                  />
                  <div className="flex-1 min-w-0 font-bold text-sm text-gold-lt">
                    {mth.label}
                  </div>
                </div>

                {/* การ์ดต่อช่วงวัน + การ์ดคนแทน เรียงตามวันเริ่มใน list เดียว */}
                <div className="flex flex-col gap-2">
                  {mth.entries.map((en) =>
                    en.type === "dates" ? (
                      <div
                        key={`${en.start}-${en.end}`}
                        className="rounded-[11px] border border-bdr bg-white overflow-hidden"
                      >
                        {/* หัวการ์ด = วันที่ */}
                        <div className="px-3 py-1.5 bg-gold-pale/60 border-b border-bdr">
                          <span className="text-sm font-bold text-maroon">
                            {formatRangeInMonth(en.start, en.end, en.period)}
                          </span>
                        </div>
                        {/* หน้าที่ + ชื่อ */}
                        <div className="flex flex-col">
                          {en.items.map((it, i) => {
                            const emp = it.primaryEmpId
                              ? empById.get(it.primaryEmpId)
                              : null;
                            const isMe =
                              !!profileId && it.primaryEmpId === profileId;
                            const primaryName =
                              emp?.nickname || emp?.name || "";
                            return (
                              <div
                                key={`${it.dutyId}-${i}`}
                                className={`${i > 0 ? "border-t border-bdr/50" : ""} ${isMe ? "bg-gold-pale/40" : ""}`}
                              >
                                {/* แถวหลัก: หน้าที่ + primary (คนรับผิดชอบรอบนี้) */}
                                <div className="flex items-center gap-2.5 px-3 py-2 text-sm">
                                  <div className="flex-1 min-w-0 font-semibold text-txt truncate">
                                    {it.dutyName}
                                  </div>
                                  {showPerson &&
                                    (emp ? (
                                      <div className="shrink-0 flex items-center gap-1.5 max-w-[55%]">
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

                                {/* คนแทนช่วงที่ primary ลา (วางแผนล่วงหน้า) */}
                                {it.coverage?.map((seg) => {
                                  const sub = seg.substituteEmpId
                                    ? empById.get(seg.substituteEmpId)
                                    : null;
                                  const subIsMe =
                                    !!profileId &&
                                    seg.substituteEmpId === profileId;
                                  return (
                                    <div
                                      key={seg.start}
                                      className="mx-3 mb-2 flex items-center gap-1.5 rounded-lg bg-amber-lt/60 border border-amber/25 px-2 py-1.5 text-xs"
                                    >
                                      <IconCalendarX
                                        size={13}
                                        strokeWidth={2.4}
                                        className="text-amber shrink-0 translate-y-px"
                                      />
                                      <span className="font-extrabold text-amber shrink-0">
                                        {segDayLabel(seg.start, seg.end)}
                                      </span>
                                      <span className="text-txt-soft truncate min-w-0">
                                        {primaryName || "คน"} ลา
                                      </span>
                                      <IconArrowRight
                                        size={12}
                                        strokeWidth={2.6}
                                        className="text-txt-soft shrink-0 translate-y-px"
                                      />
                                      {sub ? (
                                        <span className="inline-flex items-center gap-1 min-w-0 shrink">
                                          <AvatarCircle
                                            avatar={sub.avatar}
                                            avatarType={sub.avatarType}
                                            avatarImageUrl={sub.avatarImageUrl}
                                            size={18}
                                            fontSize={9}
                                            border="none"
                                          />
                                          <span
                                            className={`truncate font-bold ${subIsMe ? "text-maroon" : "text-green"}`}
                                          >
                                            {sub.nickname || sub.name}
                                            {subIsMe && " (คุณ)"} แทน
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="font-bold text-red shrink-0">
                                          ไม่มีคนแทน
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* การ์ดคนแทนตำแหน่งเป้าหมาย (หน้าที่แบบ "แทนคนลา") */
                      (() => {
                        const c = en.item;
                        const sub = c.substituteEmpId
                          ? empById.get(c.substituteEmpId)
                          : null;
                        const subIsMe =
                          !!profileId && c.substituteEmpId === profileId;
                        const targetIsMe =
                          !!profileId && c.targetEmpId === profileId;
                        return (
                          <div
                            key={`cov-${c.dutyId}-${c.targetEmpId}-${c.start}`}
                            className="rounded-[11px] border border-amber/30 bg-amber-lt/30 overflow-hidden"
                          >
                            <div className="px-3 py-1.5 bg-amber-lt/60 border-b border-amber/20 flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-amber">
                                {formatCoverageDay(c.start, c.end)}
                              </span>
                              <span className="text-[11px] font-semibold text-amber/80 truncate min-w-0">
                                {c.dutyName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-2 text-xs">
                              <IconCalendarX
                                size={13}
                                strokeWidth={2.4}
                                className="text-amber shrink-0 translate-y-px"
                              />
                              <span className="text-txt-soft truncate min-w-0">
                                {c.targetName || "คน"}
                                {targetIsMe && " (คุณ)"} ลา
                              </span>
                              <IconArrowRight
                                size={12}
                                strokeWidth={2.6}
                                className="text-txt-soft shrink-0 translate-y-px"
                              />
                              {c.substituteEmpId ? (
                                <span className="inline-flex items-center gap-1 min-w-0 shrink">
                                  {sub && (
                                    <AvatarCircle
                                      avatar={sub.avatar}
                                      avatarType={sub.avatarType}
                                      avatarImageUrl={sub.avatarImageUrl}
                                      size={18}
                                      fontSize={9}
                                      border="none"
                                    />
                                  )}
                                  <span
                                    className={`truncate font-bold ${subIsMe ? "text-maroon" : "text-green"}`}
                                  >
                                    {sub?.nickname ||
                                      sub?.name ||
                                      c.substituteName ||
                                      "คน"}
                                    {subIsMe && " (คุณ)"} แทน
                                  </span>
                                </span>
                              ) : (
                                <span className="font-bold text-red shrink-0">
                                  ไม่มีคนแทน
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
