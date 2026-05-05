import { IconClock } from "@tabler/icons-react";
import { TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";

/* ─── Advance History Modal ────────────────────────────────────── */
export default function AdvanceHistoryModal({ advanceRequests, onClose }) {
  const list = [...(advanceRequests || [])].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  // group by month
  const grouped = {};
  list.forEach((r) => {
    const key = r.month || r.submittedAt.slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  const months = Object.keys(grouped).sort().reverse();

  const sMap = {
    pending: { cls: "bg-amber-lt text-amber", label: "รออนุมัติ", icon: "⏳" },
    approved: {
      cls: "bg-green-lt text-green",
      label: "อนุมัติ • โอนแล้ว",
      icon: "✅",
    },
    rejected: { cls: "bg-red-lt text-red", label: "ไม่อนุมัติ", icon: "❌" },
  };

  return (
    <div className="fixed inset-0 z-800 flex items-end justify-center bg-[rgba(45,26,14,0.65)] backdrop-blur-[6px]">
      <div className="bg-white rounded-t-3xl px-5.5 pt-6 pb-7 w-full max-w-[430px] shadow-[0_-12px_40px_rgba(45,26,14,0.25)] animate-[slideUp_0.3s_cubic-bezier(.22,.68,0,1.1)] max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-sm bg-bdr mx-auto mb-4" />

        <div className="flex items-center gap-3 mb-4.5">
          <div className="w-[46px] h-[46px] rounded-xl bg-gold-pale flex items-center justify-center border border-gold/25">
            <IconClock size={22} color="var(--color-maroon)" stroke={2.2} />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-lg text-txt">ประวัติการเบิก</div>
            <div className="text-xs text-txt-soft mt-0.5">
              คำขอเบิกเงินล่วงหน้าทั้งหมด
            </div>
          </div>
        </div>

        {list.length === 0 && (
          <div className="text-center text-txt-soft py-10 text-[15px]">
            <div className="text-[42px] mb-3">📭</div>
            ยังไม่มีประวัติการเบิก
          </div>
        )}

        {months.map((m) => {
          const [y, mo] = m.split("-");
          const monthLabel = `${TH_MONTHS[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
          const monthList = grouped[m];
          const monthTotal = monthList
            .filter((r) => r.status === "approved")
            .reduce((s, r) => s + r.amount, 0);
          return (
            <div key={m} className="mb-4.5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[13px] font-bold text-maroon">
                  {monthLabel}
                </div>
                {monthTotal > 0 && (
                  <div className="text-[11px] text-txt-soft">
                    เบิกแล้ว{" "}
                    <b className="text-green">฿{TH_NUMBER(monthTotal)}</b>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {monthList.map((r) => {
                  const s = sMap[r.status] || sMap.pending;
                  const dt = new Date(r.submittedAt);
                  return (
                    <div
                      key={r.id}
                      className="px-3.5 py-3 bg-cream rounded-xl border border-bdr"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-lg font-extrabold text-txt">
                          ฿{TH_NUMBER(r.amount)}
                        </div>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}
                        >
                          {s.icon} {s.label}
                        </span>
                      </div>
                      <div className="text-xs text-txt-mid mb-1 leading-normal">
                        {r.reason}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-txt-soft">
                          📅{" "}
                          {dt.toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {r.slipImg && (
                          <button
                            onClick={() => {
                              const w = window.open("", "_blank");
                              if (w) {
                                w.document.write(
                                  `<img src="${r.slipImg}" style="max-width:100%"/>`,
                                );
                              }
                            }}
                            className="px-3 py-1 rounded-lg border border-gold/40 bg-gold-pale text-maroon text-[11px] font-semibold cursor-pointer font-[inherit]"
                          >
                            📄 ดูสลิป
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
          className="w-full p-3.5 mt-2 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-[15px] font-semibold cursor-pointer font-[inherit]"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
