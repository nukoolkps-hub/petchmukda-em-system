/* ─── ประวัติเงินกู้ในการ์ด — กู้เมื่อไหร่ เท่าไร + หักไปเดือนไหนบ้าง ───── */
import {
  ChevronDown as IconChevronDown,
  HandCoins as IconHandCoins,
  Plus as IconPlus,
  Receipt as IconReceipt,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatThaiNumber } from "../../utils/format";
import { loanHistory, loanRepaymentHistory } from "../../utils/loanTopUp";
import { isoDateLabel, monthLabel, monthShortLabel } from "./loanFormat";

export default function LoanHistoryList({
  loan,
  open,
  onToggle,
  onViewSlip,
  action,
}: {
  loan: any;
  open: boolean;
  onToggle: () => void;
  onViewSlip: (url: string) => void;
  /** ปุ่มฝั่งขวาของแถวหัว (เช่น "เพิ่มเงินกู้") · ประวัติที่กางลงมากว้างเต็มการ์ด */
  action?: ReactNode;
}) {
  const history = loanHistory(loan);
  const repayments = loanRepaymentHistory(loan);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs font-bold text-maroon bg-transparent border-none cursor-pointer font-[inherit] px-0 py-1"
        >
          ประวัติการกู้ ({history.length} ครั้ง)
          <IconChevronDown
            size={14}
            strokeWidth={2.4}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {action}
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {history.map((h, i) => (
            <div
              key={`${h.kind}-${h.at}-${i}`}
              className="flex gap-2.5 bg-cream rounded-[10px] px-3 py-2.5"
            >
              <div className="w-7 h-7 shrink-0 rounded-full bg-maroon/10 flex items-center justify-center">
                {h.kind === "initial" ? (
                  <IconHandCoins
                    size={14}
                    className="text-maroon"
                    strokeWidth={2.2}
                  />
                ) : (
                  <IconPlus
                    size={14}
                    className="text-maroon"
                    strokeWidth={2.6}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-txt">
                    {h.kind === "initial" ? "กู้ครั้งแรก" : "กู้เพิ่ม"}{" "}
                    <span className="text-maroon">
                      {h.kind === "topup" ? "+" : ""}
                      {formatThaiNumber(h.amount)} ฿
                    </span>
                  </span>
                  <span className="text-xs text-txt-soft shrink-0">
                    {isoDateLabel(h.at)}
                  </span>
                </div>
                <div className="text-xs text-txt-mid mt-0.5 leading-relaxed">
                  เริ่มหัก {monthLabel(h.effectiveMonth)} · ผ่อนเดือนละ{" "}
                  {h.prevMonthlyDeduction != null &&
                    `${formatThaiNumber(h.prevMonthlyDeduction)} → `}
                  {formatThaiNumber(h.monthlyDeduction)} ฿
                  {h.kind === "topup" &&
                    ` · ยอดกู้รวม ${formatThaiNumber(h.totalAfter)} ฿`}
                </div>
                {(h.note || h.slipImageUrl) && (
                  <div className="flex items-center gap-2 mt-1">
                    {h.note && (
                      <span className="text-xs text-txt-soft truncate flex-1 min-w-0">
                        {h.note}
                      </span>
                    )}
                    {h.slipImageUrl && (
                      <button
                        type="button"
                        onClick={() => onViewSlip(h.slipImageUrl as string)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-maroon bg-transparent border-none cursor-pointer font-[inherit] p-0 shrink-0 ml-auto"
                      >
                        <IconReceipt size={12} strokeWidth={2.4} />
                        สลิป
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="px-1">
            <div className="text-xs font-bold text-txt-mid mb-1">
              หักจากเงินเดือนแล้ว
            </div>
            {repayments.length === 0 ? (
              <div className="text-xs text-txt-soft">ยังไม่เคยหัก</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {repayments.map((r) => (
                  <span
                    key={r.yearMonth}
                    className="text-xs bg-white border border-bdr rounded-full px-2 py-0.5 text-txt-mid"
                  >
                    {monthShortLabel(r.yearMonth)}{" "}
                    <b className="text-txt">{formatThaiNumber(r.amount)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
