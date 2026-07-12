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
import type { Duty, LeaveEntry, StoreCalendar } from "../../types";
import { toYMD } from "../../utils/dateUtils";
import {
  type CoverageSegment,
  computeDutyForecast,
} from "../../utils/dutyUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";
import ModalHeader from "../shared/ModalHeader";

interface Props {
  duties: Duty[];
  dutyAssignmentsToday: DutyAssignmentsSnapshot | null;
  /** การลาทั้งหมด → ใช้คำนวณคนแทนล่วงหน้า (ใครลา ใครแทน วันไหน) */
  allLeaves: LeaveEntry[];
  storeCalendar?: StoreCalendar | null;
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
  onClose,
}: Props) {
  // พนักงาน default = เฉพาะของฉัน · admin ไม่มี profileId → ดูทั้งหมดเสมอ
  const [mineOnly, setMineOnly] = useState<boolean>(!!profileId);

  const todayYmd = toYMD(new Date());
  const endYmd = `${new Date().getFullYear()}-12-31`;
  const beYear = new Date().getFullYear() + 543;

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
  }, [forecast]);

  // coverage duty (แทนคนลา) ล่วงหน้า — server-computed ใน snapshot · เฉพาะ
  // ของฉัน = ฉันเป็นคนแทน หรือฉันคือคนที่ลา (จะได้รู้ว่าใครมาแทนเรา)
  const coverageForecast = useMemo<CoverageForecastItem[]>(() => {
    const all = dutyAssignmentsToday?.coverageForecast || [];
    if (!(profileId && mineOnly)) return all;
    return all.filter(
      (c) => c.substituteEmpId === profileId || c.targetEmpId === profileId,
    );
  }, [dutyAssignmentsToday, profileId, mineOnly]);

  // group 2 ชั้น: เดือน → วัน (card ต่อช่วงวัน · ในการ์ดมีหลายหน้าที่) +
  // coverage entries ของเดือนนั้น (แยกการ์ด amber)
  const months = useMemo(() => {
    // เฉพาะของฉัน = เป็น primary หรือเป็น "คนแทน" ในช่วงไหนของ period นี้
    // (พนักงานจะได้เห็นว่าต้องไปแทนใครวันไหนด้วย ไม่ใช่แค่เวรตัวเอง)
    const filtered =
      profileId && mineOnly
        ? allItems.filter(
            (it) =>
              it.primaryEmpId === profileId ||
              it.coverage?.some((s) => s.substituteEmpId === profileId),
          )
        : allItems;
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
      ensure(c.start.slice(0, 7)).coverage.push(c);
    }
    // รวมการ์ด rotation + การ์ดคนแทนเป็น list เดียวเรียงตามวันเริ่ม —
    // วันเริ่มตรงกันให้ rotation มาก่อน (การ์ดคนแทนอยู่ใต้สัปดาห์ที่ครอบวันลา)
    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
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
            a.start.localeCompare(b.start) ||
            (a.type === b.type ? 0 : a.type === "dates" ? -1 : 1),
        );
        return { ym, label: monthLabel(ym), entries };
      });
  }, [allItems, coverageForecast, profileId, mineOnly]);

  const hasData =
    (dutyAssignmentsToday?.assignments?.length || 0) > 0 ||
    Object.keys(dutyAssignmentsToday?.dutyPools || {}).length > 0;
  const showPerson = !(profileId && mineOnly);

  return (
    <BaseModal onClose={onClose} maxWidthClass="max-w-[560px]">
      <ModalHeader
        Icon={IconCalendarRange}
        title="ปฏิทินหน้าที่ล่วงหน้า"
        subtitle={`ตารางหมุนเวียนถึงสิ้นปี พ.ศ. ${beYear}`}
        onClose={onClose}
      />

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
          ตารางตามรอบหมุนเวียน + คนแทนช่วงที่มีคนลา (เท่าที่ยื่นลาไว้ล่วงหน้า) —
          ใช้สำหรับวางแผนล่วงหน้า
        </div>

        {!hasData ? (
          <div className="text-center text-txt-soft py-10 px-6">
            ยังไม่มีข้อมูลตาราง — ลองรีเฟรชหลัง ADMIN ตั้งค่าหน้าที่
          </div>
        ) : months.length === 0 ? (
          <div className="text-center text-txt-soft py-10 px-6">
            <div className="flex justify-center mb-3 text-gold">
              <IconUserCheck size={40} strokeWidth={1.8} />
            </div>
            คุณยังไม่มีหน้าที่ในช่วงที่เหลือของปีนี้
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
