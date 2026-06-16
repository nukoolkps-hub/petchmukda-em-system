/* ─── การขึ้นเงินเดือนประจำปี ────────────────────────────────────
   - เงินเดือนพื้นฐานปัจจุบัน (effective)
   - AUTO raise amount — ตั้งครั้งเดียว apply ทุก Jan
   - ประวัติการขึ้น — card per year พร้อมปุ่มแก้/คืนค่า auto
   ใช้ใน EmployeeEditModal แท็บ "เงินเดือน" — แยกเพื่อลดขนาดไฟล์ modal */

import {
  Pencil as IconPencil,
  RotateCcw as IconRevert,
  TrendingUp as IconTrendingUp,
} from "lucide-react";

interface RaiseRow {
  year: number; // ค.ศ.
  amount: number;
  isOverride: boolean;
}

interface Props {
  /** วันที่เริ่มงาน "YYYY-MM" (รวม draft) · "" = ยังไม่ได้ตั้ง */
  startWorkMonth: string;
  /** เงินเดือนพื้นฐาน effective (baseSalary + ผลรวม raises ที่ถึงรอบ) */
  effectiveBase: number;
  /** ประวัติการขึ้น · เรียงใหม่→เก่า · ปีจาก buildRaiseHistory */
  history: RaiseRow[];
  /** raises overrides ปัจจุบัน (รวม draft) · key = ค.ศ. string */
  currentRaises: Record<string, number>;
  /** ค่าใน input AUTO ตอนนี้ — undefined ถ้ายังไม่แก้ · ค่าจริงจาก employee */
  draftAutoAmount: string | undefined;
  /** ค่าใน input AUTO เมื่อยังไม่ touch · ใช้ render value */
  savedAutoAmount: number | "";
  /** draft raises (กำหนดได้ ปรับ UI input ของปีนั้น) */
  draftRaises: Record<string, number> | undefined;
  onChangeAutoAmount: (raw: string) => void;
  onChangeRaises: (next: Record<string, number>) => void;
}

