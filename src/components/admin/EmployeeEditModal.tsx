import {
  Ban as IconBan,
  Briefcase as IconBriefcase,
  Landmark as IconBuildingBank,
  CalendarDays as IconCalendar,
  Check as IconCheck,
  CircleCheck as IconCircleCheck,
  CircleDollarSign as IconCircleDollarSign,
  Copy as IconCopy,
  Diamond as IconDiamond,
  Lightbulb as IconLightbulb,
  Lock as IconLock,
  MessageCircle as IconMessageCircle,
  Package as IconPackage,
  Pencil as IconPencil,
  RefreshCw as IconRefresh,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Ticket as IconTicket,
  Trash2 as IconTrash,
  User as IconUser,
  X as IconX,
} from "lucide-react";
import { COLORS } from "../../constants";
import type { Employee, Role } from "../../types";
import AvatarCircle from "../shared/AvatarCircle";
import BankLogo from "../shared/BankLogo";
import BaseModal from "../shared/BaseModal";
import { clearEmployeeDraft } from "./employeeEditFields";

type EditingRole = Record<string, any>;

interface EmployeeEditModalProps {
  employee: Employee;
  employeeRole: Role | undefined;
  editingRole: EditingRole;
  setEditingRole: React.Dispatch<React.SetStateAction<EditingRole>>;
  onUpdateRole: (employeeId: string, field: string, value: unknown) => void;
  copiedLineId: string | null;
  copyLineId: (text: string | undefined, employeeId: string) => void;
  onClose: () => void;
  onRequestDelete: () => void;
}

