/* ─── HomeTab — Home dashboard content ───────────────────────── */

import {
  AlertOctagon as IconAlertOctagon,
  AlertTriangle as IconAlertTriangle,
  CalendarClock as IconCalendarClock,
  CircleCheck as IconCircleCheck,
  ClipboardList as IconClipboardList,
  Wallet as IconWallet,
} from "lucide-react";
import { COLORS, LEAVE_TYPES } from "../../constants";
import type { Duty, Employee, LeaveEntry } from "../../types";
import { toYMD } from "../../utils/dateUtils";
import { computeAllDutiesForDay } from "../../utils/dutyUtils";
import AvatarCircle from "../shared/AvatarCircle";
import { MemphisCornerSticker } from "../shared/MemphisPattern";
import TeamCalendar from "./TeamCalendar";

interface HomeTabProps {
  profile: any;
  allLeaves: LeaveEntry[];
  employeeDirectory: Employee[];
  duties?: Duty[];
}

export default function HomeTab({
  profile,
  allLeaves,
  employeeDirectory,
  duties,
}: HomeTabProps) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  /* ─── Monthly quota ────────────────────────────────────────── */
  const usedThisMonth = profile
    ? allLeaves.filter(
        (lv) => lv.employeeId === profile.id && lv.start.startsWith(yearMonth),
      ).length
    : 0;
  const quota = 2;
  const remaining = quota - usedThisMonth;
  const overQuotaDeduction = remaining < 0;

  return (
    <>
      {/* Monthly quota card */}
      <div
        className={`relative overflow-hidden bg-white rounded-[18px] px-5 py-4.5 shadow-[0_2px_14px_rgba(90,30,10,0.08)] mb-3 border-[1.5px] ${overQuotaDeduction ? "border-[#C0392B50]" : "border-bdr"}`}
      >
        <MemphisCornerSticker position="tr" tone="gold" />
        {/* title row */}
        <div className="relative flex items-center justify-between mb-3.5">
          <div>
            <div className="font-bold text-maroon text-base">
              โควต้าการลาเดือนนี้
            </div>
            <div className="text-sm text-txt-soft mt-0.5">
              {now.toLocaleDateString("th-TH", {
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-txt-soft">ใช้ไปแล้ว</div>
            <div
              className={`text-2xl font-extrabold leading-none ${overQuotaDeduction ? "text-red" : usedThisMonth >= quota ? "text-amber" : "text-maroon"}`}
            >
              {usedThisMonth}
              <span className="text-sm text-txt-soft font-medium">
                /{quota} วัน
              </span>
            </div>
          </div>
        </div>

        {/* progress dots */}
        <div className="flex gap-2.5 mb-3.5">
          {Array.from({ length: quota }).map((_, i) => {
            const filled = i < usedThisMonth;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 6,
                  background: filled
                    ? overQuotaDeduction
                      ? COLORS.red
                      : `linear-gradient(90deg,${COLORS.gold},${COLORS.goldLight})`
                    : COLORS.creamDark,
                  boxShadow: filled
                    ? `0 2px 6px ${overQuotaDeduction ? COLORS.red : COLORS.gold}50`
                    : "none",
                  transition: "all 0.3s",
                }}
              />
            );
          })}
        </div>

        {/* status chips */}
        <div className="flex gap-2 flex-wrap">
          {remaining > 0 && (
            <div className="bg-green-lt rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5">
              <IconCircleCheck
                size={14}
                strokeWidth={2.4}
                className="text-green"
              />
              <span className="text-sm font-semibold text-green">
                ลาได้อีก {remaining} วัน
              </span>
            </div>
          )}
          {usedThisMonth === quota && (
            <div className="bg-amber-lt rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5">
              <IconAlertTriangle
                size={14}
                strokeWidth={2.4}
                className="text-amber"
              />
              <span className="text-sm font-semibold text-amber">
                ใช้ครบโควต้าแล้ว
              </span>
            </div>
          )}
          {usedThisMonth > quota && (
            <div className="bg-red-lt rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5">
              <IconAlertOctagon
                size={14}
                strokeWidth={2.4}
                className="text-red"
              />
              <span className="text-sm font-semibold text-red">
                เกินโควต้า {usedThisMonth - quota} วัน
              </span>
            </div>
          )}
          <div className="bg-cream rounded-[20px] px-3.5 py-[5px] flex items-center gap-1.5 border border-bdr">
            <IconClipboardList
              size={14}
              strokeWidth={2.4}
              className="text-txt-mid"
            />
            <span className="text-sm text-txt-mid">
              ลากิจ + ลาป่วย รวม 2 วัน/เดือน
            </span>
          </div>
        </div>

        {/* banner – แสดงตั้งแต่ครั้งที่ 2 เป็นต้นไป */}
        {usedThisMonth >= quota && (
          <div className="mt-3 bg-linear-to-br from-red/6 to-red/9 rounded-xl px-3.5 py-2.5 border border-red/19 flex items-center gap-2.5">
            <IconWallet
              size={22}
              strokeWidth={2.2}
              className="text-red shrink-0"
            />
            <div className="text-sm text-red font-semibold leading-relaxed">
              การลาต่อจากนี้ไป
              <br />
              <span className="font-bold">จะกระทบต่อเงินเดือน</span>
            </div>
          </div>
        )}
      </div>

      {/* ── เวรวันนี้ ── */}
      {duties && duties.length > 0 && (
        <DutyTodayCard
          duties={duties}
          allLeaves={allLeaves}
          employeeDirectory={employeeDirectory}
          profileId={profile?.id || null}
        />
      )}

      {/* leave type mini stats */}
      <div className="grid grid-cols-2 gap-2.5 mb-1.5">
        {LEAVE_TYPES.map((lt) => {
          const usedType = profile
            ? allLeaves.filter(
                (lv) =>
                  lv.employeeId === profile.id &&
                  lv.type === lt.id &&
                  lv.start.startsWith(yearMonth),
              ).length
            : 0;
          return (
            <div
              key={lt.id}
              className="bg-white rounded-[14px] p-3.5 shadow-[0_1px_6px_rgba(90,30,10,0.06)] border border-bdr flex items-center gap-3"
            >
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-xl shrink-0"
                style={{ background: lt.colorLt }}
              >
                {lt.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-txt">{lt.label}</div>
                <div className="text-sm text-txt-soft mt-px">
                  เดือนนี้ <b style={{ color: lt.color }}>{usedType}</b> วัน
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-sm text-txt-soft text-right mb-3.5">
        ข้อมูล ณ วันที่{" "}
        {new Date().toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </div>
      <TeamCalendar
        leaveEntries={allLeaves}
        employeeDirectory={[
          ...employeeDirectory,
          ...(profile && !employeeDirectory.find((e) => e.id === profile.id)
            ? [
                {
                  id: "current",
                  name: profile.name,
                  avatar: profile.avatar,
                  avatarType: profile.avatarType,
                  avatarImageUrl: profile.avatarImageUrl,
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

/* ─── เวรวันนี้ — สำหรับ HomeTab พนักงาน ──────────────────────── */
function DutyTodayCard({
  duties,
  allLeaves,
  employeeDirectory,
  profileId,
}: {
  duties: Duty[];
  allLeaves: LeaveEntry[];
  employeeDirectory: Employee[];
  profileId: string | null;
}) {
  const todayYmd = toYMD(new Date());
  const assignments = computeAllDutiesForDay(
    duties,
    todayYmd,
    employeeDirectory,
    allLeaves,
  );
  const empById = new Map(employeeDirectory.map((e) => [e.id, e]));
  const myDuties = assignments.filter((a) => a.actualEmpId === profileId);

  return (
    <div className="relative overflow-hidden bg-white rounded-[18px] px-5 py-4.5 shadow-[0_2px_14px_rgba(90,30,10,0.08)] mb-3 border-[1.5px] border-bdr">
      <MemphisCornerSticker position="tr" tone="gold" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <IconCalendarClock
            size={18}
            strokeWidth={2.4}
            className="text-maroon"
          />
          <div>
            <div className="font-bold text-maroon text-base">เวรวันนี้</div>
            <div className="text-sm text-txt-soft mt-0.5">
              {new Date().toLocaleDateString("th-TH", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </div>

        {/* ของฉัน */}
        {myDuties.length > 0 && (
          <div className="mb-3 p-2.5 rounded-[10px] bg-gold-pale border border-gold/40">
            <div className="text-xs font-bold text-maroon mb-1.5">
              🙋 ของคุณวันนี้
            </div>
            <div className="flex flex-wrap gap-1.5">
              {myDuties.map((a) => (
                <div
                  key={a.dutyId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-maroon text-gold-lt text-xs font-bold"
                >
                  {a.dutyName}
                  {a.reason === "substitute_for_leave" && (
                    <span className="text-[10px] opacity-80">(แทน)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* รายการเวรทั้งหมด */}
        <div className="flex flex-col gap-1.5">
          {assignments.map((a) => {
            const actual = a.actualEmpId ? empById.get(a.actualEmpId) : null;
            const primary = a.primaryEmpId ? empById.get(a.primaryEmpId) : null;
            const isMe = a.actualEmpId === profileId;
            const isSub =
              a.reason === "substitute_for_leave" || a.reason === "double_up";
            return (
              <div
                key={a.dutyId}
                className={`flex items-center gap-2 p-2 rounded-[9px] ${
                  isMe ? "bg-gold-pale/60 border border-gold/30" : "bg-cream"
                }`}
              >
                <div className="text-sm font-bold text-maroon flex-1 truncate">
                  {a.dutyName}
                </div>
                {actual ? (
                  <>
                    <AvatarCircle
                      avatar={actual.avatar}
                      avatarType={actual.avatarType}
                      avatarImageUrl={actual.avatarImageUrl}
                      size={24}
                      fontSize={10}
                      border="none"
                    />
                    <div className="text-xs font-semibold text-txt">
                      {actual.nickname || actual.name}
                    </div>
                    {isSub && primary && (
                      <div className="text-[10px] text-txt-soft">
                        แทน {primary.nickname || primary.name}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-txt-soft italic">
                    {a.reason === "all_on_leave" ? "ทุกคนลา" : "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