export default function AnnualRaiseSection({
  startWorkMonth,
  effectiveBase,
  history,
  currentRaises,
  draftAutoAmount,
  savedAutoAmount,
  draftRaises,
  onChangeAutoAmount,
  onChangeRaises,
}: Props) {
  return (
    <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <IconTrendingUp size={12} strokeWidth={2.4} className="text-maroon" />
        <label className="text-xs text-maroon font-bold flex-1">
          การขึ้นเงินเดือนประจำปี
        </label>
      </div>

      {/* เงินเดือนปัจจุบัน (effective) */}
      <div className="mb-2.5 px-2.5 py-2 rounded-[8px] bg-white border border-bdr/40 flex items-baseline justify-between">
        <span className="text-[11px] text-txt-soft">เงินเดือนพื้นฐานปัจจุบัน</span>
        <span className="text-base font-extrabold text-maroon tabular-nums">
          {effectiveBase.toLocaleString("th-TH")}{" "}
          <span className="text-[10px] text-txt-soft font-normal">฿</span>
        </span>
      </div>

      {/* AUTO raise amount — ตั้งครั้งเดียว · apply ทุก Jan */}
      <div className="mb-2.5 p-2.5 rounded-[8px] bg-white border border-bdr/40">
        <div className="text-[11px] font-bold text-maroon mb-1.5">
          ขึ้นเงินเดือนประจำปี (AUTO ทุก Jan)
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold pointer-events-none">
              ฿
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0"
              value={
                draftAutoAmount !== undefined
                  ? draftAutoAmount
                  : savedAutoAmount
              }
              onChange={(e) => onChangeAutoAmount(e.target.value)}
              className={`w-full py-[9px] pr-3 pl-7 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-maroon text-right border-[1.5px] tabular-nums ${draftAutoAmount !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
            />
          </div>
          <span className="text-xs text-txt-soft shrink-0">บาท/ปี</span>
        </div>
        <div className="text-[10px] text-txt-soft mt-1.5 leading-relaxed">
          ตั้งครั้งเดียว · apply ทุกปี Jan ที่ทำงานครบรอบ · 0 = ไม่ขึ้นแบบ auto
          (กำหนดเฉพาะปีพิเศษได้ในประวัติ)
        </div>
      </div>

      {/* ประวัติการขึ้น — card per year พร้อมแก้ไข */}
      {history.length > 0 ? (
        <div>
          <div className="text-[11px] font-bold text-maroon mb-1.5">
            ประวัติการขึ้นเงินเดือน
          </div>
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5">
            {history.map(({ year, amount, isOverride }) => {
              // กำลังแก้ไขปีนี้อยู่ใน draft (เพิ่งกด "แก้ไข" หรือกำลังพิมพ์)
              // — แสดง input · นอกนั้น display read-only (ทั้ง auto + saved override)
              const editingThisYear =
                draftRaises !== undefined &&
                draftRaises[String(year)] !== undefined;
              return (
                <div
                  key={`raise-${year}`}
                  className="p-2.5 rounded-[10px] bg-white border border-bdr/60"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-extrabold text-txt-mid w-14 shrink-0">
                      ปี {year + 543}
                    </span>
                    {editingThisYear ? (
                      <>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                            +฿
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={currentRaises[String(year)] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next = { ...currentRaises };
                              if (raw === "") {
                                next[String(year)] = 0;
                              } else {
                                const v = Number(raw);
                                next[String(year)] =
                                  Number.isFinite(v) && v >= 0 ? v : 0;
                              }
                              onChangeRaises(next);
                            }}
                            className="w-full py-1.5 pr-2 pl-7 rounded-[7px] text-sm font-bold outline-none font-[inherit] text-maroon text-right border-[1.5px] border-gold/60 bg-white tabular-nums"
                          />
                        </div>
                        <span className="text-[10px] text-txt-soft shrink-0">
                          ฿
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...currentRaises };
                            delete next[String(year)];
                            onChangeRaises(next);
                          }}
                          title="ลบที่กำหนดเอง · กลับมาใช้จำนวน auto"
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-bdr bg-cream text-txt-mid text-[10px] font-bold cursor-pointer font-[inherit] hover:bg-white active:scale-[0.96]"
                        >
                          <IconRevert size={10} strokeWidth={2.5} />
                          คืนค่า auto
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-extrabold text-maroon text-right tabular-nums">
                          {amount > 0
                            ? `+${amount.toLocaleString("th-TH")} ฿`
                            : "—"}
                        </span>
                        {amount === 0 && (
                          <span className="text-[10px] text-txt-soft italic shrink-0">
                            ไม่ขึ้น
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onChangeRaises({
                              ...currentRaises,
                              [String(year)]: amount,
                            })
                          }
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-gold/40 bg-cream text-maroon text-[10px] font-bold cursor-pointer font-[inherit] active:scale-[0.96]"
                        >
                          <IconPencil size={10} strokeWidth={2.4} />
                          แก้ไข
                        </button>
                        {/* saved override → ↻ คืนค่า auto ลบ override โดยไม่ต้องเข้า edit */}
                        {isOverride && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...currentRaises };
                              delete next[String(year)];
                              onChangeRaises(next);
                            }}
                            title="ลบที่กำหนดเอง · กลับมาใช้จำนวน auto"
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-bdr bg-cream text-txt-mid text-[10px] font-bold cursor-pointer font-[inherit] hover:bg-white active:scale-[0.96]"
                          >
                            <IconRevert size={10} strokeWidth={2.5} />
                            คืนค่า auto
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="text-[9px] text-txt-soft mt-1 text-right">
                    {isOverride ? "(กำหนดเอง · ปีพิเศษ)" : "(ตามค่า auto)"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !startWorkMonth ? (
        <div className="text-[11px] text-txt-soft italic text-center py-2">
          ตั้ง "วันที่เริ่มงาน" ก่อนเพื่อพิจารณาขึ้นเงินเดือน
        </div>
      ) : (
        <div className="text-[11px] text-txt-soft italic text-center py-2">
          ยังทำงานไม่ครบ 1 ปี · เริ่มขึ้นได้ปีหน้า (Jan)
        </div>
      )}
    </div>
  );
}
