/* ─── RequestTab — Leave request form + history ──────────────── */

import { IconAlertCircle, IconChevronRight } from "@tabler/icons-react";
import { C, LEAVE_TYPES, TODAY } from "../../constants";
import type { LeaveEntry } from "../../types";
import { fmtDate } from "../../utils/dateUtils";
import CalendarPicker from "../shared/CalendarPicker";
import Diamond from "../shared/Diamond";
import GoldDivider from "../shared/GoldDivider";
import LeaveTypeCard from "./LeaveTypeCard";

interface RequestTabProps {
  profile: any;
  allLeaves: LeaveEntry[];
  form: { type: string; startDate: string; endDate: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ type: string; startDate: string; endDate: string }>
  >;
  errors: Record<string, string>;
  histDetail: string | number | null;
  setHistDetail: (id: string | number | null) => void;
  myLeaves: LeaveEntry[];
  balance: Record<string, number>;
  used: Record<string, number>;
  days: number;
  remain: number | null;
  overLimit: boolean;
  onSubmit: () => void;
}

export default function RequestTab({
  profile,
  allLeaves,
  form,
  setForm,
  errors,
  histDetail,
  setHistDetail,
  myLeaves,
  balance,
  used,
  days,
  remain,
  overLimit,
  onSubmit,
}: RequestTabProps) {
  /* ─── Quota status for this month ──────────────────────────── */
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const usedThisMonth = profile
    ? allLeaves.filter(
        (lv: LeaveEntry) =>
          lv.empName === profile.name && lv.start.startsWith(ym),
      ).length
    : 0;
  const rem = 2 - usedThisMonth;
  const overQuota = usedThisMonth >= 2;

  return (
    <div>
      <div className="text-center mb-0.5">
        <Diamond size={14} />
      </div>
      <GoldDivider />

      {/* quota status in form */}
      <div
        className={`rounded-xl px-4 py-3 mb-5 flex items-center gap-3 border-[1.5px] ${overQuota ? "bg-[#FEF2F2] border-[#C0392B50]" : "bg-gold-pale border-[#C9973A50]"}`}
      >
        <div className="text-[22px]">{overQuota ? "⚠️" : "📋"}</div>
        <div className="flex-1">
          <div
            className={`font-bold text-sm ${overQuota ? "text-red" : "text-maroon"}`}
          >
            {overQuota
              ? "หมดโควต้าแล้ว - การลาครั้งต่อไปจะกระทบต่อเงินเดือน"
              : `โควต้าเดือนนี้เหลือ ${rem} ครั้ง`}
          </div>
          <div className="text-xs text-txt-soft mt-0.5">
            ลากิจ + ลาป่วย รวม 2 ครั้ง/เดือน
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`text-xl font-extrabold ${overQuota ? "text-red" : "text-gold"}`}
          >
            {usedThisMonth}
          </div>
          <div className="text-[11px] text-txt-soft">/ 2 ครั้ง</div>
        </div>
      </div>

      <div className="mb-5.5">
        <div className="text-base font-bold text-txt mb-3">ประเภทการลา</div>
        <div className="grid grid-cols-2 gap-3">
          {LEAVE_TYPES.map((lt) => (
            <LeaveTypeCard
              key={lt.id}
              lt={lt}
              selected={form.type}
              onClick={() => setForm({ ...form, type: lt.id })}
              balance={balance[lt.id] || 15}
              used={used[lt.id] || 0}
            />
          ))}
        </div>
        {errors.type && (
          <div className="text-red text-[13px] mt-2">⚠ {errors.type}</div>
        )}
      </div>
      <div className="text-base font-bold text-txt mb-2">วันที่เริ่มลา</div>
      <CalendarPicker
        value={form.startDate}
        onChange={(v) =>
          setForm((f) => ({
            ...f,
            startDate: v,
            endDate: f.endDate && f.endDate < v ? "" : f.endDate,
          }))
        }
        minDate={TODAY}
        error={errors.startDate}
      />
      <div className="text-base font-bold text-txt mb-2 mt-1">วันที่สิ้นสุด</div>
      <CalendarPicker
        value={form.endDate}
        onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
        minDate={form.startDate || TODAY}
        error={errors.endDate}
      />
      {days > 0 && (
        <div
          className={`rounded-2xl p-4.5 my-3.5 flex items-center gap-4 border-[1.5px] ${overLimit ? "bg-red-lt border-[#C0392B40]" : "bg-gold-pale border-[#C9973A60]"}`}
        >
          <div
            className={`w-[50px] h-[50px] rounded-[14px] shrink-0 flex items-center justify-center ${overLimit ? "bg-[#C0392B18]" : "bg-linear-135 from-gold to-gold-lt"}`}
          >
            {overLimit ? (
              <IconAlertCircle size={22} color={C.red} stroke={2.5} />
            ) : (
              <Diamond size={22} color="#fff" />
            )}
          </div>
          <div>
            <div className="text-sm text-txt-mid mb-0.5">รวมจำนวนวันทำการ</div>
            <div
              className={`text-[28px] font-extrabold leading-[1.1] ${overLimit ? "text-red" : "text-maroon"}`}
            >
              {days}
              <span className="text-base font-semibold"> วัน</span>
            </div>
            <div
              className={`text-[13px] mt-0.5 ${overLimit ? "text-red" : "text-txt-soft"}`}
            >
              {overLimit ? `⚠ เกินสิทธิ์! คงเหลือ ${remain} วัน` : "(ไม่รวมวันเสาร์)"}
            </div>
          </div>
        </div>
      )}
      {errors.over && (
        <div className="text-red text-[13px] mx-0 mt-1 mb-2.5">
          ⚠ {errors.over}
        </div>
      )}

      <button
        onClick={onSubmit}
        className="w-full p-[17px] mt-1.5 border-none rounded-2xl text-lg font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-2.5 bg-gradient-to-br from-gold via-gold-lt to-gold text-maroon-dk shadow-[0_6px_20px_rgba(201,151,58,0.31)]"
      >
        <Diamond size={18} color={C.maroonDk} />
        ยื่นคำขอลา
      </button>

      {/* ── ประวัติการลาของฉัน ── */}
      <div className="mt-8">
        <div className="text-center mb-0.5">
          <Diamond size={14} />
        </div>
        <GoldDivider />
        <div className="text-base font-bold text-txt mb-3.5 flex items-center gap-2">
          📋 ประวัติการลาของฉัน
          <span className="text-xs text-txt-soft font-medium ml-auto">
            {myLeaves.length} รายการ
          </span>
        </div>
        {myLeaves.length === 0 && (
          <div className="text-center text-txt-soft py-7.5 text-sm bg-cream rounded-[14px] border border-dashed border-bdr">
            ยังไม่มีประวัติการลา
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {[...myLeaves]
            .sort((a, b) => b.start.localeCompare(a.start))
            .map((h) => {
              const lt = LEAVE_TYPES.find((t) => t.id === h.type);
              return (
                <div
                  key={h.id}
                  onClick={() =>
                    setHistDetail(histDetail === h.id ? null : h.id)
                  }
                  className="bg-white rounded-[14px] p-3.5 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr flex items-start gap-3 cursor-pointer"
                >
                  <div
                    className="w-10 h-10 rounded-[10px] flex items-center justify-center text-xl shrink-0"
                    style={{ background: lt?.colorLt || C.creamDk }}
                  >
                    {lt?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-txt text-[15px] mb-0.5">
                      {lt?.label}
                    </div>
                    <div className="text-[13px] text-txt-mid">
                      {fmtDate(h.start)}
                      {h.start !== h.end ? ` – ${fmtDate(h.end)}` : ""} (
                      {h.days} วันทำการ)
                    </div>
                    {histDetail === h.id && (
                      <div className="text-xs text-txt-soft mt-1.5 pt-1.5 border-t border-dashed border-bdr">
                        📅 วันที่ยื่น: {h.submitted}
                      </div>
                    )}
                  </div>
                  <IconChevronRight
                    size={14}
                    color={C.textSoft}
                    stroke={2}
                    className={`shrink-0 mt-1 transition-transform duration-200 ${histDetail === h.id ? "rotate-90" : "rotate-0"}`}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
