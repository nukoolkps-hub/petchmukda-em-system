/* ─── ประวัติเงินกู้ในการ์ด — กู้เมื่อไหร่ เท่าไร + หักไปเดือนไหนบ้าง ───── */
import {
  ChevronDown as IconChevronDown,
  CircleCheck as IconCircleCheck,
  HandCoins as IconHandCoins,
  Plus as IconPlus,
  Receipt as IconReceipt,
  Trash2 as IconTrash,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatThaiNumber } from "../../utils/format";
import {
  latestTopUp,
  loanHistory,
  loanRepaymentHistory,
  topUpMonthlyChange,
  topUpUndoBlocker,
} from "../../utils/loanTopUp";
import { isoDateLabel, monthLabel, monthShortLabel } from "./loanFormat";

export default function LoanHistoryList({
  loan,
  open,
  onToggle,
  onViewSlip,
  action,
  onUndoTopUp,
}: {
  loan: any;
  open: boolean;
  onToggle: () => void;
  onViewSlip: (url: string) => void;
  /** ปุ่มฝั่งขวาของแถวหัว (เช่น "เพิ่มเงินกู้") · ประวัติที่กางลงมากว้างเต็มการ์ด */
  action?: ReactNode;
  /** ลบการกู้เพิ่มครั้งล่าสุด (เปิด dialog ยืนยัน) · ไม่ส่ง = ไม่มีปุ่ม */
  onUndoTopUp?: (topUpId: string) => void;
}) {
  const history = loanHistory(loan);
  // ลบได้เฉพาะครั้งล่าสุด · เหตุผลที่ลบไม่ได้โชว์แทนปุ่ม (ไม่ซ่อนเงียบ)
  const latestId = latestTopUp(loan)?.id;
  const undoBlocker = latestId ? topUpUndoBlocker(loan) : "";
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
          ประวัติการกู้ ({history.filter((h) => h.kind !== "paidoff").length} ครั้ง)
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
          {history.map((h, i) =>
            h.kind === "paidoff" ? (
              <div
                key={`paidoff-${h.effectiveMonth}-${i}`}
                className="flex items-center gap-2.5 bg-green-lt rounded-[10px] px-3 py-2"
              >
                <div className="w-7 h-7 shrink-0 rounded-full bg-white/70 flex items-center justify-center">
                  <IconCircleCheck
                    size={15}
                    className="text-green"
                    strokeWidth={2.4}
                  />
                </div>
                <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-green">
                    ผ่อนครบ {monthLabel(h.effectiveMonth)}
                  </span>
                  <span className="text-xs text-txt-mid shrink-0">
                    ยอดกู้รวม {formatThaiNumber(h.amount)} ฿
                  </span>
                </div>
              </div>
            ) : (
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
                    <div>เริ่มหัก {monthLabel(h.effectiveMonth)}</div>
                    <div>
                      <MonthlyLine
                        kind={h.kind}
                        prev={h.prevMonthlyDeduction ?? h.monthlyDeduction}
                        next={h.monthlyDeduction}
                      />
                    </div>
                    {h.kind === "topup" && (
                      <div>ยอดกู้รวม {formatThaiNumber(h.totalAfter)} ฿</div>
                    )}
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
                  {onUndoTopUp && h.topUpId && h.topUpId === latestId && (
                    <div className="mt-1.5 pt-1.5 border-t border-bdr/60">
                      {undoBlocker ? (
                        <span className="text-[11px] text-txt-soft">
                          {undoBlocker}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUndoTopUp(h.topUpId as string)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red bg-transparent border-none cursor-pointer font-[inherit] p-0"
                        >
                          <IconTrash size={12} strokeWidth={2.4} />
                          ลบรายการกู้เพิ่มนี้
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

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

/** บรรทัดยอดผ่อน — กู้เพิ่มบอก "เพิ่มเท่าไร → รวมเท่าไร" ไม่ใช่แค่ "500 → 700" */
function MonthlyLine({
  kind,
  prev,
  next,
}: {
  kind: string;
  prev: number;
  next: number;
}) {
  if (kind !== "topup") return <>ผ่อนเดือนละ {formatThaiNumber(next)} ฿</>;
  const c = topUpMonthlyChange(prev, next);
  if (c.kind === "same")
    return <>ผ่อนเท่าเดิม เดือนละ {formatThaiNumber(c.total)} ฿</>;
  return (
    <>
      {c.kind === "up" ? "ผ่อนเพิ่ม" : "ผ่อนลด"}{" "}
      <b className="text-maroon">
        {c.kind === "up" ? "+" : "−"}
        {formatThaiNumber(c.delta)} ฿
      </b>
      /เดือน → {c.kind === "up" ? "รวม" : "เหลือ"}เดือนละ{" "}
      <b className="text-maroon">{formatThaiNumber(c.total)} ฿</b>
    </>
  );
}
