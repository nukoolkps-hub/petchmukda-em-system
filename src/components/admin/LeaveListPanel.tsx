import {
  ChevronDown as IconChevronDown,
  FastForward as IconFastForward,
  Trash2 as IconTrash,
} from "lucide-react";
import { useState } from "react";
import { COLORS, LEAVE_TYPES } from "../../constants";
import type { Employee, LeaveEntry } from "../../types";
import { fmtDateWithWeekday, isPast } from "../../utils/dateUtils";
import ConfirmModal from "../modals/ConfirmModal";
import AvatarCircle from "../shared/AvatarCircle";

interface LeaveListPanelProps {
  allLeaves: LeaveEntry[];
  employeeDirectory: Employee[];
  onDelete: (id: string | number) => void;
}

/* ─── Admin: Leave List (รายการลาทั้งหมด + filter + ลบ) ─────────── */
export default function LeaveListPanel({
  allLeaves,
  employeeDirectory,
  onDelete,
}: LeaveListPanelProps) {
  const [employeeFilter, setFilterEmp] = useState("");
  const [filterType, setFilterType] = useState("");
  const [confirmLeave, setConfirmLeave] = useState<any>(null);

  // รายการลาทั้งหมด (รวมอนาคต) — admin ต้องเห็นทุกใบไม่ใช่แค่ที่ผ่านมาแล้ว
  // filter ด้วย employeeId (ไม่ใช่ชื่อ) — กันชื่อซ้ำ/เปลี่ยนชื่อ
  const filteredLeaves = allLeaves
    .filter((lv) => !employeeFilter || lv.employeeId === employeeFilter)
    .filter((lv) => !filterType || lv.type === filterType)
    .sort((a, b) => b.start.localeCompare(a.start));

  return (
    <div>
      <div className="flex gap-2 mb-3.5">
        <div className="relative flex-1">
          <select
            value={employeeFilter}
            onChange={(e) => setFilterEmp(e.target.value)}
            className="appearance-none cursor-pointer w-full pl-3 pr-8 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
          >
            <option value="">พนักงานทั้งหมด</option>
            {employeeDirectory.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={14}
            strokeWidth={2.4}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
          />
        </div>
        <div className="relative flex-1">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none cursor-pointer w-full pl-3 pr-8 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
          >
            <option value="">ประเภททั้งหมด</option>
            {LEAVE_TYPES.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.label}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={14}
            strokeWidth={2.4}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
          />
        </div>
      </div>
      {filteredLeaves.length === 0 && (
        <div className="text-center text-txt-soft py-10 text-base">
          ไม่มีรายการลาย้อนหลัง
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {filteredLeaves.map((lv) => {
          const lt = LEAVE_TYPES.find((t) => t.id === lv.type);
          const employeeInfo = employeeDirectory.find(
            (e) => e.id === lv.employeeId,
          );
          return (
            <div
              key={lv.id}
              className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr flex items-start gap-3"
            >
              <AvatarCircle
                avatar={
                  employeeInfo?.avatar ||
                  (employeeInfo?.name || lv.employeeName)?.slice(0, 2)
                }
                avatarType={employeeInfo?.avatarType || "text"}
                avatarImageUrl={employeeInfo?.avatarImageUrl || null}
                size={42}
                fontSize={13}
                border={`2px solid ${COLORS.gold}40`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-txt text-base mb-[3px] flex items-center gap-1.5">
                  {employeeInfo?.name || lv.employeeName}
                  {!isPast(lv.end) && (
                    <span className="text-xs font-bold px-1.5 py-px rounded-[10px] bg-gold-pale text-maroon border border-[#C9973A40] inline-flex items-center gap-0.5">
                      <IconFastForward size={10} strokeWidth={2.4} />
                      อนาคต
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: lt?.color }}
                  >
                    {lt?.icon} {lt?.label}
                  </span>
                  <span className="text-sm text-txt-soft">
                    · {lv.days} วันทำการ
                  </span>
                </div>
                <div className="text-sm text-txt-mid">
                  {fmtDateWithWeekday(lv.start)}
                  {lv.start !== lv.end
                    ? ` - ${fmtDateWithWeekday(lv.end)}`
                    : ""}
                </div>
              </div>
              <button
                onClick={() => setConfirmLeave(lv)}
                className="w-9 h-9 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer shrink-0 border-[1.5px] border-[#C0392B30]"
              >
                <IconTrash size={16} color={COLORS.red} strokeWidth={2.2} />
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
  );
}
