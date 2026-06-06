import {
  Check as IconCheck,
  ChevronDown as IconChevronDown,
  CircleCheck as IconCircleCheck,
  CircleDollarSign as IconCircleDollarSign,
  Copy as IconCopy,
  FileText as IconFileText,
  Upload as IconUpload,
  X as IconX,
  XCircle as IconXCircle,
} from "lucide-react";
import { useState } from "react";
import { COLORS, THAI_MONTH_NAMES } from "../../constants";
import { useAdvancesByStatusAndMonth } from "../../firebase/hooks/useFirestore";
import { uploadAdvanceSlip } from "../../firebase/storage";
import { formatThaiNumber } from "../../utils/format";
import { resizeSlip } from "../../utils/imageUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BankLogo from "../shared/BankLogo";
import BaseModal from "../shared/BaseModal";

type AdvanceFilter = "pending" | "approved" | "rejected";

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function generateMonthOptions(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return months.reverse();
}

function formatMonthLabel(yearMonth) {
  const [y, mo] = String(yearMonth || "").split("-");
  const monthName = THAI_MONTH_NAMES[parseInt(mo, 10) - 1];
  if (!monthName || !y) return yearMonth;
  return `${monthName} ${parseInt(y, 10) + 543}`;
}

/* ─── Admin: Advance Requests Panel ────────────────────────────── */
export default function AdminAdvancePanel({
  advanceRequests,
  employeeDirectory,
  onUpdate,
  showToast,
}) {
  const [filter, setFilter] = useState<AdvanceFilter>("pending");
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);
  const [confirmReject, setConfirmReject] = useState<any>(null);
  const [copiedAcc, setCopiedAcc] = useState<string | null>(null); // request.id ที่เพิ่งกด copy
  const [uploadingSlip, setUploadingSlip] = useState<string | number | null>(
    null,
  );
  const monthScopedResult = useAdvancesByStatusAndMonth({
    status: filter === "pending" ? null : filter,
    yearMonth: selectedMonth,
    enabled: filter !== "pending",
  });

  function copyToClipboard(text, reqId) {
    if (!text) return;
    const cleaned = String(text).replace(/[-\s]/g, "");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(cleaned)
        .then(() => {
          setCopiedAcc(reqId);
          setTimeout(() => setCopiedAcc(null), 1500);
        })
        .catch(() => {});
    } else {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = cleaned;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedAcc(reqId);
        setTimeout(() => setCopiedAcc(null), 1500);
      } catch (_e) {}
      document.body.removeChild(ta);
    }
  }

  const pendingRequests = (advanceRequests || []).filter(
    (r) => r.status === "pending",
  );
  const activeRequests =
    filter === "pending" ? pendingRequests : monthScopedResult.data || [];
  const filtered = [...activeRequests].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  const showMonthFilter = filter !== "pending";
  const loading = showMonthFilter && monthScopedResult.loading;
  const error = showMonthFilter ? monthScopedResult.error : null;

  async function handleApproveSlip(request, file) {
    setUploadingSlip(request.id);
    try {
      const dataUrl = await resizeSlip(file);
      const slipImageUrl = await uploadAdvanceSlip(request.id, dataUrl);
      await onUpdate(
        request.id,
        {
          status: "approved",
          slipImageUrl,
          approvedAt: new Date().toISOString(),
        },
        request,
      );
      showToast?.("อนุมัติและส่งสลิปแล้ว");
    } catch (err) {
      console.error("[AdminAdvancePanel] upload slip failed:", err);
      showToast?.((err as Error).message || "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setUploadingSlip(null);
    }
  }

  async function handleReject(request) {
    try {
      await onUpdate(
        request.id,
        {
          status: "rejected",
          rejectedAt: new Date().toISOString(),
        },
        request,
      );
      showToast?.("ปฏิเสธคำขอแล้ว");
    } catch (err) {
      console.error("[AdminAdvancePanel] reject failed:", err);
      showToast?.("ปฏิเสธไม่สำเร็จ");
    } finally {
      setConfirmReject(null);
    }
  }

  return (
    <div>
      {/* filter chips */}
      <div className="flex gap-1.5 mb-3.5 overflow-x-auto">
        {[
          {
            id: "pending",
            label: (
              <span className="inline-flex items-center gap-1">
                <IconCircleDollarSign size={13} strokeWidth={2.4} />
                รออนุมัติ
              </span>
            ),
          },
          {
            id: "approved",
            label: (
              <span className="inline-flex items-center gap-1">
                <IconCircleCheck size={13} strokeWidth={2.4} />
                อนุมัติแล้ว
              </span>
            ),
          },
          {
            id: "rejected",
            label: (
              <span className="inline-flex items-center gap-1">
                <IconXCircle size={13} strokeWidth={2.4} />
                ไม่อนุมัติ
              </span>
            ),
          },
        ].map((f) => {
          const count = f.id === "pending" ? pendingRequests.length : 0;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as AdvanceFilter)}
              className={`px-3 py-2 rounded-[10px] cursor-pointer font-[inherit] text-sm font-semibold whitespace-nowrap border-[1.5px]
                ${filter === f.id ? "bg-maroon text-gold-lt border-maroon" : "bg-cream text-txt-mid border-bdr"}`}
            >
              {f.label}
              {count > 0 && ` (${count})`}
            </button>
          );
        })}
      </div>

      {showMonthFilter && (
        <div className="flex items-center gap-2 mb-3.5 px-3 py-2.5 bg-cream rounded-xl border border-bdr">
          <span className="text-sm font-semibold text-txt-mid whitespace-nowrap">
            เดือน
          </span>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none cursor-pointer pl-2.5 pr-7 py-[7px] rounded-[9px] border border-bdr text-sm font-semibold text-txt bg-white font-[inherit] outline-none"
            >
              {generateMonthOptions().map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
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
      )}

      {loading && (
        <div className="text-center text-txt-soft py-[50px] text-base">
          กำลังโหลดคำขอเบิก...
        </div>
      )}

      {error && (
        <div className="text-center text-red py-[50px] text-base">
          โหลดคำขอเบิกไม่สำเร็จ
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center text-txt-soft py-[50px] text-base">
          <div className="flex justify-center mb-3 text-txt-soft">
            <IconCircleDollarSign size={48} strokeWidth={1.8} />
          </div>
          ไม่มีคำขอเบิก
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-2.5">
          {filtered.map((request) => {
            const slipPreview =
              request.slipImageUrl || request.slipImageDataUrl;
            const employeeInfo =
              employeeDirectory.find((e) => e.id === request.employeeId) ||
              employeeDirectory.find((e) => e.name === request.employeeName);
            const sMap = {
              pending: {
                bg: COLORS.amberLight,
                color: COLORS.amber,
                label: "รออนุมัติ",
              },
              approved: {
                bg: COLORS.greenLight,
                color: COLORS.green,
                label: "โอนแล้ว",
              },
              rejected: {
                bg: COLORS.redLight,
                color: COLORS.red,
                label: "ไม่อนุมัติ",
              },
            };
            const s = sMap[request.status] || sMap.pending;
            const date = new Date(request.submittedAt);
            return (
              <div
                key={request.id}
                className="bg-white rounded-[14px] px-4 py-3.5 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  {employeeInfo ? (
                    <AvatarCircle
                      avatar={employeeInfo.avatar}
                      avatarType={employeeInfo.avatarType}
                      avatarImageUrl={employeeInfo.avatarImageUrl}
                      size={40}
                      fontSize={13}
                      border={`2px solid ${COLORS.gold}40`}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-white font-bold text-sm">
                      ?
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-txt text-sm">
                      {request.employeeName}
                    </div>
                    <div className="text-xs text-txt-soft">
                      {date.toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-[3px] rounded-[20px] whitespace-nowrap"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>
                </div>

                <div className="flex items-center justify-between px-3 py-2.5 bg-gold-pale rounded-[10px] mb-2.5 border border-[#C9973A30]">
                  <span className="text-sm text-txt-mid">จำนวนเงินที่ขอเบิก</span>
                  <span className="text-xl font-extrabold text-maroon">
                    ฿{formatThaiNumber(request.amount)}
                  </span>
                </div>

                <div className="text-sm text-txt-mid mb-2.5 leading-normal">
                  <span className="text-txt-soft">เหตุผล:</span> {request.reason}
                </div>

                {employeeInfo &&
                  (employeeInfo.bank || employeeInfo.bankAccountNumber) && (
                    <button
                      onClick={() =>
                        copyToClipboard(
                          employeeInfo.bankAccountNumber,
                          request.id,
                        )
                      }
                      className={`w-full text-sm mb-2.5 px-3 py-2.5 bg-cream rounded-lg cursor-pointer font-[inherit] flex items-center gap-2.5 transition-all
                    ${copiedAcc === request.id ? "border border-green" : "border border-bdr"}`}
                    >
                      <BankLogo bank={employeeInfo.bank} size={24} />
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs text-txt-soft mb-px">
                          {employeeInfo.bank || "-"}
                        </div>
                        <div className="text-sm font-bold text-txt tracking-[0.04em]">
                          {employeeInfo.bankAccountNumber || "-"}
                        </div>
                      </div>
                      <div
                        className={`flex items-center gap-[5px] px-2.5 py-[5px] rounded-[7px] text-xs font-bold whitespace-nowrap transition-all
                    ${copiedAcc === request.id ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
                      >
                        {copiedAcc === request.id ? (
                          <>
                            <IconCheck size={13} strokeWidth={3} />
                            คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <IconCopy size={13} strokeWidth={2.2} />
                            คัดลอก
                          </>
                        )}
                      </div>
                    </button>
                  )}

                {/* slip preview */}
                {slipPreview && (
                  <div className="mb-2.5">
                    <div className="text-xs text-txt-soft mb-[5px] font-semibold inline-flex items-center gap-1">
                      <IconFileText size={12} strokeWidth={2.4} />
                      สลิปการโอน
                    </div>
                    <img
                      src={slipPreview}
                      alt="slip"
                      onClick={() => {
                        const w = window.open("", "_blank");
                        if (w) {
                          w.document.write(
                            `<img src="${slipPreview}" style="max-width:100%"/>`,
                          );
                        }
                      }}
                      className="max-w-full max-h-[200px] rounded-[10px] border border-bdr cursor-pointer"
                    />
                  </div>
                )}

                {/* actions */}
                {request.status === "pending" && (
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => setConfirmReject(request)}
                      className="px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-red/25 bg-red-lt text-red text-sm font-semibold cursor-pointer font-[inherit] inline-flex items-center gap-1"
                    >
                      <IconX size={14} strokeWidth={2.4} />
                      ปฏิเสธ
                    </button>
                    <label className="flex-1 px-3.5 py-2.5 rounded-[10px] border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 shadow-[0_3px_10px_var(--color-maroon)/0.25]">
                      {uploadingSlip === request.id ? (
                        "กำลังอัปโหลด..."
                      ) : (
                        <>
                          <IconUpload size={14} strokeWidth={2.4} />
                          อัปโหลดสลิป (อนุมัติ)
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingSlip === request.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleApproveSlip(request, f);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {request.status === "approved" && !slipPreview && (
                  <label className="block px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-gold/40 bg-gold-pale text-maroon text-sm font-semibold cursor-pointer font-[inherit] text-center">
                    {uploadingSlip === request.id ? (
                      "กำลังอัปโหลด..."
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <IconUpload size={14} strokeWidth={2.4} />
                        อัปโหลดสลิปย้อนหลัง
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingSlip === request.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleApproveSlip(request, f);
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmReject && (
        <BaseModal
          onClose={() => setConfirmReject(null)}
          maxWidthClass="max-w-[340px]"
          contentClassName="px-6 py-7"
        >
          <div className="flex justify-center mb-2 text-red">
            <IconXCircle size={40} strokeWidth={2} />
          </div>
          <div className="font-bold text-lg text-txt text-center mb-1.5">
            ปฏิเสธคำขอนี้?
          </div>
          <div className="text-sm text-txt-mid text-center mb-5">
            {confirmReject.employeeName} · ฿
            {formatThaiNumber(confirmReject.amount)}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setConfirmReject(null)}
              className="flex-1 p-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => handleReject(confirmReject)}
              className="flex-1 p-3 rounded-xl border-none bg-red text-white text-sm font-bold cursor-pointer font-[inherit]"
            >
              ปฏิเสธ
            </button>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
