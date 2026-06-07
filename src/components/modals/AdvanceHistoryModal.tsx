import {
  CalendarDays as IconCalendar,
  CircleCheck as IconCircleCheck,
  Clock as IconClock,
  FileText as IconFileText,
  Inbox as IconInbox,
  XCircle as IconXCircle,
} from "lucide-react";
import { THAI_MONTH_NAMES } from "../../constants";
import { formatThaiNumber } from "../../utils/format";
import BaseModal from "../shared/BaseModal";

/* ─── Advance History Modal ────────────────────────────────────── */
export default function AdvanceHistoryModal({
  advanceRequests,
  monthLabel,
  onClose,
}: {
  advanceRequests: any[];
  monthLabel?: string;
  onClose: () => void;
}) {
  const list = [...(advanceRequests || [])].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  // group by month
  const grouped: Record<string, any[]> = {};
  list.forEach((r) => {
    const key = r.month || r.submittedAt.slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  const months = Object.keys(grouped).sort().reverse();

  const sMap = {
    pending: {
      cls: "bg-amber-lt text-amber",
      label: "รออนุมัติ",
      Icon: IconClock,
    },
    approved: {
      cls: "bg-green-lt text-green",
      label: "อนุมัติ • โอนแล้ว",
      Icon: IconCircleCheck,
    },
    rejected: {
      cls: "bg-red-lt text-red",
      label: "ไม่อนุมัติ",
      Icon: IconXCircle,
    },
  };

  return (
    <BaseModal onClose={onClose} contentClassName="px-5.5 pt-6 pb-7">
      <div className="flex items-center gap-3 mb-4.5">
        <div className="w-[46px] h-[46px] rounded-xl bg-gold-pale flex items-center justify-center border border-gold/25">
          <IconClock size={22} color="var(--color-maroon)" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-lg text-txt">ประวัติการเบิก</div>
          <div className="text-sm text-txt-soft mt-0.5">
            {monthLabel ? `เดือน ${monthLabel}` : "คำขอเบิกเงินล่วงหน้าทั้งหมด"}
          </div>
        </div>
      </div>

      {list.length === 0 && (
        <div className="text-center text-txt-soft py-10 text-base">
          <div className="flex justify-center mb-3 text-txt-soft">
            <IconInbox size={48} strokeWidth={1.8} />
          </div>
          {monthLabel ? "ไม่มีคำขอเบิกเงินในเดือนนี้" : "ยังไม่มีประวัติการเบิก"}
        </div>
      )}

      {months.map((m) => {
        const [y, mo] = m.split("-");
        const monthLabel = `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
        const monthList = grouped[m];
        const monthTotal = monthList
          .filter((r) => r.status === "approved")
          .reduce((s, r) => s + r.amount, 0);
        return (
          <div key={m} className="mb-4.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-sm font-bold text-maroon">{monthLabel}</div>
              {monthTotal > 0 && (
                <div className="text-xs text-txt-soft">
                  เบิกแล้ว{" "}
                  <b className="text-green">฿{formatThaiNumber(monthTotal)}</b>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {monthList.map((r) => {
                const s = sMap[r.status] || sMap.pending;
                const StatusIcon = s.Icon;
                const date = new Date(r.submittedAt);
                const slipPreview = r.slipImageUrl || r.slipImageDataUrl;
                return (
                  <div
                    key={r.id}
                    className="px-3.5 py-3 bg-cream rounded-xl border border-bdr"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-lg font-extrabold text-txt">
                        ฿{formatThaiNumber(r.amount)}
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${s.cls}`}
                      >
                        <StatusIcon size={12} strokeWidth={2.4} />
                        {s.label}
                      </span>
                    </div>
                    <div className="text-sm text-txt-mid mb-1 leading-normal">
                      {r.reason}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-txt-soft flex items-center gap-1">
                        <IconCalendar size={11} strokeWidth={2.4} />
                        {date.toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {slipPreview && (
                        <button
                          onClick={() => {
                            const w = window.open("", "_blank");
                            if (w) {
                              w.document.write(
                                `<img src="${slipPreview}" style="max-width:100%"/>`,
                              );
                            }
                          }}
                          className="px-3 py-1 rounded-lg border border-gold/40 bg-gold-pale text-maroon text-xs font-semibold cursor-pointer font-[inherit] inline-flex items-center gap-1"
                        >
                          <IconFileText size={12} strokeWidth={2.4} />
                          ดูสลิป
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={onClose}
        className="w-full p-3.5 mt-2 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
      >
        ปิด
      </button>
    </BaseModal>
  );
}
