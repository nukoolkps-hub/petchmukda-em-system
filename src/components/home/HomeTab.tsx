/* ─── HomeTab — Home dashboard content ───────────────────────── */

import {
  AlertOctagon as IconAlertOctagon,
  AlertTriangle as IconAlertTriangle,
  CalendarClock as IconCalendarClock,
  CalendarRange as IconCalendarRange,
  CircleCheck as IconCircleCheck,
  ClipboardList as IconClipboardList,
  ScrollText as IconScrollText,
  UserCheck as IconUserCheck,
  Wallet as IconWallet,
} from "lucide-react";
import { useState } from "react";
import { COLORS, LEAVE_TYPES } from "../../constants";
import type { DutyAssignmentsSnapshot } from "../../firebase/dutyAssignments";
import type {
  Duty,
  Employee,
  LeaveEntry,
  Role,
  StoreCalendar,
} from "../../types";
import { isRichTextEmpty } from "../../utils/sanitizeRichText";
import DutyForecastModal from "../modals/DutyForecastModal";
import RoleMainDutiesModal from "../modals/RoleMainDutiesModal";
import AvatarCircle from "../shared/AvatarCircle";
import { MemphisCornerSticker } from "../shared/MemphisPattern";
import PositionRateCard from "../shared/PositionRateCard";
import TeamCalendar from "./TeamCalendar";

interface HomeTabProps {
  profile: any;
  allLeaves: LeaveEntry[];
  employeeDirectory: Employee[];
  /** employee record ของผู้ใช้ปัจจุบัน (จาก useProfile) — มี roleId */
  currentEmployee?: Employee | null;
  roles?: Role[];
  duties?: Duty[];
  dutyAssignmentsToday?: DutyAssignmentsSnapshot | null;
  storeCalendar?: StoreCalendar | null;
}

export default function HomeTab({
  profile,
  allLeaves,
  employeeDirectory,
  currentEmployee,
  roles,
  duties,
  dutyAssignmentsToday,
  storeCalendar,
}: HomeTabProps) {
  const [showMainDuties, setShowMainDuties] = useState(false);
  // ใช้ currentEmployee จาก useProfile (single source of identity) แทนการ
  // re-derive จาก employeeDirectory — roleId อยู่ที่นี่อยู่แล้ว
  const myRole = roles?.find((r) => r.id === currentEmployee?.roleId) || null;
  const hasMainDuties = !isRichTextEmpty(myRole?.mainDuties);
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
      {/* ── ปุ่ม "หน้าที่หลัก" ── โชว์เมื่อ admin ตั้ง mainDuties ของตำแหน่งไว้ */}
      {hasMainDuties && myRole && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setShowMainDuties(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-bdr bg-white text-maroon text-xs font-bold cursor-pointer font-[inherit] shadow-[0_1px_5px_rgba(90,30,10,0.05)] active:scale-[0.96] transition-transform"
          >
            <IconScrollText size={13} strokeWidth={2.4} />
            หน้าที่หลัก
          </button>
        </div>
      )}

      {showMainDuties && myRole && (
        <RoleMainDutiesModal
          role={myRole}
          onClose={() => setShowMainDuties(false)}
        />
      )}

      {/* ── ตำแหน่ง + เงินเดือนพื้นฐาน + อัตราค่าคอม (ปัจจุบัน) ── */}
      <PositionRateCard employee={currentEmployee} role={myRole} />

      {/* ── หน้าที่วันนี้ — เหนือ quota เพราะใช้เช็คทุกวัน ── */}
      {duties &&
        duties.length > 0 &&
        dutyAssignmentsToday &&
        dutyAssignmentsToday.assignments.length > 0 && (
          <DutyTodayCard
            duties={duties}
            snapshot={dutyAssignmentsToday}
            profileId={profile?.id || null}
          />
        )}

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
                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: lt.colorLt, color: lt.color }}
              >
                <lt.Icon size={18} strokeWidth={2.2} />
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
      <TeamCalendar
        leaveEntries={allLeaves}
        storeCalendar={storeCalendar}
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

/* ─── หน้าที่วันนี้ — สำหรับ HomeTab พนักงาน ────────────────────────
   ใช้ server-computed snapshot · ฝั่งพนักงานอ่าน peer data (employees/
   leaves) ของเพื่อนไม่ได้เพราะ Firestore rules → Cloud Function compute
   ส่วนกลาง ส่ง safe projection (id/name/nickname/avatar/displayOrder
   เท่านั้น ไม่มี salary/bank/lineUserId)                                  */
