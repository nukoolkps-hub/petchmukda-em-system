import {
  AlertTriangle as IconAlertTriangle,
  Ban as IconBan,
  Briefcase as IconBriefcase,
  Landmark as IconBuildingBank,
  CalendarDays as IconCalendar,
  Check as IconCheck,
  ChevronDown as IconChevronDown,
  CircleCheck as IconCircleCheck,
  CircleDollarSign as IconCircleDollarSign,
  Copy as IconCopy,
  Diamond as IconDiamond,
  Lightbulb as IconLightbulb,
  Lock as IconLock,
  MessageCircle as IconMessageCircle,
  Package as IconPackage,
  Pencil as IconPencil,
  Plus as IconPlus,
  RefreshCw as IconRefresh,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Ticket as IconTicket,
  Trash2 as IconTrash,
  User as IconUser,
  X as IconX,
} from "lucide-react";
import { useMemo, useState } from "react";
import { COLORS, getBankAccountDigits } from "../../constants";
import type { Employee, Role } from "../../types";
import { formatTenure } from "../../utils/dateUtils";
import {
  buildRaiseHistory,
  getEffectiveBaseSalary,
  LEGACY_PIECE_ITEM_ID,
  rolePaysPieceCommission,
  roleBonusItems,
  rolePieceItems,
  rolePoolItems,
  rolePrimaryPoolItemId,
} from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BankPicker from "../shared/BankPicker";
import BaseModal from "../shared/BaseModal";
import AnnualRaiseSection from "./AnnualRaiseSection";
import { clearEmployeeDraft } from "./employeeEditFields";
import RecurringItemsEditor, {
  type RecurringItem,
} from "./RecurringItemsEditor";

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
  const [activeTab, setActiveTab] = useState<"personal" | "salary">("personal");
  const editingNormalSalePieceRate =
    editingRole[`${employee.id}:normalSalePieceRate`];
  const editingSpecialSalePieceRate =
    editingRole[`${employee.id}:specialSalePieceRate`];
  const editingBuyPieceRate = editingRole[`${employee.id}:buyPieceRate`];
  const editingInvitePieceRate = editingRole[`${employee.id}:invitePieceRate`];
  const editingTransferPieceRate =
    editingRole[`${employee.id}:transferPieceRate`];
  const editingSinglePieceRate = editingRole[`${employee.id}:singlePieceRate`];
  // bonusRates (multi-item โบนัสอื่นๆ) — map เดียวเหมือน pieceRates
  const editingBonusRates = editingRole[`${employee.id}:bonusRates`] as
    | Record<string, number>
    | undefined;

  // poolItemRates (multi-item pool sales) — map เดียวเหมือน pieceRates/bonusRates
  const editingPoolItemRates = editingRole[`${employee.id}:poolItemRates`] as
    | Record<string, number>
    | undefined;

  // pieceRates (multi-item) — เก็บทั้ง map ใน draft key เดียว
  const editingPieceRates = editingRole[`${employee.id}:pieceRates`] as
    | Record<string, number>
    | undefined;
  const editingBaseSalary = editingRole[`${employee.id}:baseSalary`];
  const editingSocialSecurity = editingRole[`${employee.id}:socialSecurity`];
  const editingStartWorkMonth = editingRole[`${employee.id}:startWorkMonth`];
  const editingPrefix = editingRole[`${employee.id}:prefix`];
  const editingSalaryDisabled = editingRole[`${employee.id}:salaryDisabled`];
  const editingPoolExclusion = editingRole[`${employee.id}:poolExclusion`];
  const editingName = editingRole[`${employee.id}:name`];
  const editingNickname = editingRole[`${employee.id}:nickname`];
  const editingBank = editingRole[`${employee.id}:bank`] as string | undefined;
  const editingBankAccountNumber = editingRole[
    `${employee.id}:bankAccountNumber`
  ] as string | undefined;
  // ค่าปัจจุบันของช่องธนาคาร (live หรือ draft) → ใช้คุม max digits ของเลขบัญชี
  const currentBank =
    editingBank !== undefined ? editingBank : employee.bank || "";
  const bankDigitLimit = getBankAccountDigits(currentBank);
  // นับ digit ของเลขบัญชีปัจจุบัน (live หรือ draft) — ใช้โชว์ warning เตือนถ้าไม่ครบ
  const currentBankAccountNumber =
    editingBankAccountNumber !== undefined
      ? editingBankAccountNumber
      : employee.bankAccountNumber || "";
  const bankAccountDigitsTyped = currentBankAccountNumber.replace(
    /[^0-9]/g,
    "",
  ).length;
  // warning เมื่อ: เลือกธนาคารแล้ว + พิมพ์เลขแล้ว + ยังไม่ครบจำนวนหลัก
  const bankAccountIncomplete =
    !!currentBank &&
    bankAccountDigitsTyped > 0 &&
    bankAccountDigitsTyped < bankDigitLimit;
  const editingRecurringItems = editingRole[`${employee.id}:recurringItems`] as
    | RecurringItem[]
    | undefined;
  const editingAnnualRaises = editingRole[`${employee.id}:annualRaises`] as
    | Record<string, number>
    | undefined;
  const editingAnnualRaiseAmount = editingRole[
    `${employee.id}:annualRaiseAmount`
  ] as string | undefined;
  const dirty =
    editingNormalSalePieceRate !== undefined ||
    editingSpecialSalePieceRate !== undefined ||
    editingBuyPieceRate !== undefined ||
    editingInvitePieceRate !== undefined ||
    editingTransferPieceRate !== undefined ||
    editingSinglePieceRate !== undefined ||
    editingPieceRates !== undefined ||
    editingBaseSalary !== undefined ||
    editingSocialSecurity !== undefined ||
    editingStartWorkMonth !== undefined ||
    editingPrefix !== undefined ||
    editingSalaryDisabled !== undefined ||
    editingPoolExclusion !== undefined ||
    editingName !== undefined ||
    editingNickname !== undefined ||
    editingBank !== undefined ||
    editingBankAccountNumber !== undefined ||
    editingRecurringItems !== undefined ||
    editingAnnualRaises !== undefined ||
    editingAnnualRaiseAmount !== undefined;

  // ค่าปัจจุบัน (รวม draft) ที่ใช้ใน annual raise section + tenure label —
  // memo เพื่อกัน buildRaiseHistory + formatTenure rerun ต่อ keystroke
  const currentStartWorkMonth =
    editingStartWorkMonth !== undefined
      ? editingStartWorkMonth
      : employee.startWorkMonth || "";
  const startWorkTenure = useMemo(
    () => formatTenure(currentStartWorkMonth),
    [currentStartWorkMonth],
  );
  const currentRaises =
    editingAnnualRaises !== undefined
      ? editingAnnualRaises
      : (employee.annualRaises ?? {});
  const currentAutoRaiseAmount =
    editingAnnualRaiseAmount !== undefined
      ? parseFloat(editingAnnualRaiseAmount) || 0
      : (employee.annualRaiseAmount ?? 0);
  const currentBaseSalary =
    editingBaseSalary !== undefined
      ? parseFloat(editingBaseSalary) || 0
      : (employee.baseSalary ?? 0);
  const raiseSource = useMemo(
    () => ({
      baseSalary: currentBaseSalary,
      startWorkMonth: currentStartWorkMonth || null,
      annualRaiseAmount: currentAutoRaiseAmount,
      annualRaises: currentRaises,
    }),
    [
      currentBaseSalary,
      currentStartWorkMonth,
      currentAutoRaiseAmount,
      currentRaises,
    ],
  );
  const effectiveBase = useMemo(
    () => getEffectiveBaseSalary(raiseSource),
    [raiseSource],
  );
  const raiseHistory = useMemo(
    () => buildRaiseHistory(raiseSource),
    [raiseSource],
  );

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
    if (editingPieceRates !== undefined) {
      // sanitize: number ≥ 0 ต่อ item id
      const cleaned: Record<string, number> = {};
      for (const [k, v] of Object.entries(editingPieceRates)) {
        const n = Number(v);
        cleaned[k] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
      await onUpdateRole(employee.id, "pieceRates", cleaned);
    }
    if (editingBonusRates !== undefined) {
      const cleaned: Record<string, number> = {};
      for (const [k, v] of Object.entries(editingBonusRates)) {
        const n = Number(v);
        cleaned[k] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
      await onUpdateRole(employee.id, "bonusRates", cleaned);
    }
    if (editingPoolItemRates !== undefined) {
      const cleaned: Record<string, number> = {};
      for (const [k, v] of Object.entries(editingPoolItemRates)) {
        const n = Number(v);
        cleaned[k] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
      await onUpdateRole(employee.id, "poolItemRates", cleaned);
    }
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
    if (editingNickname !== undefined)
      await onUpdateRole(employee.id, "nickname", editingNickname.trim());
    if (editingBank !== undefined)
      await onUpdateRole(employee.id, "bank", editingBank);
    if (editingBankAccountNumber !== undefined)
      // sanitize: เก็บเฉพาะตัวเลข/space/ขีด ตาม firestore.rules regex
      await onUpdateRole(
        employee.id,
        "bankAccountNumber",
        editingBankAccountNumber.replace(/[^0-9\- ]/g, ""),
      );
    if (editingRecurringItems !== undefined) {
      // sanitize: ตัด trailing space ใน label + แปลง amount เป็น number
      const cleaned = editingRecurringItems
        .map((it) => ({
          ...it,
          label: (it.label || "").trim(),
          amount: Number(it.amount) || 0,
        }))
        .filter((it) => it.label || it.amount > 0); // ทิ้งรายการว่าง
      await onUpdateRole(employee.id, "recurringItems", cleaned);
    }
    if (editingAnnualRaiseAmount !== undefined) {
      const v = parseFloat(editingAnnualRaiseAmount);
      await onUpdateRole(
        employee.id,
        "annualRaiseAmount",
        Number.isFinite(v) && v >= 0 ? v : 0,
      );
    }
    if (editingAnnualRaises !== undefined) {
      // sanitize: filter undefined keys + force numeric values · เก็บ 0 ไว้
      // (admin override "ไม่ขึ้น" สำหรับปีนั้น) เป็น explicit record
      const cleaned: Record<string, number> = {};
      for (const [year, amount] of Object.entries(editingAnnualRaises)) {
        const yr = parseInt(year, 10);
        const amt = Number(amount);
        if (Number.isFinite(yr) && Number.isFinite(amt) && amt >= 0) {
          cleaned[String(yr)] = amt;
        }
      }
      await onUpdateRole(employee.id, "annualRaises", cleaned);
    }
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
      {/* Tab switcher — เปิดมาเจอ "ข้อมูลส่วนตัว" เป็น default */}
      <div className="px-4 pt-3 pb-2 bg-cream border-b border-bdr flex gap-2">
        <TabButton
          active={activeTab === "personal"}
          onClick={() => setActiveTab("personal")}
          icon={IconUser}
        >
          ข้อมูลส่วนตัว
        </TabButton>
        <TabButton
          active={activeTab === "salary"}
          onClick={() => setActiveTab("salary")}
          icon={IconCircleDollarSign}
        >
          เงินเดือน
        </TabButton>
      </div>
      <div className="px-4 py-3.5">
        {activeTab === "personal" && (
          <>
            {/* Name + prefix — editable */}
            <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
              <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5 flex-wrap">
                <IconPencil
                  size={12}
                  strokeWidth={2.4}
                  className="inline mr-1 -mt-px"
                />
                ชื่อพนักงาน (คำนำหน้า + ชื่อ)
                <span className="font-normal text-txt-soft">
                  (คำนำหน้าใช้ในหนังสือรับรองเงินเดือน)
                </span>
              </label>
              <div className="flex gap-2">
                <div className="relative shrink-0 w-[110px]">
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
                    className={`appearance-none cursor-pointer w-full py-[9px] pl-2.5 pr-7 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${editingPrefix !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                  >
                    <option value="นางสาว">นางสาว</option>
                    <option value="นาง">นาง</option>
                    <option value="นาย">นาย</option>
                  </select>
                  <IconChevronDown
                    size={12}
                    strokeWidth={2.4}
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
                  />
                </div>
                <input
                  type="text"
                  value={
                    editingName !== undefined ? editingName : employee.name
                  }
                  onChange={(e) =>
                    setEditingRole((previousEditingRole) => ({
                      ...previousEditingRole,
                      [`${employee.id}:name`]: e.target.value,
                    }))
                  }
                  className={`flex-1 min-w-0 py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${editingName !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                />
              </div>
              {/* Nickname — แสดงในปฏิทินการลา + รายการลา + แจ้งเตือน LINE */}
              <div className="mt-2.5">
                <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
                  ชื่อเล่น
                  <span className="font-normal text-txt-soft">
                    (ใช้แสดงในแอปทั้งฝั่งพนักงาน + ADMIN และแจ้งเตือน LINE)
                  </span>
                </label>
                <input
                  type="text"
                  value={
                    editingNickname !== undefined
                      ? editingNickname
                      : employee.nickname || ""
                  }
                  onChange={(e) =>
                    setEditingRole((previousEditingRole) => ({
                      ...previousEditingRole,
                      [`${employee.id}:nickname`]: e.target.value,
                    }))
                  }
                  placeholder="เช่น พี่หมู, น้องนุ่น"
                  className={`w-full py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${editingNickname !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                />
              </div>
            </div>
            {/* Role — read-only (แก้จากแท็บ "ตำแหน่ง") */}
            <div className="mb-2.5 px-3 py-2.5 bg-cream rounded-[10px] border border-dashed border-bdr">
              <div className="text-xs text-txt-soft font-semibold mb-[5px] flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1">
                  <IconUser size={12} strokeWidth={2.4} />
                  ตำแหน่ง
                </span>
                <span className="text-xs px-1.5 py-px rounded-lg bg-gold-pale text-maroon font-bold ml-auto">
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
            {/* Bank info — admin override
                 (พนักงานกรอกเองตอน setup ครั้งแรก · admin แก้ภายหลังได้ที่นี่) */}
            <div className="mb-3">
              <div className="text-xs text-txt-soft font-semibold mb-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1">
                  <IconBuildingBank size={12} strokeWidth={2.4} />
                  บัญชีรับเงินเดือน
                </span>
                <span className="text-xs px-1.5 py-px rounded-lg bg-green-lt text-green font-bold ml-auto">
                  ADMIN แก้ไขได้
                </span>
              </div>
              <div className="mb-1.5">
                <BankPicker
                  value={
                    editingBank !== undefined
                      ? editingBank
                      : employee.bank || ""
                  }
                  onChange={(name) =>
                    setEditingRole((previousEditingRole) => ({
                      ...previousEditingRole,
                      [`${employee.id}:bank`]: name,
                    }))
                  }
                  placeholder="— เลือกธนาคาร —"
                />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={
                  editingBankAccountNumber !== undefined
                    ? editingBankAccountNumber
                    : employee.bankAccountNumber || ""
                }
                onChange={(e) => {
                  // sanitize + จำกัด digit count ตามธนาคารที่เลือก (ห้ามเกิน)
                  const cleaned = e.target.value.replace(/[^0-9\- ]/g, "");
                  const digitsOnly = cleaned.replace(/[^0-9]/g, "");
                  if (digitsOnly.length > bankDigitLimit) return;
                  setEditingRole((previousEditingRole) => ({
                    ...previousEditingRole,
                    [`${employee.id}:bankAccountNumber`]: cleaned,
                  }));
                }}
                placeholder="เลขที่บัญชี"
                className={`w-full py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[Prompt,monospace] tracking-wider text-txt border-[1.5px] ${bankAccountIncomplete ? "border-amber bg-white" : editingBankAccountNumber !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
              />
              {bankAccountIncomplete ? (
                <div className="text-[11px] text-amber font-semibold mt-1 px-1 inline-flex items-center gap-1">
                  <IconAlertTriangle size={11} strokeWidth={2.4} />
                  ขาดอีก {bankDigitLimit - bankAccountDigitsTyped} หลัก —{" "}
                  {currentBank} ใช้เลขบัญชี {bankDigitLimit} หลัก
                </div>
              ) : currentBank ? (
                <div className="text-[11px] text-txt-soft mt-1 px-1">
                  {currentBank} ใช้เลขบัญชี {bankDigitLimit} หลัก
                </div>
              ) : null}
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

            {/* Start work month — ใช้ในหนังสือรับรองเงินเดือน */}
            <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
              <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5 flex-wrap">
                <IconCalendar size={12} strokeWidth={2.4} />
                วันที่เริ่มงาน
                {startWorkTenure && (
                  <span className="font-normal text-txt-soft">
                    ({startWorkTenure})
                  </span>
                )}
                <span className="font-normal text-txt-soft">
                  (ใช้ในหนังสือรับรองเงินเดือน)
                </span>
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
                    [`${employee.id}:startWorkMonth`]:
                      y && m ? `${y}-${m}` : "",
                  }));
                const dirtyCls =
                  editingStartWorkMonth !== undefined
                    ? "border-gold bg-white"
                    : "border-bdr bg-cream";
                return (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={curMonth}
                        onChange={(e) =>
                          setYM(curYear || String(nowYear), e.target.value)
                        }
                        className={`appearance-none cursor-pointer w-full py-[9px] pl-3 pr-7 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${dirtyCls}`}
                      >
                        <option value="">เดือน</option>
                        {thaiMonths.map((mn, i) => (
                          <option
                            key={mn}
                            value={String(i + 1).padStart(2, "0")}
                          >
                            {mn}
                          </option>
                        ))}
                      </select>
                      <IconChevronDown
                        size={12}
                        strokeWidth={2.4}
                        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
                      />
                    </div>
                    <div className="relative flex-1">
                      <select
                        value={curYear}
                        onChange={(e) =>
                          setYM(e.target.value, curMonth || "01")
                        }
                        className={`appearance-none cursor-pointer w-full py-[9px] pl-3 pr-7 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${dirtyCls}`}
                      >
                        <option value="">ปี (พ.ศ.)</option>
                        {years.map((y) => (
                          <option key={y} value={String(y)}>
                            {y + 543}
                          </option>
                        ))}
                      </select>
                      <IconChevronDown
                        size={12}
                        strokeWidth={2.4}
                        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
        {activeTab === "salary" && (
          <>
            {/* Base Salary */}
            <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
              <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
                <IconBriefcase
                  size={12}
                  strokeWidth={2.4}
                  className="inline mr-1 -mt-px"
                />
                เงินเดือนพื้นฐานเริ่มต้น
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
              <div className="text-xs text-txt-soft mt-[3px]">
                หน่วย: บาท/เดือน
              </div>
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

            {/* Annual Raises — การขึ้นเงินเดือนประจำปี (extracted component) */}
            <AnnualRaiseSection
              startWorkMonth={currentStartWorkMonth}
              effectiveBase={effectiveBase}
              history={raiseHistory}
              currentRaises={currentRaises}
              draftAutoAmount={editingAnnualRaiseAmount}
              savedAutoAmount={employee.annualRaiseAmount ?? ""}
              draftRaises={editingAnnualRaises}
              onChangeAutoAmount={(raw) =>
                setEditingRole((prev) => ({
                  ...prev,
                  [`${employee.id}:annualRaiseAmount`]: raw,
                }))
              }
              onChangeRaises={(next) =>
                setEditingRole((prev) => ({
                  ...prev,
                  [`${employee.id}:annualRaises`]: next,
                }))
              }
            />

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
                        ไม่นับเข้าระบบเงินเดือน/กองกลาง · ใช้ได้แค่ระบบลา
                      </div>
                    </div>
                  </label>
                </div>
              );
            })()}

            {/* Commission rates per piece */}
            {(() => {
              // ไม่มี piece commission (poolGroup ว่าง + pieceLabel ว่าง) → ซ่อน
              // ส่วนนี้ทั้งหมด · พนักงานทั่วไป/รปภ/ทำความสะอาด ได้แค่เงินเดือนพื้นฐาน
              if (!rolePaysPieceCommission(employeeRole)) return null;
              const usesSinglePieceRate =
                employeeRole && !employeeRole.poolGroup;
              if (usesSinglePieceRate) {
                const pieceItems = rolePieceItems(employeeRole);
                // ค่า rate ปัจจุบันของ item (draft → live pieceRates → legacy
                // singlePieceRate สำหรับ id "default")
                const rateValue = (itemId: string): number | "" => {
                  if (
                    editingPieceRates &&
                    editingPieceRates[itemId] !== undefined
                  )
                    return editingPieceRates[itemId];
                  const live = employee.pieceRates?.[itemId];
                  if (live !== undefined) return live;
                  if (itemId === LEGACY_PIECE_ITEM_ID)
                    return employee.singlePieceRate ?? "";
                  return "";
                };
                // เช็คว่า role ใช้ legacy "default" id ไหม (migrate-on-read)
                // ถ้าใช่ → seed singlePieceRate เข้า map ตอนเริ่มแก้ · ถ้าไม่ใช่
                // → ไม่ seed (กัน dead "default" entry ใน pieceRates ของ role ใหม่)
                const roleUsesLegacyDefault = pieceItems.some(
                  (it) => it.id === LEGACY_PIECE_ITEM_ID,
                );
                const setRate = (itemId: string, raw: string) =>
                  setEditingRole((prev) => {
                    const base =
                      (prev[`${employee.id}:pieceRates`] as
                        | Record<string, number>
                        | undefined) ??
                      employee.pieceRates ??
                      (roleUsesLegacyDefault && employee.singlePieceRate != null
                        ? { [LEGACY_PIECE_ITEM_ID]: employee.singlePieceRate }
                        : {});
                    return {
                      ...prev,
                      [`${employee.id}:pieceRates`]: {
                        ...base,
                        [itemId]: parseFloat(raw) || 0,
                      },
                    };
                  });
                return (
                  <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                    <div className="text-sm font-bold text-maroon mb-2">
                      <IconCircleDollarSign
                        size={12}
                        strokeWidth={2.4}
                        className="inline mr-1 -mt-px"
                      />
                      Rate ค่าคอมต่อชิ้น (฿/ชิ้น)
                    </div>
                    <div className="flex flex-col gap-2">
                      {pieceItems.map((item) => (
                        <div key={item.id}>
                          <label className="text-xs text-txt-soft font-semibold mb-1 block">
                            <IconPackage
                              size={12}
                              strokeWidth={2.4}
                              className="inline mr-1 -mt-px"
                            />
                            {item.label}
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={rateValue(item.id)}
                            onChange={(e) => setRate(item.id, e.target.value)}
                            className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingPieceRates?.[item.id] !== undefined ? "border-gold" : "border-bdr"}`}
                          />
                        </div>
                      ))}
                    </div>

                  </div>
                );
              }
              return (
                <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                  {/* Per-item Pool Exclusion + Rates (Phase 2) ────────────
                       UI: radio 3 mode (ไม่ปิด · ปิดบางรายการ · ปิดทั้งหมด)
                       + checkbox per pool item ตอน mode="ปิดบางรายการ"
                       + rates loop ตาม pool items ของ role */}
                  {employeeRole?.poolGroup &&
                    (() => {
                      const poolItems = rolePoolItems(employeeRole);
                      // currentExclusion: live state · array | "all" | "" | null
                      const liveExclusion =
                        editingPoolExclusion !== undefined
                          ? editingPoolExclusion
                          : employee.poolExclusion ?? "";
                      // resolve display mode จาก liveExclusion variant
                      const mode: "none" | "some" | "all" = (() => {
                        if (
                          !liveExclusion ||
                          (Array.isArray(liveExclusion) &&
                            liveExclusion.length === 0)
                        )
                          return "none";
                        if (
                          liveExclusion === "all" ||
                          liveExclusion === "both"
                        )
                          return "all";
                        // legacy "sell"/"buy" → ตีความเป็น some + selected ids
                        return "some";
                      })();
                      // resolve excluded ids (สำหรับ checkboxes)
                      const excludedIds = new Set<string>();
                      if (Array.isArray(liveExclusion)) {
                        liveExclusion.forEach((id) => excludedIds.add(id));
                      } else if (liveExclusion === "sell") {
                        ["normal", "special"].forEach((id) => excludedIds.add(id));
                      } else if (liveExclusion === "buy") {
                        excludedIds.add("buy");
                      }
                      const setExclusion = (next: any) =>
                        setEditingRole((prev) => ({
                          ...prev,
                          [`${employee.id}:poolExclusion`]: next,
                        }));
                      return (
                        <div
                          className={`px-3 py-2.5 rounded-[9px] mb-2.5 border-[1.5px] ${mode !== "none" ? "bg-[#FDECEA80] border-[#C0392B50]" : "bg-cream border-bdr"}`}
                        >
                          <div
                            className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${mode !== "none" ? "text-red" : "text-txt"}`}
                          >
                            <IconBan
                              size={14}
                              strokeWidth={2.4}
                              className="inline mr-1 -mt-px"
                            />
                            ปิดสิทธิ์ค่าคอมกองกลาง
                          </div>
                          {/* 3 radio modes */}
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="radio"
                                name={`poolExclusion_${employee.id}`}
                                checked={mode === "none"}
                                onChange={() => setExclusion("")}
                                className="accent-green cursor-pointer"
                              />
                              <span className={mode === "none" ? "text-green font-bold" : "text-txt"}>
                                ไม่ปิด
                              </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="radio"
                                name={`poolExclusion_${employee.id}`}
                                checked={mode === "some"}
                                onChange={() =>
                                  setExclusion(
                                    excludedIds.size > 0
                                      ? [...excludedIds]
                                      : [],
                                  )
                                }
                                className="accent-red cursor-pointer"
                              />
                              <span className={mode === "some" ? "text-red font-bold" : "text-txt"}>
                                ปิดเฉพาะรายการ
                              </span>
                            </label>
                            {mode === "some" && (
                              <div className="pl-6 flex flex-col gap-0.5 mb-1">
                                {poolItems.map((it) => (
                                  <label
                                    key={it.id}
                                    className="flex items-center gap-1.5 cursor-pointer text-xs"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={excludedIds.has(it.id)}
                                      onChange={(ev) => {
                                        const next = new Set(excludedIds);
                                        if (ev.target.checked) next.add(it.id);
                                        else next.delete(it.id);
                                        setExclusion([...next]);
                                      }}
                                      className="accent-red cursor-pointer"
                                    />
                                    <span>{it.label}</span>
                                    {it.kind === "personal" && (
                                      <span className="text-[10px] text-txt-soft">
                                        (ไม่แชร์กองกลาง)
                                      </span>
                                    )}
                                  </label>
                                ))}
                              </div>
                            )}
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="radio"
                                name={`poolExclusion_${employee.id}`}
                                checked={mode === "all"}
                                onChange={() => setExclusion("all")}
                                className="accent-red cursor-pointer"
                              />
                              <span className={mode === "all" ? "text-red font-bold" : "text-txt"}>
                                ปิดทั้งหมด
                              </span>
                            </label>
                            {mode === "all" && (
                              <div className="pl-6 text-[11px] text-txt-soft leading-relaxed">
                                ไม่ได้กองกลางทั้งหมด · ถ้า primary item
                                ({rolePrimaryPoolItemId(employeeRole)}) &lt; 50% ของ top → ไม่ได้เงินเดือนพื้นฐาน
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                  {/* Per-item Pool Rate (loop ตาม role.poolItems) */}
                  {employeeRole?.poolGroup && (
                    <>
                      <div className="text-sm font-bold text-maroon mb-2">
                        <IconCircleDollarSign
                          size={12}
                          strokeWidth={2.4}
                          className="inline mr-1 -mt-px"
                        />
                        Rate ค่าคอมต่อชิ้น (฿/ชิ้น)
                      </div>
                      <div className="flex flex-col gap-2 mb-2.5">
                        {rolePoolItems(employeeRole).map((it) => {
                          const valueOf = (): number | "" => {
                            if (
                              editingPoolItemRates &&
                              editingPoolItemRates[it.id] !== undefined
                            )
                              return editingPoolItemRates[it.id];
                            const live = employee.poolItemRates?.[it.id];
                            if (live !== undefined) return live;
                            // legacy fallback (กรณี data จากก่อน Phase 1A)
                            if (it.id === "normal")
                              return employee.normalSalePieceRate ?? "";
                            if (it.id === "special")
                              return employee.specialSalePieceRate ?? "";
                            if (it.id === "buy")
                              return employee.buyPieceRate ?? "";
                            return "";
                          };
                          const setRate = (raw: string) =>
                            setEditingRole((prev) => {
                              const base =
                                (prev[`${employee.id}:poolItemRates`] as
                                  | Record<string, number>
                                  | undefined) ??
                                employee.poolItemRates ??
                                {};
                              return {
                                ...prev,
                                [`${employee.id}:poolItemRates`]: {
                                  ...base,
                                  [it.id]: parseFloat(raw) || 0,
                                },
                              };
                            });
                          return (
                            <div
                              key={it.id}
                              className="flex items-center gap-2"
                            >
                              <label className="text-sm font-semibold text-txt min-w-[100px]">
                                {it.label}
                                {it.kind === "personal" && (
                                  <span className="text-[10px] text-txt-soft ml-1">
                                    (ไม่แชร์กองกลาง)
                                  </span>
                                )}
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                value={valueOf()}
                                onChange={(ev) => setRate(ev.target.value)}
                                className={`flex-1 px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingPoolItemRates?.[it.id] !== undefined ? "border-gold" : "border-bdr"}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Rate โบนัสอื่นๆ (multi-item) — standalone · ไม่ผูก piece commission
                ตำแหน่งที่ "ไม่มีค่าคอม แต่มีโบนัส" ก็เห็น section นี้ */}
            {(() => {
              const bonusItems = roleBonusItems(employeeRole);
              if (bonusItems.length === 0) return null;
              const bonusRateValue = (itemId: string): number | "" => {
                if (
                  editingBonusRates &&
                  editingBonusRates[itemId] !== undefined
                )
                  return editingBonusRates[itemId];
                const live = employee.bonusRates?.[itemId];
                if (live !== undefined) return live;
                if (itemId === "invite")
                  return employee.invitePieceRate ?? "";
                if (itemId === "transfer")
                  return employee.transferPieceRate ?? "";
                return "";
              };
              const setBonusRate = (itemId: string, raw: string) =>
                setEditingRole((prev) => {
                  const base =
                    (prev[`${employee.id}:bonusRates`] as
                      | Record<string, number>
                      | undefined) ??
                    employee.bonusRates ??
                    {};
                  return {
                    ...prev,
                    [`${employee.id}:bonusRates`]: {
                      ...base,
                      [itemId]: parseFloat(raw) || 0,
                    },
                  };
                });
              return (
                <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                  <div className="text-sm font-bold text-maroon mb-2">
                    <IconTicket
                      size={12}
                      strokeWidth={2.4}
                      className="inline mr-1 -mt-px"
                    />
                    Rate โบนัสอื่นๆ (฿/ครั้ง)
                  </div>
                  <div className="flex flex-col gap-2">
                    {bonusItems.map((item) => (
                      <div key={item.id}>
                        <label className="text-xs text-txt-soft font-semibold mb-1 block">
                          <IconTicket
                            size={12}
                            strokeWidth={2.4}
                            className="inline mr-1 -mt-px"
                          />
                          {item.label}
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={bonusRateValue(item.id)}
                          onChange={(e) => setBonusRate(item.id, e.target.value)}
                          className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingBonusRates?.[item.id] !== undefined ? "border-gold" : "border-bdr"}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <RecurringItemsEditor
              items={
                editingRecurringItems !== undefined
                  ? editingRecurringItems
                  : employee.recurringItems || []
              }
              onChange={(next) =>
                setEditingRole((previousEditingRole) => ({
                  ...previousEditingRole,
                  [`${employee.id}:recurringItems`]: next,
                }))
              }
            />
          </>
        )}
      </div>
      <div className="sticky bottom-0 z-10 bg-white px-4 py-3 border-t border-bdr shadow-[0_-8px_20px_rgba(90,30,10,0.06)]">
        {dirty ? (
          <div className="flex gap-2">
            <button
              onClick={() => cancelAll(true)}
              className="basis-[34%] shrink-0 py-3.5 rounded-2xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
            >
              ยกเลิก
            </button>
            <button
              onClick={saveAll}
              className="flex-1 py-3.5 rounded-2xl border-none bg-maroon text-white text-base font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-2 shadow-maroon-glow"
            >
              <IconCheck size={16} strokeWidth={2.5} />
              บันทึก
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
              className="flex-1 py-[11px] rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
            >
              ปิด
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

/* ─── Section header — divider + title ของแต่ละกลุ่ม field ─── */
/* ─── Tab button — switch view ระหว่าง "ข้อมูลส่วนตัว" / "เงินเดือน" ─── */
function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-semibold cursor-pointer font-[inherit] transition-colors border-[1.5px] ${
        active
          ? "bg-maroon text-white border-maroon shadow-[0_3px_10px_rgba(123,28,28,0.25)]"
          : "bg-white text-txt-mid border-bdr"
      }`}
    >
      <Icon size={14} strokeWidth={2.4} />
      {children}
    </button>
  );
}
