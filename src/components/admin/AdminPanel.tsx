import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconShield,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { C, LEAVE_TYPES, TH_MONTHS } from "../../constants";
import { fmtDate, isPast } from "../../utils/dateUtils";
import ConfirmModal from "../modals/ConfirmModal";
import SalaryAdminEdit from "../salary/SalaryAdminEdit";
import AvatarCircle from "../shared/AvatarCircle";
import AdminAdvancePanel from "./AdminAdvancePanel";
import PayrollSummaryPanel from "./PayrollSummaryPanel";
import RolesAdminPanel from "./RolesAdminPanel";

/* ─── Admin Panel (main container) ─────────────────────────────── */
export default function AdminPanel({
  allLeaves,
  empDir,
  onDelete,
  onLogout,
  onUpdateRole,
  salaryData,
  setSalaryData,
  onSaveSalary,
  advanceRequests,
  onUpdateAdvance,
  roles,
  setRoles,
  payrollConfirms,
  setPayrollConfirms,
  showToast,
}) {
  const [section, setSection] = useState("summary");
  const [unsavedDirty, setUnsavedDirty] = useState(false);

  // ระบบเตือนก่อนเปลี่ยน section ถ้ามีข้อมูลยังไม่บันทึก
  function tryChangeSection(newId) {
    if (unsavedDirty) {
      const ok = window.confirm(
        "⚠️ คุณยังไม่ได้บันทึกการเปลี่ยนแปลง\n\nหากออกจากหน้านี้ ข้อมูลที่แก้ไขจะหายไป\n\nต้องการออกจากหน้านี้ใช่ไหม?",
      );
      if (!ok) return;
      setUnsavedDirty(false);
    }
    setSection(newId);
  }

  // เตือนตอนปิดหน้า/refresh ถ้ามี unsaved
  useEffect(() => {
    if (!unsavedDirty) return;
    function handler(e) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedDirty]);
  const [confirmLeave, setConfirmLeave] = useState<any>(null);
  const [filterEmp, setFilterEmp] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editingRole, setEditingRole] = useState({});
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  const [copiedLineId, setCopiedLineId] = useState(null);

  function copyLineId(text, empId) {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedLineId(empId);
          setTimeout(() => setCopiedLineId(null), 1500);
        })
        .catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedLineId(empId);
        setTimeout(() => setCopiedLineId(null), 1500);
      } catch (_e) {}
      document.body.removeChild(ta);
    }
  }
  const now0 = new Date();
  const [selMonth, setSelMonth] = useState(
    `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, "0")}`,
  );
  const [selYear, setSelYear] = useState(`${now0.getFullYear()}`);

  const pastLeaves = allLeaves
    .filter((lv) => isPast(lv.end))
    .filter((lv) => !filterEmp || lv.employeeName.includes(filterEmp))
    .filter((lv) => !filterType || lv.type === filterType)
    .sort((a, b) => b.end.localeCompare(a.end));
  const uniqueEmps: string[] = [
    ...new Set(
      allLeaves.filter((lv) => isPast(lv.end)).map((lv) => lv.employeeName),
    ),
  ] as string[];

  return (
    <div>
      {/* admin badge */}
      <div className="flex items-center gap-3 bg-linear-135 from-maroon to-maroon-lt rounded-[14px] px-4 py-3.5 mb-4 shadow-maroon-glow">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
          <IconShield size={20} color={C.goldLt} stroke={2} />
        </div>
        <div className="flex-1">
          <div className="text-gold-lt font-bold text-base">โหมดผู้ดูแลระบบ</div>
        </div>
        <button
          onClick={() => {
            if (unsavedDirty) {
              const ok = window.confirm(
                "⚠️ คุณยังไม่ได้บันทึกการเปลี่ยนแปลง\n\nหากออก ข้อมูลที่แก้ไขจะหายไป\n\nต้องการออกจากโหมด Admin ใช่ไหม?",
              );
              if (!ok) return;
              setUnsavedDirty(false);
            }
            onLogout();
          }}
          className="px-3.5 py-[7px] rounded-[10px] bg-white/12 text-gold-lt text-[13px] font-semibold cursor-pointer font-[inherit] border border-[#E8C87A50]"
        >
          ออก
        </button>
      </div>

      {/* section tabs — grouped by category */}
      <div className="bg-cream-dk rounded-[14px] p-2.5 mb-[18px] flex flex-col gap-2.5">
        {[
          {
            cat: "งานลา",
            icon: "📅",
            color: C.maroon,
            items: [
              { id: "summary", label: "สรุปการลา", icon: "📊" },
              { id: "leaves", label: "รายการลา", icon: "🗂" },
            ],
          },
          {
            cat: "เงินเดือน",
            icon: "💰",
            color: C.gold,
            items: [
              { id: "salary", label: "กำหนดค่าคอม", icon: "💎" },
              { id: "advance", label: "เบิกล่วงหน้า", icon: "💸" },
              { id: "payroll", label: "สรุปการจ่าย", icon: "💳" },
            ],
          },
          {
            cat: "ตั้งค่า",
            icon: "⚙️",
            color: C.textMid,
            items: [
              { id: "positions", label: "ตำแหน่ง", icon: "🏷" },
              { id: "roles", label: "ข้อมูลพนักงาน", icon: "👤" },
            ],
          },
        ].map((group) => (
          <div key={group.cat}>
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <span className="text-[11px]">{group.icon}</span>
              <span
                className="text-[11px] font-bold tracking-[0.02em]"
                style={{ color: group.color }}
              >
                {group.cat}
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background: `linear-gradient(to right, ${group.color}30, transparent)`,
                }}
              />
            </div>
            <div
              className="grid gap-[5px]"
              style={{
                gridTemplateColumns: `repeat(${group.items.length}, 1fr)`,
              }}
            >
              {group.items.map((s) => {
                const pendingCount =
                  s.id === "advance"
                    ? (advanceRequests || []).filter(
                        (r) => r.status === "pending",
                      ).length
                    : 0;
                const active = section === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => tryChangeSection(s.id)}
                    className={`px-1.5 py-[9px] rounded-[10px] border-none cursor-pointer font-[inherit] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-[5px] relative whitespace-nowrap ${active ? "bg-white text-maroon shadow-[0_1px_6px_rgba(90,30,10,0.10)]" : "bg-transparent text-txt-soft"}`}
                  >
                    <span className="text-sm">{s.icon}</span>
                    <span>{s.label}</span>
                    {pendingCount > 0 && (
                      <span className="absolute top-[3px] right-[3px] bg-red text-white text-[10px] font-bold px-1.5 py-px rounded-[10px] min-w-4 text-center">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── POSITIONS section ── */}
      {section === "positions" && (
        <RolesAdminPanel
          roles={roles}
          setRoles={setRoles}
          empDir={empDir}
          onUpdateEmpRole={onUpdateRole}
        />
      )}

      {/* ── PAYROLL SUMMARY section ── */}
      {section === "payroll" && (
        <PayrollSummaryPanel
          empDir={empDir}
          salaryData={salaryData}
          allLeaves={allLeaves}
          advanceRequests={advanceRequests}
          roles={roles}
          payrollConfirms={payrollConfirms}
          setPayrollConfirms={setPayrollConfirms}
          showToast={showToast}
        />
      )}

      {/* ── ADVANCE section ── */}
      {section === "advance" && (
        <AdminAdvancePanel
          advanceRequests={advanceRequests || []}
          empDir={empDir}
          onUpdate={onUpdateAdvance}
        />
      )}

      {/* ── SALARY edit section ── */}
      {section === "salary" && (
        <SalaryAdminEdit
          empDir={empDir}
          salaryData={salaryData}
          setSalaryData={setSalaryData}
          onSaveSalary={onSaveSalary}
          allLeaves={allLeaves}
          advanceRequests={advanceRequests}
          roles={roles}
          setUnsavedDirty={setUnsavedDirty}
        />
      )}

      {/* ── SUMMARY section ── */}
      {section === "summary" &&
        (() => {
          const _now = new Date();

          // gather all unique employee names
          const empNames: string[] = [
            ...new Set(allLeaves.map((lv) => lv.employeeName)),
          ] as string[];
          const months: string[] = (
            [
              ...new Set(allLeaves.map((lv) => lv.start.slice(0, 7))),
            ] as string[]
          )
            .sort()
            .reverse();
          const years: string[] = (
            [
              ...new Set(allLeaves.map((lv) => lv.start.slice(0, 4))),
            ] as string[]
          )
            .sort()
            .reverse();

          // count weekday vs sunday days in a leave entry
          function countByDayType(start, end) {
            let weekdays = 0,
              sundays = 0;
            const s = new Date(`${start}T00:00:00`),
              e = new Date(`${end}T00:00:00`),
              c = new Date(s);
            while (c <= e) {
              const dow = c.getDay();
              if (dow === 0) sundays++;
              else if (dow !== 6) weekdays++;
              c.setDate(c.getDate() + 1);
            }
            return { weekdays, sundays };
          }
          function sumDayType(leaves) {
            let weekdays = 0,
              sundays = 0;
            leaves.forEach((lv) => {
              const r = countByDayType(lv.start, lv.end);
              weekdays += r.weekdays;
              sundays += r.sundays;
            });
            return { weekdays, sundays };
          }

          return (
            <div>
              {/* Monthly summary */}
              <div className="bg-white rounded-2xl p-4 mb-3.5 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="font-bold text-maroon text-[15px]">
                    📅 สรุปรายเดือน
                  </div>
                  <select
                    value={selMonth}
                    onChange={(e) => setSelMonth(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-bdr text-[13px] text-txt bg-cream font-[inherit] outline-none"
                  >
                    {months.map((m) => {
                      const [y, mo] = m.split("-");
                      return (
                        <option key={m} value={m}>
                          {TH_MONTHS[parseInt(mo, 10) - 1]}{" "}
                          {parseInt(y, 10) + 543}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {empNames.length === 0 && (
                  <div className="text-txt-soft text-sm text-center py-4">
                    ไม่มีข้อมูล
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {empNames
                    .map((name) => {
                      const empInfo = empDir.find((e) => e.name === name);
                      const monthLeaves = allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(selMonth),
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
                          key={name}
                          className={`px-3.5 py-3 rounded-xl border ${overQuota ? "bg-red-lt border-[#C0392B30]" : "bg-cream border-bdr"}`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <AvatarCircle
                              av={empInfo?.av || name.slice(0, 2)}
                              avType={empInfo?.avType || "text"}
                              img={empInfo?.img || null}
                              size={36}
                              fontSize={12}
                              border={`2px solid ${C.gold}40`}
                            />
                            <div className="flex-1">
                              <div className="font-bold text-txt text-sm">
                                {name}
                              </div>
                              <div className="text-[11px] text-txt-soft">
                                {empInfo?.role || "-"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-extrabold text-lg ${overQuota ? "text-red" : "text-maroon"}`}
                              >
                                {totalTimes}{" "}
                                <span className="text-[11px] font-medium text-txt-soft">
                                  ครั้ง
                                </span>
                              </div>
                              <div className="text-[11px] text-txt-soft">
                                {totalDays} วันรวม
                              </div>
                              {overQuota && (
                                <div className="text-[11px] text-red font-bold">
                                  🚨 เกินโควต้า
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <div className="bg-gold-pale rounded-[20px] px-2.5 py-[3px] text-sm text-txt-mid font-semibold">
                              💼 ลากิจ {personalDays} วัน
                            </div>
                            <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#CCFBF1] text-[#0F766E]">
                              🏥 ลาป่วย {sickDays} วัน
                            </div>
                            <div className="bg-white rounded-[20px] px-2.5 py-[3px] text-sm text-txt-mid font-semibold border border-bdr">
                              📅 วันธรรมดา {weekdays} วัน
                            </div>
                            <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#EDE9FE] text-[#6D28D9]">
                              🌅 วันอาทิตย์ {sundays} วัน
                            </div>
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean)}
                  {empNames.every(
                    (name) =>
                      allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(selMonth),
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
                  <div className="font-bold text-maroon text-[15px]">
                    📆 สรุปรายปี
                  </div>
                  <select
                    value={selYear}
                    onChange={(e) => setSelYear(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-bdr text-[13px] text-txt bg-cream font-[inherit] outline-none"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        ปี {parseInt(y, 10) + 543}
                      </option>
                    ))}
                  </select>
                </div>
                {empNames.length === 0 && (
                  <div className="text-txt-soft text-sm text-center py-4">
                    ไม่มีข้อมูล
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {empNames
                    .map((name) => {
                      const empInfo = empDir.find((e) => e.name === name);
                      const yearLeaves = allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(selYear),
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
                          key={name}
                          className="p-3.5 rounded-xl bg-cream border border-bdr"
                        >
                          <div className="flex items-center gap-3 mb-2.5">
                            <AvatarCircle
                              av={empInfo?.av || name.slice(0, 2)}
                              avType={empInfo?.avType || "text"}
                              img={empInfo?.img || null}
                              size={38}
                              fontSize={12}
                              border={`2px solid ${C.gold}40`}
                            />
                            <div className="flex-1">
                              <div className="font-bold text-txt text-sm">
                                {name}
                              </div>
                              <div className="text-sm text-txt-soft">
                                {empInfo?.role || "-"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-xl text-maroon">
                                {totalDays}
                              </div>
                              <div className="text-[11px] text-txt-soft">
                                วันรวม · {totalTimes} ครั้ง
                              </div>
                            </div>
                          </div>
                          <div className="bg-cream-dk rounded-md h-[7px] overflow-hidden mb-2.5">
                            <div
                              className="h-full rounded-md bg-linear-to-r from-gold to-gold-lt"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <div className="bg-gold-pale rounded-[20px] px-2.5 py-[3px] text-sm text-txt-mid font-semibold">
                              💼 ลากิจ {personalDays} วัน
                            </div>
                            <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#CCFBF1] text-[#0F766E]">
                              🏥 ลาป่วย {sickDays} วัน
                            </div>
                            <div className="bg-white rounded-[20px] px-2.5 py-[3px] text-sm text-txt-mid font-semibold border border-bdr">
                              📅 วันธรรมดา {weekdays} วัน
                            </div>
                            <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#EDE9FE] text-[#6D28D9]">
                              🌅 วันอาทิตย์ {sundays} วัน
                            </div>
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean)}
                  {empNames.every(
                    (name) =>
                      allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(selYear),
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
        })()}

      {/* ── LEAVES section ── */}
      {section === "leaves" && (
        <div>
          <div className="flex gap-2 mb-3.5">
            <select
              value={filterEmp}
              onChange={(e) => setFilterEmp(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
            >
              <option value="">พนักงานทั้งหมด</option>
              {uniqueEmps.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
            >
              <option value="">ประเภททั้งหมด</option>
              {LEAVE_TYPES.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.label}
                </option>
              ))}
            </select>
          </div>
          {pastLeaves.length === 0 && (
            <div className="text-center text-txt-soft py-10 text-[15px]">
              ไม่มีรายการลาย้อนหลัง
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {pastLeaves.map((lv) => {
              const lt = LEAVE_TYPES.find((t) => t.id === lv.type);
              const empInfo = empDir.find((e) => e.name === lv.employeeName);
              return (
                <div
                  key={lv.id}
                  className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr flex items-start gap-3"
                >
                  <AvatarCircle
                    av={empInfo?.av || lv.employeeName?.slice(0, 2)}
                    avType={empInfo?.avType || "text"}
                    img={empInfo?.img || null}
                    size={42}
                    fontSize={13}
                    border={`2px solid ${C.gold}40`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-txt text-[15px] mb-[3px]">
                      {lv.employeeName}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: lt?.color }}
                      >
                        {lt?.icon} {lt?.label}
                      </span>
                      <span className="text-sm text-txt-soft">
                        · {lv.days} วันทำการ
                      </span>
                    </div>
                    <div className="text-[13px] text-txt-mid">
                      {fmtDate(lv.start)}
                      {lv.start !== lv.end ? ` – ${fmtDate(lv.end)}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmLeave(lv)}
                    className="w-9 h-9 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer shrink-0 border-[1.5px] border-[#C0392B30]"
                  >
                    <IconTrash size={16} color={C.red} stroke={2.2} />
                  </button>
                </div>
              );
            })}
          </div>
          <ConfirmModal
            leave={confirmLeave}
            onConfirm={() => {
              onDelete(confirmLeave.id);
              setConfirmLeave(null);
            }}
            onCancel={() => setConfirmLeave(null)}
          />
        </div>
      )}

      {/* ── ROLES section ── */}
      {section === "roles" && (
        <div>
          <div className="flex items-center justify-between mb-3.5 gap-2">
            <div className="text-[13px] text-txt-soft">กดที่ชื่อพนักงานเพื่อแก้ไข</div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setExpandedEmpId("__ALL__")}
                className="px-2.5 py-[5px] rounded-lg border border-bdr bg-white text-maroon text-[11px] font-semibold cursor-pointer font-[inherit]"
              >
                ขยายทั้งหมด
              </button>
              <button
                onClick={() => setExpandedEmpId(null)}
                className="px-2.5 py-[5px] rounded-lg border border-bdr bg-white text-txt-mid text-[11px] font-semibold cursor-pointer font-[inherit]"
              >
                ย่อทั้งหมด
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {empDir.map((emp) => {
              const eRN = editingRole[`${emp.id}_rN`];
              const eRS = editingRole[`${emp.id}_rS`];
              const eRB = editingRole[`${emp.id}_rB`];
              const eRI = editingRole[`${emp.id}_rI`];
              const eRT = editingRole[`${emp.id}_rT`];
              const eRSingle = editingRole[`${emp.id}_rSingle`];
              const eBase = editingRole[`${emp.id}_base`];
              const eSalDis = editingRole[`${emp.id}_salDis`];
              const ePoolExc = editingRole[`${emp.id}_poolExc`];
              const dirty =
                eRN !== undefined ||
                eRS !== undefined ||
                eRB !== undefined ||
                eRI !== undefined ||
                eRT !== undefined ||
                eRSingle !== undefined ||
                eBase !== undefined ||
                eSalDis !== undefined ||
                ePoolExc !== undefined;
              const saveAll = () => {
                if (eRN !== undefined)
                  onUpdateRole(
                    emp.id,
                    "ratePerPieceNormal",
                    parseFloat(eRN) || 0,
                  );
                if (eRS !== undefined)
                  onUpdateRole(
                    emp.id,
                    "ratePerPieceSpecial",
                    parseFloat(eRS) || 0,
                  );
                if (eRB !== undefined)
                  onUpdateRole(emp.id, "ratePerPieceBuy", parseFloat(eRB) || 0);
                if (eRI !== undefined)
                  onUpdateRole(
                    emp.id,
                    "ratePerPieceInvite",
                    parseFloat(eRI) || 0,
                  );
                if (eRT !== undefined)
                  onUpdateRole(
                    emp.id,
                    "ratePerPieceTransfer",
                    parseFloat(eRT) || 0,
                  );
                if (eRSingle !== undefined)
                  onUpdateRole(
                    emp.id,
                    "ratePerPiece",
                    parseFloat(eRSingle) || 0,
                  );
                if (eBase !== undefined)
                  onUpdateRole(emp.id, "baseSalary", parseFloat(eBase) || 0);
                if (eSalDis !== undefined)
                  onUpdateRole(emp.id, "salaryDisabled", eSalDis);
                if (ePoolExc !== undefined)
                  onUpdateRole(emp.id, "poolExclude", ePoolExc || null);
                setEditingRole((r) => {
                  const n = { ...r };
                  delete n[`${emp.id}_rN`];
                  delete n[`${emp.id}_rS`];
                  delete n[`${emp.id}_rB`];
                  delete n[`${emp.id}_rI`];
                  delete n[`${emp.id}_rT`];
                  delete n[`${emp.id}_rSingle`];
                  delete n[`${emp.id}_base`];
                  delete n[`${emp.id}_salDis`];
                  delete n[`${emp.id}_poolExc`];
                  return n;
                });
              };
              const cancelAll = () => {
                setEditingRole((r) => {
                  const n = { ...r };
                  delete n[`${emp.id}_rN`];
                  delete n[`${emp.id}_rS`];
                  delete n[`${emp.id}_rB`];
                  delete n[`${emp.id}_rI`];
                  delete n[`${emp.id}_rT`];
                  delete n[`${emp.id}_rSingle`];
                  delete n[`${emp.id}_base`];
                  delete n[`${emp.id}_salDis`];
                  delete n[`${emp.id}_poolExc`];
                  return n;
                });
              };
              const isExpanded =
                expandedEmpId === emp.id || expandedEmpId === "__ALL__";
              const empR = roles?.find((r) => r.id === emp.roleId);
              return (
                <div
                  key={emp.id}
                  className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,30,10,0.06)] border border-bdr overflow-hidden transition-all duration-200"
                >
                  {/* Clickable header */}
                  <div
                    onClick={() => {
                      if (expandedEmpId === "__ALL__") {
                        setExpandedEmpId(null);
                      } else {
                        setExpandedEmpId(isExpanded ? null : emp.id);
                      }
                    }}
                    className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer ${isExpanded ? "bg-cream border-b border-bdr" : ""}`}
                  >
                    <AvatarCircle
                      av={emp.av}
                      avType={emp.avType}
                      img={emp.img}
                      size={40}
                      fontSize={13}
                      border={`2px solid ${C.gold}40`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-txt text-sm truncate">
                        {emp.name}
                      </div>
                      <div className="text-[11px] text-txt-soft mt-px flex items-center gap-[5px] flex-wrap">
                        {empR?.icon} {emp.role || "-"}
                        {emp.poolExclude &&
                          (() => {
                            const m = {
                              sell: "💎 ปิดขาย",
                              buy: "🛍 ปิดซื้อ",
                              both: "🔒 ปิดทั้งคู่",
                            };
                            return (
                              <span className="px-1.5 py-px rounded-md bg-red-lt text-red font-bold text-[9px]">
                                {m[emp.poolExclude]}
                              </span>
                            );
                          })()}
                        {emp.salaryDisabled && (
                          <span className="px-1.5 py-px rounded-md bg-red-lt text-red font-bold text-[9px]">
                            🔒 ปิดเงินเดือน
                          </span>
                        )}
                        {emp.lineUserId && (
                          <span className="px-1.5 py-px rounded-md bg-[#06C75520] text-[#06A04E] font-bold text-[9px]">
                            💬 LINE
                          </span>
                        )}
                      </div>
                    </div>
                    {dirty && !isExpanded && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#D9770630] text-amber">
                        มีการแก้ไข
                      </span>
                    )}
                    <IconChevronDown
                      size={16}
                      color={C.textSoft}
                      stroke={2.2}
                      className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : "rotate-0"}`}
                    />
                  </div>

                  {/* Expandable content */}
                  {isExpanded && (
                    <div className="px-4 py-3.5">
                      {/* Role — read-only (แก้จากแท็บ "ตำแหน่ง") */}
                      <div className="mb-2.5 px-3 py-2.5 bg-cream rounded-[10px] border border-dashed border-bdr">
                        <div className="text-[11px] text-txt-soft font-semibold mb-[5px] flex items-center gap-1.5">
                          <span>👤 ตำแหน่ง</span>
                          <span className="text-[9px] px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
                            แก้ในแท็บ "ตำแหน่ง"
                          </span>
                        </div>
                        <div
                          className={`text-[13px] font-bold ${emp.role && emp.role !== "-" ? "text-txt" : "text-txt-soft italic"}`}
                        >
                          {emp.role && emp.role !== "-"
                            ? emp.role
                            : "ยังไม่กำหนดตำแหน่ง"}
                        </div>
                      </div>
                      {/* Bank info — read-only (พนักงานเป็นคนกรอกเอง) */}
                      <div className="mb-3 px-3 py-2.5 bg-cream rounded-[10px] border border-dashed border-bdr">
                        <div className="text-[11px] text-txt-soft font-semibold mb-[5px] flex items-center gap-1.5">
                          <span>🏦 บัญชีรับเงินเดือน</span>
                          <span className="text-[9px] px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
                            พนักงานกรอกเอง
                          </span>
                        </div>
                        {emp.bank || emp.bankAcc ? (
                          <>
                            <div className="text-[13px] font-bold text-txt mb-px">
                              {emp.bank || "-"}
                            </div>
                            <div className="text-[13px] text-txt-mid tracking-wider">
                              {emp.bankAcc || "-"}
                            </div>
                          </>
                        ) : (
                          <div className="text-[13px] text-txt-soft italic">
                            ยังไม่มีข้อมูลบัญชี
                          </div>
                        )}
                      </div>

                      {/* LINE User ID — read-only, copy only */}
                      <div className="mb-3">
                        <label className="text-[11px] text-txt-soft font-semibold mb-1 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1">
                            💬 LINE User ID
                            {emp.lineUserId ? (
                              <span className="text-[9px] px-1.5 py-px rounded-lg bg-[#06C75520] text-[#06A04E] font-bold">
                                เชื่อมแล้ว
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold">
                                ยังไม่เชื่อม
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
                            อ่านอย่างเดียว
                          </span>
                        </label>
                        {emp.lineUserId ? (
                          <button
                            onClick={() => copyLineId(emp.lineUserId, emp.id)}
                            className={`w-full px-3 py-[9px] rounded-[9px] bg-cream cursor-pointer font-[inherit] flex items-center gap-2 transition-all duration-200 border ${copiedLineId === emp.id ? "border-green" : "border-bdr"}`}
                          >
                            <span className="flex-1 text-left text-sm text-txt font-[Prompt,monospace] tracking-[0.02em] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                              {emp.lineUserId}
                            </span>
                            <span
                              className={`flex items-center gap-1 px-[9px] py-1 rounded-[7px] text-[11px] font-bold whitespace-nowrap transition-all duration-200 ${copiedLineId === emp.id ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
                            >
                              {copiedLineId === emp.id ? (
                                <>
                                  <IconCheck size={12} stroke={3} />
                                  คัดลอกแล้ว
                                </>
                              ) : (
                                <>
                                  <IconCopy size={12} stroke={2.2} />
                                  คัดลอก
                                </>
                              )}
                            </span>
                          </button>
                        ) : (
                          <div className="px-3 py-2.5 rounded-[9px] border border-dashed border-bdr bg-cream text-sm text-txt-soft italic text-center">
                            — ยังไม่ได้เชื่อมต่อ LINE —
                          </div>
                        )}
                        <div className="text-[10px] text-txt-soft mt-[3px] leading-normal">
                          💡 ID จะถูกเก็บอัตโนมัติเมื่อพนักงานเข้าสู่ระบบผ่าน LINE
                        </div>
                      </div>

                      {/* Base Salary */}
                      <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                        <label className="text-[11px] text-maroon font-bold mb-1.5 flex items-center gap-1.5">
                          💼 เงินเดือนพื้นฐาน
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold pointer-events-none">
                            ฿
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={
                              eBase !== undefined ? eBase : emp.baseSalary || 0
                            }
                            onChange={(e) =>
                              setEditingRole((r) => ({
                                ...r,
                                [`${emp.id}_base`]: e.target.value,
                              }))
                            }
                            className={`w-full py-[9px] pr-3 pl-[30px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt text-right border-[1.5px] ${eBase !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                          />
                        </div>
                        <div className="text-[10px] text-txt-soft mt-[3px]">
                          หน่วย: บาท/เดือน
                        </div>
                      </div>

                      {/* Disable Salary toggle */}
                      {(() => {
                        const cur =
                          eSalDis !== undefined
                            ? eSalDis
                            : !!emp.salaryDisabled;
                        return (
                          <div
                            className={`px-3 py-2.5 rounded-[10px] mb-2.5 border-[1.5px] ${cur ? "bg-red-lt border-[#C0392B50]" : "bg-cream border-bdr"}`}
                          >
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cur}
                                onChange={(e) =>
                                  setEditingRole((r) => ({
                                    ...r,
                                    [`${emp.id}_salDis`]: e.target.checked,
                                  }))
                                }
                                className="w-4 h-4 cursor-pointer accent-red"
                              />
                              <div className="flex-1">
                                <div
                                  className={`text-sm font-bold ${cur ? "text-red" : "text-txt"}`}
                                >
                                  🔒 ปิดสิทธิ์ระบบเงินเดือน
                                </div>
                                <div className="text-[10px] text-txt-soft mt-0.5 leading-normal">
                                  ซ่อนแท็บ "เงินเดือน" จากพนักงาน · ใช้ได้แค่ระบบลา
                                </div>
                              </div>
                            </label>
                          </div>
                        );
                      })()}

                      {/* Commission rates per piece */}
                      {(() => {
                        const empR = roles?.find((r) => r.id === emp.roleId);
                        const isSingle = empR && !empR.poolGroup;
                        const eRSingle = editingRole[`${emp.id}_rSingle`];
                        if (isSingle) {
                          return (
                            <div className="p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                              <div className="text-sm font-bold text-maroon mb-2">
                                💰 Rate ค่าคอมต่อชิ้น
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                    📦 ค่าคอมต่อชิ้น
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      eRSingle !== undefined
                                        ? eRSingle
                                        : emp.ratePerPiece || 0
                                    }
                                    onChange={(e) =>
                                      setEditingRole((r) => ({
                                        ...r,
                                        [`${emp.id}_rSingle`]: e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRSingle !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                              </div>
                              <div className="text-[10px] text-txt-soft text-center mt-1.5">
                                หน่วย: ฿/ชิ้น
                              </div>

                              <div className="h-px my-2.5 bg-[#C9973A30]" />
                              <div className="text-[11px] font-bold text-maroon mb-2">
                                🎫 Rate บัตรสมาชิกต่อใบ
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                    🎫 เชิญชวนสมัคร
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      eRI !== undefined
                                        ? eRI
                                        : emp.ratePerPieceInvite || 0
                                    }
                                    onChange={(e) =>
                                      setEditingRole((r) => ({
                                        ...r,
                                        [`${emp.id}_rI`]: e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRI !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                    🔄 ย้ายข้อมูล
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      eRT !== undefined
                                        ? eRT
                                        : emp.ratePerPieceTransfer || 0
                                    }
                                    onChange={(e) =>
                                      setEditingRole((r) => ({
                                        ...r,
                                        [`${emp.id}_rT`]: e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRT !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                              </div>
                              <div className="text-[10px] text-txt-soft text-center mt-1.5">
                                หน่วย: ฿/ใบ
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                            {/* Exclude from Pool — 3 levels (only for pool-group roles) */}
                            {empR?.poolGroup &&
                              (() => {
                                const cur =
                                  ePoolExc !== undefined
                                    ? ePoolExc
                                    : emp.poolExclude || "";
                                const opts = [
                                  {
                                    id: "",
                                    label: "ไม่ปิด",
                                    icon: "✅",
                                    desc: "ใช้กฎ 80% ปกติทั้ง 2 ฝั่ง",
                                  },
                                  {
                                    id: "sell",
                                    label: "ปิดฝั่งขาย",
                                    icon: "💎",
                                    desc: "ไม่ได้ Pool ขาย · รับซื้อยังใช้กฎ 80%",
                                  },
                                  {
                                    id: "buy",
                                    label: "ปิดฝั่งรับซื้อ",
                                    icon: "🛍",
                                    desc: "ไม่ได้ Pool รับซื้อ · ขายยังใช้กฎ 80%",
                                  },
                                  {
                                    id: "both",
                                    label: "ปิดทั้งคู่",
                                    icon: "🔒",
                                    desc: "ไม่ได้ Pool ทั้งหมด · ถ้าขาย < 50% ไม่ได้เงินเดือนพื้นฐาน",
                                  },
                                ];
                                return (
                                  <div
                                    className={`px-3 py-2.5 rounded-[9px] mb-2.5 border-[1.5px] ${cur ? "bg-[#FDECEA80] border-[#C0392B50]" : "bg-cream border-bdr"}`}
                                  >
                                    <div
                                      className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${cur ? "text-red" : "text-txt"}`}
                                    >
                                      🚫 ปิดสิทธิ์ Pool ค่าคอม
                                    </div>
                                    <div className="flex flex-col gap-[5px]">
                                      {opts.map((o) => {
                                        const active = cur === o.id;
                                        return (
                                          <label
                                            key={o.id}
                                            className={`flex items-start gap-2 px-2.5 py-[7px] rounded-[7px] cursor-pointer transition-all duration-150 border ${active ? (o.id ? "bg-[#C0392B15] border-[#C0392B40]" : "bg-green-lt border-[#1A6B3A30]") : "bg-transparent border-transparent"}`}
                                          >
                                            <input
                                              type="radio"
                                              name={`poolExc_${emp.id}`}
                                              value={o.id}
                                              checked={active}
                                              onChange={() =>
                                                setEditingRole((r) => ({
                                                  ...r,
                                                  [`${emp.id}_poolExc`]: o.id,
                                                }))
                                              }
                                              className={`mt-0.5 cursor-pointer ${o.id ? "accent-red" : "accent-green"}`}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div
                                                className={`text-sm font-semibold ${active ? (o.id ? "text-red" : "text-green") : "text-txt"}`}
                                              >
                                                {o.icon} {o.label}
                                              </div>
                                              <div className="text-[10px] text-txt-soft mt-px leading-normal">
                                                {o.desc}
                                              </div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                            <div className="text-sm font-bold text-maroon mb-2">
                              💰 Rate ค่าคอมต่อชิ้น
                            </div>
                            <div className="flex gap-2 mb-2">
                              <div className="flex-1">
                                <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                  💎 ขาย-ทั่วไป
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  value={
                                    eRN !== undefined
                                      ? eRN
                                      : emp.ratePerPieceNormal || 0
                                  }
                                  onChange={(e) =>
                                    setEditingRole((r) => ({
                                      ...r,
                                      [`${emp.id}_rN`]: e.target.value,
                                    }))
                                  }
                                  className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRN !== undefined ? "border-gold" : "border-bdr"}`}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                  ✨ ขาย-พิเศษ
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  value={
                                    eRS !== undefined
                                      ? eRS
                                      : emp.ratePerPieceSpecial || 0
                                  }
                                  onChange={(e) =>
                                    setEditingRole((r) => ({
                                      ...r,
                                      [`${emp.id}_rS`]: e.target.value,
                                    }))
                                  }
                                  className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRS !== undefined ? "border-gold" : "border-bdr"}`}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                  🛍 รับซื้อ
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  value={
                                    eRB !== undefined
                                      ? eRB
                                      : emp.ratePerPieceBuy || 0
                                  }
                                  onChange={(e) =>
                                    setEditingRole((r) => ({
                                      ...r,
                                      [`${emp.id}_rB`]: e.target.value,
                                    }))
                                  }
                                  className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRB !== undefined ? "border-gold" : "border-bdr"}`}
                                />
                              </div>
                            </div>
                            <div className="text-[10px] text-txt-soft text-center mb-2.5">
                              หน่วย: ฿/ชิ้น
                            </div>

                            <div className="h-px my-2.5 bg-[#C9973A30]" />
                            <div className="text-[11px] font-bold text-maroon mb-2">
                              🎫 Rate บัตรสมาชิกต่อใบ
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                  🎫 เชิญชวนสมัคร
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  value={
                                    eRI !== undefined
                                      ? eRI
                                      : emp.ratePerPieceInvite || 0
                                  }
                                  onChange={(e) =>
                                    setEditingRole((r) => ({
                                      ...r,
                                      [`${emp.id}_rI`]: e.target.value,
                                    }))
                                  }
                                  className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRI !== undefined ? "border-gold" : "border-bdr"}`}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[11px] text-txt-soft font-semibold mb-1 block">
                                  🔄 ย้ายข้อมูล
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  value={
                                    eRT !== undefined
                                      ? eRT
                                      : emp.ratePerPieceTransfer || 0
                                  }
                                  onChange={(e) =>
                                    setEditingRole((r) => ({
                                      ...r,
                                      [`${emp.id}_rT`]: e.target.value,
                                    }))
                                  }
                                  className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${eRT !== undefined ? "border-gold" : "border-bdr"}`}
                                />
                              </div>
                            </div>
                            <div className="text-[10px] text-txt-soft text-center mt-1.5">
                              หน่วย: ฿/ใบ
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bottom save button (when dirty) */}
                      {dirty && (
                        <div className="mt-3.5 pt-3.5 border-t border-dashed border-bdr flex gap-2">
                          <button
                            onClick={cancelAll}
                            className="flex-1 py-[11px] rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-[13px] font-semibold cursor-pointer font-[inherit]"
                          >
                            ยกเลิกการแก้ไข
                          </button>
                          <button
                            onClick={saveAll}
                            className="flex-2 py-[11px] rounded-[10px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 shadow-gold-glow"
                          >
                            <IconCheck size={14} stroke={2.5} />
                            บันทึกการเปลี่ยนแปลง
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
