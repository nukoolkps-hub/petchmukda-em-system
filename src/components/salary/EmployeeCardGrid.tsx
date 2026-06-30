/* ─── Employee selection cards ────────────────────────────────────
   ใช้ใน SalaryAdminEdit — เลือกพนักงานแบบการ์ด (click = select)
   การเรียงลำดับพนักงานย้ายไปทำที่ ตั้งค่า > พนักงาน (EmployeeAdminPanel) แล้ว
   ลำดับที่แสดงตรงกัน เพราะ employeeDirectory ถูกเรียงด้วย displayOrder
   จากชั้น subscription เดียวกันทั้งระบบ */

import { Briefcase as IconBriefcase } from "lucide-react";
import { COLORS } from "../../constants";
import AvatarCircle from "../shared/AvatarCircle";

interface Props {
  employees: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  salaryData: Record<string, Record<string, any>>;
  selectedMonth: string;
}

/** มี salary doc ของเดือนนี้ไหม = "บันทึกแล้ว" → เข้ารอบจ่ายแล้ว (ได้รับเงิน
 *  เดือนพื้นฐานเป็นอย่างน้อย) · ไม่มี doc = ตอนยืนยันยอดจะไม่ถูกรวม
 *  (เดิมเช็คเฉพาะ "มีจำนวนชิ้น > 0" ทำให้คนที่บันทึกแล้วแต่ไม่มีชิ้น เช่น
 *   ผู้บริหาร ขึ้นจุดเทาเหมือนคนที่ยังไม่บันทึก — แยกไม่ออกว่าใครตกหล่น) */
function cardHasData(monthData?: Record<string, any> | null): boolean {
  return !!monthData;
}

export default function EmployeeCardGrid({
  employees,
  selectedId,
  onSelect,
  salaryData,
  selectedMonth,
}: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-3.5">
      {employees.map((employee) => (
        <EmployeeCard
          key={employee.id}
          employee={employee}
          selected={employee.id === selectedId}
          hasData={cardHasData(salaryData[employee.id]?.[selectedMonth])}
          onSelect={() => onSelect(employee.id)}
        />
      ))}
    </div>
  );
}

/* การ์ดเลือกพนักงาน */
function EmployeeCard({ employee, selected, hasData, onSelect }: any) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-2.5 rounded-xl border-[1.5px] cursor-pointer font-[inherit] select-none transition-transform duration-100 active:scale-[1.03] ${
        selected
          ? "border-gold bg-gold-pale shadow-[0_2px_8px_rgba(201,151,58,0.25)]"
          : "border-bdr bg-white"
      }`}
    >
      <span
        aria-label={hasData ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
        title={hasData ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
        className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-white shadow-sm ${
          hasData ? "bg-green" : "bg-txt-soft/40"
        }`}
      />
      <AvatarCircle
        avatar={employee.avatar}
        avatarType={employee.avatarType}
        avatarImageUrl={employee.avatarImageUrl}
        size={44}
        fontSize={14}
        border={`2px solid ${COLORS.gold}40`}
      />
      <div className="w-full min-w-0 text-center">
        <div
          className={`font-bold text-sm truncate leading-tight ${selected ? "text-maroon" : "text-txt"}`}
        >
          {employee.name}
        </div>
        <div className="text-xs text-txt-soft truncate leading-tight mt-0.5 inline-flex items-center gap-1">
          <IconBriefcase size={11} strokeWidth={2.4} />
          {employee.role || "-"}
        </div>
      </div>
    </button>
  );
}