/* ─── Admin: Employee edit modal (one employee) ────────────────── */
export default function EmployeeEditModal({
  employee,
  employeeRole,
  editingRole,
  setEditingRole,
  onUpdateRole,
  copiedLineId,
  copyLineId,
  onClose,
  onRequestDelete,
}: EmployeeEditModalProps) {
  const editingNormalSalePieceRate =
    editingRole[`${employee.id}:normalSalePieceRate`];
  const editingSpecialSalePieceRate =
    editingRole[`${employee.id}:specialSalePieceRate`];
  const editingBuyPieceRate = editingRole[`${employee.id}:buyPieceRate`];
  const editingInvitePieceRate = editingRole[`${employee.id}:invitePieceRate`];
  const editingTransferPieceRate =
    editingRole[`${employee.id}:transferPieceRate`];
  const editingSinglePieceRate = editingRole[`${employee.id}:singlePieceRate`];
  const editingBaseSalary = editingRole[`${employee.id}:baseSalary`];
  const editingSocialSecurity = editingRole[`${employee.id}:socialSecurity`];
  const editingStartWorkMonth = editingRole[`${employee.id}:startWorkMonth`];
  const editingPrefix = editingRole[`${employee.id}:prefix`];
  const editingSalaryDisabled = editingRole[`${employee.id}:salaryDisabled`];
  const editingPoolExclusion = editingRole[`${employee.id}:poolExclusion`];
  const editingName = editingRole[`${employee.id}:name`];
  const dirty =
    editingNormalSalePieceRate !== undefined ||
    editingSpecialSalePieceRate !== undefined ||
    editingBuyPieceRate !== undefined ||
    editingInvitePieceRate !== undefined ||
    editingTransferPieceRate !== undefined ||
    editingSinglePieceRate !== undefined ||
    editingBaseSalary !== undefined ||
    editingSocialSecurity !== undefined ||
    editingStartWorkMonth !== undefined ||
    editingPrefix !== undefined ||
    editingSalaryDisabled !== undefined ||
    editingPoolExclusion !== undefined ||
    editingName !== undefined;

  const clearDraft = () =>
    setEditingRole((prev) => clearEmployeeDraft(prev, employee.id));

  const saveAll = async () => {
    if (editingName !== undefined && editingName.trim() !== "")
      await onUpdateRole(employee.id, "name", editingName.trim());
    if (editingNormalSalePieceRate !== undefined)
      await onUpdateRole(
        employee.id,
        "normalSalePieceRate",
        parseFloat(editingNormalSalePieceRate) || 0,
      );
    if (editingSpecialSalePieceRate !== undefined)
      await onUpdateRole(
        employee.id,
        "specialSalePieceRate",
        parseFloat(editingSpecialSalePieceRate) || 0,
      );
    if (editingBuyPieceRate !== undefined)
      await onUpdateRole(
        employee.id,
        "buyPieceRate",
        parseFloat(editingBuyPieceRate) || 0,
      );
    if (editingInvitePieceRate !== undefined)
      await onUpdateRole(
        employee.id,
        "invitePieceRate",
        parseFloat(editingInvitePieceRate) || 0,
      );
    if (editingTransferPieceRate !== undefined)
      await onUpdateRole(
        employee.id,
        "transferPieceRate",
        parseFloat(editingTransferPieceRate) || 0,
      );
    if (editingSinglePieceRate !== undefined)
      await onUpdateRole(
        employee.id,
        "singlePieceRate",
        parseFloat(editingSinglePieceRate) || 0,
      );
    if (editingBaseSalary !== undefined)
      await onUpdateRole(
        employee.id,
        "baseSalary",
        parseFloat(editingBaseSalary) || 0,
      );
    if (editingSocialSecurity !== undefined)
      await onUpdateRole(
        employee.id,
        "socialSecurity",
        parseFloat(editingSocialSecurity) || 0,
      );
    if (editingStartWorkMonth !== undefined)
      await onUpdateRole(employee.id, "startWorkMonth", editingStartWorkMonth);
    if (editingPrefix !== undefined)
      await onUpdateRole(employee.id, "prefix", editingPrefix);
    if (editingSalaryDisabled !== undefined)
      await onUpdateRole(employee.id, "salaryDisabled", editingSalaryDisabled);
    if (editingPoolExclusion !== undefined)
      await onUpdateRole(
        employee.id,
        "poolExclusion",
        editingPoolExclusion || null,
      );
    clearDraft();
    onClose();
  };
  const cancelAll = (closeModal = false) => {
    clearDraft();
    if (closeModal) onClose();
  };

  return (
    <BaseModal onClose={onClose} maxWidthClass="max-w-[760px]">
      <div className="sticky top-0 z-10 bg-cream px-5 py-4 border-b border-bdr flex items-center gap-3">
        <AvatarCircle
          avatar={employee.avatar}
          avatarType={employee.avatarType}
          avatarImageUrl={employee.avatarImageUrl}
          size={46}
          fontSize={15}
          border={`2px solid ${COLORS.gold}40`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt truncate">
            {employee.name}
          </div>
          <div className="text-sm text-txt-soft mt-0.5 truncate inline-flex items-center gap-1.5">
            <IconBriefcase size={13} strokeWidth={2.4} />
            {employee.role || "ยังไม่กำหนดตำแหน่ง"}
          </div>
        </div>
        <button
          type="button"
          aria-label="ปิดหน้าต่างแก้ไขพนักงาน"
          onClick={onClose}
          className="w-9 h-9 rounded-[10px] border border-bdr bg-white text-txt-mid cursor-pointer flex items-center justify-center"
        >
          <IconX size={18} strokeWidth={2.3} />
        </button>
      </div>
      <div className="px-4 py-3.5">
        {/* Name + prefix — editable */}
        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
            <IconPencil
              size={12}
              strokeWidth={2.4}
              className="inline mr-1 -mt-px"
            />
            ชื่อพนักงาน (คำนำหน้า + ชื่อ)
          </label>
          <div className="flex gap-2">
            <select
              value={
                editingPrefix !== undefined
                  ? editingPrefix
                  : employee.prefix || "นางสาว"
              }
              onChange={(e) =>
                setEditingRole((previousEditingRole) => ({
                  ...previousEditingRole,
                  [`${employee.id}:prefix`]: e.target.value,
                }))
              }
              className={`shrink-0 w-[110px] py-[9px] px-2 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${editingPrefix !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
            >
              <option value="นางสาว">นางสาว</option>
              <option value="นาง">นาง</option>
              <option value="นาย">นาย</option>
            </select>
            <input
              type="text"
              value={editingName !== undefined ? editingName : employee.name}
              onChange={(e) =>
                setEditingRole((previousEditingRole) => ({
                  ...previousEditingRole,
                  [`${employee.id}:name`]: e.target.value,
                }))
              }
              className={`flex-1 min-w-0 py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${editingName !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
            />
          </div>
          <div className="text-xs text-txt-soft mt-[3px]">
            คำนำหน้าใช้ในหนังสือรับรองเงินเดือน
          </div>
        </div>
        {/* Role — read-only (แก้จากแท็บ "ตำแหน่ง") */}
        <div className="mb-2.5 px-3 py-2.5 bg-cream rounded-[10px] border border-dashed border-bdr">
          <div className="text-xs text-txt-soft font-semibold mb-[5px] flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              <IconUser size={12} strokeWidth={2.4} />
              ตำแหน่ง
            </span>
            <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
              แก้ในแท็บ "ตำแหน่ง"
            </span>
          </div>
          <div
            className={`text-sm font-bold ${employee.role && employee.role !== "-" ? "text-txt" : "text-txt-soft italic"}`}
          >
            {employee.role && employee.role !== "-"
              ? employee.role
              : "ยังไม่กำหนดตำแหน่ง"}
          </div>
        </div>
        {/* Bank info — read-only (พนักงานเป็นคนกรอกเอง) */}
        <div className="mb-3 px-3 py-2.5 bg-cream rounded-[10px] border border-dashed border-bdr">
          <div className="text-xs text-txt-soft font-semibold mb-[5px] flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              <IconBuildingBank size={12} strokeWidth={2.4} />
              บัญชีรับเงินเดือน
            </span>
            <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
              พนักงานกรอกเอง
            </span>
          </div>
          {employee.bank || employee.bankAccountNumber ? (
            <>
              <div className="text-sm font-bold text-txt mb-px flex items-center gap-1.5">
                <BankLogo bank={employee.bank} size={18} />
                {employee.bank || "-"}
              </div>
              <div className="text-sm text-txt-mid tracking-wider">
                {employee.bankAccountNumber || "-"}
              </div>
            </>
          ) : (
            <div className="text-sm text-txt-soft italic">ยังไม่มีข้อมูลบัญชี</div>
          )}
        </div>

        {/* LINE User ID — read-only, copy only */}
        <div className="mb-3">
          <label className="text-xs text-txt-soft font-semibold mb-1 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              <IconMessageCircle
                size={12}
                strokeWidth={2.4}
                className="inline mr-1 -mt-px"
              />
              LINE User ID
              {employee.lineUserId ? (
                <span className="text-xs px-1.5 py-px rounded-lg bg-[#06C75520] text-[#06A04E] font-bold">
                  เชื่อมแล้ว
                </span>
              ) : (
                <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold">
                  ยังไม่เชื่อม
                </span>
              )}
            </span>
            <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
              อ่านอย่างเดียว
            </span>
          </label>
          {employee.lineUserId ? (
            <button
              onClick={() => copyLineId(employee.lineUserId, employee.id)}
              className={`w-full px-3 py-[9px] rounded-[9px] bg-cream cursor-pointer font-[inherit] flex items-center gap-2 transition-all duration-200 border ${copiedLineId === employee.id ? "border-green" : "border-bdr"}`}
            >
              <span className="flex-1 text-left text-sm text-txt font-[Prompt,monospace] tracking-[0.02em] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                {employee.lineUserId}
              </span>
              <span
                className={`flex items-center gap-1 px-[9px] py-1 rounded-[7px] text-xs font-bold whitespace-nowrap transition-all duration-200 ${copiedLineId === employee.id ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
              >
                {copiedLineId === employee.id ? (
                  <>
                    <IconCheck size={12} strokeWidth={3} />
                    คัดลอกแล้ว
                  </>
                ) : (
                  <>
                    <IconCopy size={12} strokeWidth={2.2} />
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
          <div className="text-xs text-txt-soft mt-[3px] leading-normal">
            <IconLightbulb
              size={12}
              strokeWidth={2.4}
              className="inline mr-1 -mt-px"
            />
            ID จะถูกเก็บอัตโนมัติเมื่อพนักงานเข้าสู่ระบบผ่าน LINE
          </div>
        </div>

        {/* Base Salary */}
        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
            <IconBriefcase
              size={12}
              strokeWidth={2.4}
              className="inline mr-1 -mt-px"
            />
            เงินเดือนพื้นฐาน
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
                editingBaseSalary !== undefined
                  ? editingBaseSalary
                  : (employee.baseSalary ?? "")
              }
              onChange={(e) =>
                setEditingRole((previousEditingRole) => ({
                  ...previousEditingRole,
                  [`${employee.id}:baseSalary`]: e.target.value,
                }))
              }
              className={`w-full py-[9px] pr-3 pl-[30px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt text-right border-[1.5px] ${editingBaseSalary !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
            />
          </div>
          <div className="text-xs text-txt-soft mt-[3px]">หน่วย: บาท/เดือน</div>
        </div>

        {/* Social Security */}
        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
            <IconBuildingBank
              size={12}
              strokeWidth={2.4}
              className="inline mr-1 -mt-px"
            />
            หักประกันสังคม
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
                editingSocialSecurity !== undefined
                  ? editingSocialSecurity
                  : (employee.socialSecurity ?? "")
              }
              onChange={(e) =>
                setEditingRole((previousEditingRole) => ({
                  ...previousEditingRole,
                  [`${employee.id}:socialSecurity`]: e.target.value,
                }))
              }
              className={`w-full py-[9px] pr-3 pl-[30px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt text-right border-[1.5px] ${editingSocialSecurity !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
            />
          </div>
          <div className="text-xs text-txt-soft mt-[3px]">
            หน่วย: บาท/เดือน (หักทุกเดือนอัตโนมัติ)
          </div>
        </div>

        {/* Start work month — ใช้ในหนังสือรับรองเงินเดือน */}
        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
            <IconCalendar size={12} strokeWidth={2.4} />
            วันที่เริ่มงาน
          </label>
          {(() => {
            const curYM =
              editingStartWorkMonth !== undefined
                ? editingStartWorkMonth
                : employee.startWorkMonth || "";
            const [curYear, curMonth] = curYM.includes("-")
              ? curYM.split("-")
              : ["", ""];
            const thaiMonths = [
              "มกราคม",
              "กุมภาพันธ์",
              "มีนาคม",
              "เมษายน",
              "พฤษภาคม",
              "มิถุนายน",
              "กรกฎาคม",
              "สิงหาคม",
              "กันยายน",
              "ตุลาคม",
              "พฤศจิกายน",
              "ธันวาคม",
            ];
            const nowYear = new Date().getFullYear();
            const years = Array.from({ length: 40 }, (_, i) => nowYear - i);
            const setYM = (y: string, m: string) =>
              setEditingRole((previousEditingRole) => ({
                ...previousEditingRole,
                [`${employee.id}:startWorkMonth`]: y && m ? `${y}-${m}` : "",
              }));
            const dirtyCls =
              editingStartWorkMonth !== undefined
                ? "border-gold bg-white"
                : "border-bdr bg-cream";
            return (
              <div className="flex gap-2">
                <select
                  value={curMonth}
                  onChange={(e) =>
                    setYM(curYear || String(nowYear), e.target.value)
                  }
                  className={`flex-1 py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${dirtyCls}`}
                >
                  <option value="">เดือน</option>
                  {thaiMonths.map((mn, i) => (
                    <option key={mn} value={String(i + 1).padStart(2, "0")}>
                      {mn}
                    </option>
                  ))}
                </select>
                <select
                  value={curYear}
                  onChange={(e) => setYM(e.target.value, curMonth || "01")}
                  className={`flex-1 py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${dirtyCls}`}
                >
                  <option value="">ปี (พ.ศ.)</option>
                  {years.map((y) => (
                    <option key={y} value={String(y)}>
                      {y + 543}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}
          <div className="text-xs text-txt-soft mt-[3px]">
            ใช้ในหนังสือรับรองเงินเดือน
          </div>
        </div>

        {/* Disable Salary toggle */}
        {(() => {
          const currentSalaryDisabled =
            editingSalaryDisabled !== undefined
              ? editingSalaryDisabled
              : !!employee.salaryDisabled;
          return (
            <div
              className={`px-3 py-2.5 rounded-[10px] mb-2.5 border-[1.5px] ${currentSalaryDisabled ? "bg-red-lt border-[#C0392B50]" : "bg-cream border-bdr"}`}
            >
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSalaryDisabled}
                  onChange={(e) =>
                    setEditingRole((previousEditingRole) => ({
                      ...previousEditingRole,
                      [`${employee.id}:salaryDisabled`]: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 cursor-pointer accent-red"
                />
                <div className="flex-1">
                  <div
                    className={`text-sm font-bold ${currentSalaryDisabled ? "text-red" : "text-txt"}`}
                  >
                    <IconLock
                      size={12}
                      strokeWidth={2.4}
                      className="inline mr-1 -mt-px"
                    />
                    ปิดสิทธิ์ระบบเงินเดือน
                  </div>
                  <div className="text-xs text-txt-soft mt-0.5 leading-normal">
                    ซ่อนแท็บ "เงินเดือน" จากพนักงาน · ใช้ได้แค่ระบบลา
                  </div>
                </div>
              </label>
            </div>
          );
        })()}

        {/* Commission rates per piece */}
        {(() => {
          const usesSinglePieceRate = employeeRole && !employeeRole.poolGroup;
          if (usesSinglePieceRate) {
            return (
              <div className="p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                <div className="text-sm font-bold text-maroon mb-2">
                  <IconCircleDollarSign
                    size={12}
                    strokeWidth={2.4}
                    className="inline mr-1 -mt-px"
                  />
                  Rate ค่าคอมต่อชิ้น
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-txt-soft font-semibold mb-1 block">
                      <IconPackage
                        size={12}
                        strokeWidth={2.4}
                        className="inline mr-1 -mt-px"
                      />
                      ค่าคอมต่อชิ้น
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={
                        editingSinglePieceRate !== undefined
                          ? editingSinglePieceRate
                          : (employee.singlePieceRate ?? "")
                      }
                      onChange={(e) =>
                        setEditingRole((previousEditingRole) => ({
                          ...previousEditingRole,
                          [`${employee.id}:singlePieceRate`]: e.target.value,
                        }))
                      }
                      className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingSinglePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                    />
                  </div>
                </div>
                <div className="text-xs text-txt-soft text-center mt-1.5">
                  หน่วย: ฿/ชิ้น
                </div>

                <div className="h-px my-2.5 bg-[#C9973A30]" />
                <div className="text-xs font-bold text-maroon mb-2">
                  <IconTicket
                    size={12}
                    strokeWidth={2.4}
                    className="inline mr-1 -mt-px"
                  />
                  Rate บัตรสมาชิกต่อใบ
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-txt-soft font-semibold mb-1 block">
                      <IconTicket
                        size={12}
                        strokeWidth={2.4}
                        className="inline mr-1 -mt-px"
                      />
                      เชิญชวนสมัคร
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={
                        editingInvitePieceRate !== undefined
                          ? editingInvitePieceRate
                          : (employee.invitePieceRate ?? "")
                      }
                      onChange={(e) =>
                        setEditingRole((previousEditingRole) => ({
                          ...previousEditingRole,
                          [`${employee.id}:invitePieceRate`]: e.target.value,
                        }))
                      }
                      className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingInvitePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-txt-soft font-semibold mb-1 block">
                      <IconRefresh
                        size={12}
                        strokeWidth={2.4}
                        className="inline mr-1 -mt-px"
                      />
                      ย้ายข้อมูล
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={
                        editingTransferPieceRate !== undefined
                          ? editingTransferPieceRate
                          : (employee.transferPieceRate ?? "")
                      }
                      onChange={(e) =>
                        setEditingRole((previousEditingRole) => ({
                          ...previousEditingRole,
                          [`${employee.id}:transferPieceRate`]: e.target.value,
                        }))
                      }
                      className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingTransferPieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                    />
                  </div>
                </div>
                <div className="text-xs text-txt-soft text-center mt-1.5">
                  หน่วย: ฿/ใบ
                </div>
              </div>
            );
          }
          return (
            <div className="p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
              {/* Exclude from Pool — 3 levels (only for pool-group roles) */}
              {employeeRole?.poolGroup &&
                (() => {
                  const currentPoolExclusion =
                    editingPoolExclusion !== undefined
                      ? editingPoolExclusion
                      : employee.poolExclusion || "";
                  const poolExclusionOptions = [
                    {
                      id: "",
                      label: "ไม่ปิด",
                      Icon: IconCircleCheck,
                      desc: "ใช้กฎ 80% ปกติทั้ง 2 ฝั่ง",
                    },
                    {
                      id: "sell",
                      label: "ปิดฝั่งขาย",
                      Icon: IconDiamond,
                      desc: "ไม่ได้กองกลางขาย · รับซื้อยังใช้กฎ 80%",
                    },
                    {
                      id: "buy",
                      label: "ปิดฝั่งรับซื้อ",
                      Icon: IconShoppingBag,
                      desc: "ไม่ได้กองกลางรับซื้อ · ขายยังใช้กฎ 80%",
                    },
                    {
                      id: "both",
                      label: "ปิดทั้งคู่",
                      Icon: IconLock,
                      desc: "ไม่ได้กองกลางทั้งหมด · ถ้าขาย < 50% ไม่ได้เงินเดือนพื้นฐาน",
                    },
                  ];
                  return (
                    <div
                      className={`px-3 py-2.5 rounded-[9px] mb-2.5 border-[1.5px] ${currentPoolExclusion ? "bg-[#FDECEA80] border-[#C0392B50]" : "bg-cream border-bdr"}`}
                    >
                      <div
                        className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${currentPoolExclusion ? "text-red" : "text-txt"}`}
                      >
                        <IconBan
                          size={14}
                          strokeWidth={2.4}
                          className="inline mr-1 -mt-px"
                        />
                        ปิดสิทธิ์ค่าคอมกองกลาง
                      </div>
                      <div className="flex flex-col gap-[5px]">
                        {poolExclusionOptions.map((poolExclusionOption) => {
                          const active =
                            currentPoolExclusion === poolExclusionOption.id;
                          return (
                            <label
                              key={poolExclusionOption.id}
                              className={`flex items-start gap-2 px-2.5 py-[7px] rounded-[7px] cursor-pointer transition-all duration-150 border ${active ? (poolExclusionOption.id ? "bg-[#C0392B15] border-[#C0392B40]" : "bg-green-lt border-[#1A6B3A30]") : "bg-transparent border-transparent"}`}
                            >
                              <input
                                type="radio"
                                name={`poolExclusion_${employee.id}`}
                                value={poolExclusionOption.id}
                                checked={active}
                                onChange={() =>
                                  setEditingRole((previousEditingRole) => ({
                                    ...previousEditingRole,
                                    [`${employee.id}:poolExclusion`]:
                                      poolExclusionOption.id,
                                  }))
                                }
                                className={`mt-0.5 cursor-pointer ${poolExclusionOption.id ? "accent-red" : "accent-green"}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm font-semibold flex items-center gap-1.5 ${active ? (poolExclusionOption.id ? "text-red" : "text-green") : "text-txt"}`}
                                >
                                  <poolExclusionOption.Icon
                                    size={13}
                                    strokeWidth={2.4}
                                  />
                                  {poolExclusionOption.label}
                                </div>
                                <div className="text-xs text-txt-soft mt-px leading-normal">
                                  {poolExclusionOption.desc}
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
                <IconCircleDollarSign
                  size={12}
                  strokeWidth={2.4}
                  className="inline mr-1 -mt-px"
                />
                Rate ค่าคอมต่อชิ้น
              </div>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                    <IconDiamond
                      size={12}
                      strokeWidth={2.4}
                      className="inline mr-1 -mt-px"
                    />
                    ขาย-ทั่วไป
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={
                      editingNormalSalePieceRate !== undefined
                        ? editingNormalSalePieceRate
                        : (employee.normalSalePieceRate ?? "")
                    }
                    onChange={(e) =>
                      setEditingRole((previousEditingRole) => ({
                        ...previousEditingRole,
                        [`${employee.id}:normalSalePieceRate`]: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingNormalSalePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                    <IconSparkles
                      size={12}
                      strokeWidth={2.4}
                      className="inline mr-1 -mt-px"
                    />
                    ขาย-พิเศษ
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={
                      editingSpecialSalePieceRate !== undefined
                        ? editingSpecialSalePieceRate
                        : (employee.specialSalePieceRate ?? "")
                    }
                    onChange={(e) =>
                      setEditingRole((previousEditingRole) => ({
                        ...previousEditingRole,
                        [`${employee.id}:specialSalePieceRate`]: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingSpecialSalePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                    <IconShoppingBag
                      size={12}
                      strokeWidth={2.4}
                      className="inline mr-1 -mt-px"
                    />
                    รับซื้อ
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={
                      editingBuyPieceRate !== undefined
                        ? editingBuyPieceRate
                        : (employee.buyPieceRate ?? "")
                    }
                    onChange={(e) =>
                      setEditingRole((previousEditingRole) => ({
                        ...previousEditingRole,
                        [`${employee.id}:buyPieceRate`]: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingBuyPieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                  />
                </div>
              </div>
              <div className="text-xs text-txt-soft text-center mb-2.5">
                หน่วย: ฿/ชิ้น
              </div>

              <div className="h-px my-2.5 bg-[#C9973A30]" />
              <div className="text-xs font-bold text-maroon mb-2">
                <IconTicket
                  size={12}
                  strokeWidth={2.4}
                  className="inline mr-1 -mt-px"
                />
                Rate บัตรสมาชิกต่อใบ
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                    <IconTicket
                      size={12}
                      strokeWidth={2.4}
                      className="inline mr-1 -mt-px"
                    />
                    เชิญชวนสมัคร
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={
                      editingInvitePieceRate !== undefined
                        ? editingInvitePieceRate
                        : (employee.invitePieceRate ?? "")
                    }
                    onChange={(e) =>
                      setEditingRole((previousEditingRole) => ({
                        ...previousEditingRole,
                        [`${employee.id}:invitePieceRate`]: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingInvitePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                    <IconRefresh
                      size={12}
                      strokeWidth={2.4}
                      className="inline mr-1 -mt-px"
                    />
                    ย้ายข้อมูล
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={
                      editingTransferPieceRate !== undefined
                        ? editingTransferPieceRate
                        : (employee.transferPieceRate ?? "")
                    }
                    onChange={(e) =>
                      setEditingRole((previousEditingRole) => ({
                        ...previousEditingRole,
                        [`${employee.id}:transferPieceRate`]: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingTransferPieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                  />
                </div>
              </div>
              <div className="text-xs text-txt-soft text-center mt-1.5">
                หน่วย: ฿/ใบ
              </div>
            </div>
          );
        })()}
      </div>
      <div className="sticky bottom-0 z-10 bg-white px-4 py-3 border-t border-bdr shadow-[0_-8px_20px_rgba(90,30,10,0.06)]">
        {dirty ? (
          <div className="flex gap-2">
            <button
              onClick={() => cancelAll(true)}
              className="flex-1 py-[11px] rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
            >
              ยกเลิกการแก้ไข
            </button>
            <button
              onClick={saveAll}
              className="flex-2 py-[11px] rounded-[10px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 shadow-gold-glow"
            >
              <IconCheck size={14} strokeWidth={2.5} />
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRequestDelete}
              className="py-[11px] px-4 rounded-[10px] border-[1.5px] border-red/40 bg-white text-red text-sm font-semibold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5"
            >
              <IconTrash size={15} strokeWidth={2.2} />
              ลบ
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-[11px] rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
            >
              ปิด
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