function DutyTodayCard({
  duties,
  snapshot,
  profileId,
}: {
  duties: Duty[];
  snapshot: DutyAssignmentsSnapshot;
  profileId: string | null;
}) {
  const [showForecast, setShowForecast] = useState(false);
  const assignments = snapshot.assignments;
  // empById จาก pool members ของทุก duty รวมกัน (snapshot self-contained)
  const empById = new Map<
    string,
    {
      name: string;
      nickname: string;
      avatar: string;
      avatarType: "text" | "emoji" | "image";
      avatarImageUrl: string | null;
    }
  >();
  for (const a of assignments) {
    for (const m of a.pool) empById.set(m.id, m);
  }
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
          <div className="flex-1 min-w-0">
            <div className="font-bold text-maroon text-base">หน้าที่วันนี้</div>
            <div className="text-sm text-txt-soft mt-0.5">
              {new Intl.DateTimeFormat("th-TH", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
                .formatToParts(new Date())
                .map((p) => (p.type === "year" ? `พ.ศ. ${p.value}` : p.value))
                .join("")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForecast(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] border border-bdr bg-cream text-maroon text-xs font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
          >
            <IconCalendarRange size={13} strokeWidth={2.4} />
            ดูล่วงหน้า
          </button>
        </div>

        {/* ของฉัน */}
        {myDuties.length > 0 && (
          <div className="mb-3 p-2.5 rounded-[10px] bg-gold-pale border border-gold/40">
            <div className="text-xs font-bold text-maroon mb-1.5 inline-flex items-center gap-1">
              <IconUserCheck size={12} strokeWidth={2.4} />
              ของคุณวันนี้
            </div>
            <div className="flex flex-wrap gap-2">
              {myDuties.map((a) => {
                const primary = a.primaryEmpId
                  ? empById.get(a.primaryEmpId)
                  : null;
                const isSub =
                  a.reason === "substitute_for_leave" ||
                  a.reason === "double_up";
                const isCov = a.kind === "coverage";
                return (
                  <div
                    key={`${a.dutyId}-${a.targetEmpId || ""}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-[5px] rounded-[20px] bg-maroon text-white text-sm font-semibold"
                  >
                    {a.dutyName}
                    {isCov ? (
                      <span className="text-xs opacity-80">
                        แทน {a.targetName || "—"}
                      </span>
                    ) : (
                      isSub &&
                      primary && (
                        <span className="text-xs opacity-80">
                          แทน {primary.nickname || primary.name}
                        </span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* หน้าที่ของเพื่อน — exclude ตัวเอง เพราะมีในช่อง "ของคุณวันนี้" แล้ว
            + ซ่อน coverage ที่เป้าหมายไม่ลา (ไม่มีอะไรเกิดขึ้น) */}
        {(() => {
          const otherAssignments = assignments.filter(
            (a) =>
              a.actualEmpId !== profileId &&
              a.reason !== "target_present" &&
              a.reason !== "empty_target_role",
          );
          if (otherAssignments.length === 0) return null;
          return (
            <div className="flex flex-col gap-1.5">
              {myDuties.length > 0 && (
                <div className="text-xs font-bold text-txt-soft mb-0.5">
                  ของเพื่อนๆ
                </div>
              )}
              {otherAssignments.map((a) => {
                const actual = a.actualEmpId
                  ? empById.get(a.actualEmpId)
                  : null;
                const primary = a.primaryEmpId
                  ? empById.get(a.primaryEmpId)
                  : null;
                const isSub =
                  a.reason === "substitute_for_leave" ||
                  a.reason === "double_up";
                const isCov = a.kind === "coverage";
                return (
                  <div
                    key={`${a.dutyId}-${a.targetEmpId || ""}`}
                    className="flex items-center gap-2 p-2 rounded-[9px] bg-cream"
                  >
                    <div className="text-sm font-semibold text-maroon flex-1 truncate">
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
                        {isCov ? (
                          <div className="text-[10px] text-txt-soft">
                            แทน {a.targetName || "—"}
                          </div>
                        ) : (
                          isSub &&
                          primary && (
                            <div className="text-[10px] text-txt-soft">
                              แทน {primary.nickname || primary.name}
                            </div>
                          )
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-txt-soft italic">
                        {a.reason === "all_on_leave"
                          ? "ทุกคนลา"
                          : a.reason === "coverage_no_candidate"
                            ? "ไม่มีคนแทน"
                            : "—"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {showForecast && (
        <DutyForecastModal
          duties={duties}
          dutyAssignmentsToday={snapshot}
          profileId={profileId}
          onClose={() => setShowForecast(false)}
        />
      )}
    </div>
  );
}
