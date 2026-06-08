/* ─── ปฏิทินหน้าที่ล่วงหน้า (Duty Forecast) ────────────────────────
   แสดง schedule หน้าที่ตั้งแต่วันนี้ → สิ้นปี เพื่อ forecast เตรียมพร้อม
   ใช้ร่วมกันทั้ง admin (profileId = null → เห็นทุกคน) และพนักงาน
   (profileId set → toggle "เฉพาะของฉัน" ได้)

   คำนวณ client-side จาก server snapshot (pool ที่ resolve แล้ว) — ทั้ง
   2 ฝั่งได้ผลตรงกัน (single source of truth กับ rotation จริง)            */

import {
  CalendarClock as IconCalendarClock,
  CalendarRange as IconCalendarRange,
  RotateCw as IconRotate,
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

/** label ช่วง period — weekly: "16-22 มิ.ย." · monthly: "มิถุนายน" */
function formatRange(start: string, end: string, period: string): string {
  const s = new Date(`${start}T00:00:00`);
  if (period === "monthly") {
    return s.toLocaleDateString("th-TH", { month: "long" });
  }
  const e = new Date(`${end}T00:00:00`);
  const sMonth = s.toLocaleDateString("th-TH", { month: "short" });
  const eMonth = e.toLocaleDateString("th-TH", { month: "short" });
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}-${e.getDate()} ${eMonth}`;
  }
  return `${s.getDate()} ${sMonth} - ${e.getDate()} ${eMonth}`;
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

  // "เฉพาะของฉัน" — flatten periods ที่เป็นของ profileId เรียงตามวันที่
  const myPeriods = useMemo(() => {
    if (!profileId) return [];
    const items: {
      dutyId: string;
      dutyName: string;
      period: "weekly" | "monthly";
      start: string;
      end: string;
    }[] = [];
    for (const f of forecast) {
      for (const p of f.periods) {
        if (p.primaryEmpId === profileId) {
          items.push({
            dutyId: f.dutyId,
            dutyName: f.dutyName,
            period: f.period,
            start: p.start,
            end: p.end,
          });
        }
      }
    }
    items.sort((a, b) => a.start.localeCompare(b.start));
    return items;
  }, [forecast, profileId]);

  const hasData = (dutyAssignmentsToday?.assignments?.length || 0) > 0;

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
              เฉพาะของฉัน
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
        ) : mineOnly && profileId ? (
          /* ─── view: เฉพาะของฉัน (chronological) ─── */
          myPeriods.length === 0 ? (
            <div className="text-center text-txt-soft py-10 px-6">
              <div className="flex justify-center mb-3 text-gold">
                <IconUserCheck size={40} strokeWidth={1.8} />
              </div>
              คุณยังไม่มีหน้าที่ในช่วงที่เหลือของปีนี้
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {myPeriods.map((p, i) => (
                <div
                  key={`${p.dutyId}-${p.start}-${i}`}
                  className="flex items-center gap-2.5 p-2.5 rounded-[10px] bg-gold-pale/50 border border-gold/30"
                >
                  <div className="w-[120px] shrink-0 text-sm font-bold text-maroon">
                    {formatRange(p.start, p.end, p.period)}
                  </div>
                  <div className="flex-1 min-w-0 text-sm font-semibold text-txt truncate">
                    {p.dutyName}
                  </div>
                  <div className="shrink-0 text-[11px] text-txt-soft inline-flex items-center gap-1">
                    <IconRotate size={10} strokeWidth={2.4} />
                    {p.period === "weekly" ? "สัปดาห์" : "เดือน"}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ─── view: ทั้งหมด (group by duty) ─── */
          <div className="flex flex-col gap-3">
            {forecast.map((f) => (
              <div
                key={f.dutyId}
                className="rounded-[12px] border border-bdr bg-white overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 bg-cream border-b border-bdr">
                  <IconCalendarClock
                    size={16}
                    strokeWidth={2.4}
                    className="text-maroon shrink-0"
                  />
                  <div className="flex-1 min-w-0 font-bold text-sm text-txt truncate">
                    {f.dutyName}
                  </div>
                  <div className="shrink-0 text-[11px] text-txt-soft inline-flex items-center gap-1">
                    <IconRotate size={10} strokeWidth={2.4} />
                    สลับทุก{f.period === "weekly" ? "สัปดาห์" : "เดือน"}
                  </div>
                </div>
                <div className="flex flex-col">
                  {f.periods.map((p, i) => {
                    const emp = p.primaryEmpId
                      ? empById.get(p.primaryEmpId)
                      : null;
                    const isMe = !!profileId && p.primaryEmpId === profileId;
                    return (
                      <div
                        key={`${p.start}-${i}`}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm ${
                          i % 2 === 0 ? "bg-white" : "bg-cream/40"
                        } ${isMe ? "bg-gold-pale/70" : ""}`}
                      >
                        <div className="w-[120px] shrink-0 font-semibold text-txt-mid">
                          {formatRange(p.start, p.end, f.period)}
                        </div>
                        {emp ? (
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <AvatarCircle
                              avatar={emp.avatar}
                              avatarType={emp.avatarType}
                              avatarImageUrl={emp.avatarImageUrl}
                              size={22}
                              fontSize={10}
                              border="none"
                            />
                            <span
                              className={`truncate ${isMe ? "font-bold text-maroon" : "font-semibold text-txt"}`}
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
                          <div className="flex-1 text-txt-soft italic text-xs">
                            ยังไม่มีคนในตำแหน่ง
                          </div>
                        )}
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
