/* ─── ตารางการคำนวณโดยรวม — เทสต์ ────────────────────────────────────
   invariant สำคัญ: ตารางต้อง "จัดเรียง" เลขจาก calculateSalary เท่านั้น
   ห้ามคำนวณเงินเอง → ทุกช่องต้องตรงกับ salaryCalculation ที่ป้อนเข้าไป
   และคอลัมน์ "รวม" ต้องเท่ากับผลบวกของช่องในแถวนั้นเสมอ                   */

import { describe, expect, it } from "vitest";
import type { EmployeeMonthRow } from "./payrollCompute";
import { buildPayrollMatrix, type MatrixRow } from "./payrollMatrix";

const YM = "2026-04";

function row(over: Record<string, any> = {}): EmployeeMonthRow {
  const {
    employee = {},
    role = {},
    calc = {},
    poolShare = null,
    data = {},
  } = over;
  return {
    employee: {
      id: "e1",
      name: "อพิตญา ปากดี",
      nickname: "น้ำ",
      bank: "กรุงไทย",
      bankAccountNumber: "734-0-80834-5",
      ...employee,
    },
    employeeRole: {
      id: "sales",
      name: "พนักงานขาย",
      poolGroup: "sales",
      ...role,
    },
    data: { customEarnings: [], customDeductions: [], ...data },
    salaryCalculation: {
      baseSalary: 17500,
      dailySalaryRate: 17500 / 30,
      leaveDays: 2,
      weekdayOverQuotaDays: 0,
      sundayOverQuotaDays: 0,
      overQuotaDeduction: 0,
      poolItemsBreakdown: [],
      pieceBreakdown: [],
      bonusBreakdown: [],
      memberBonusTotal: 0,
      attendanceBonus: 0,
      coveragePay: 0,
      extraOpenSaturdayBonus: 0,
      recurringIncomes: [],
      recurringDeductions: [],
      socialSecurity: 0,
      advanceDeduction: 0,
      loanDeduction: 0,
      earnings: 17500,
      deductions: 0,
      netSalary: 17500,
      ...calc,
    },
    poolShare,
    advanceTotal: 0,
    monthApprovedAdvances: [],
  } as unknown as EmployeeMonthRow;
}

const findRow = (
  m: ReturnType<typeof buildPayrollMatrix>,
  label: string,
): MatrixRow | undefined =>
  m.sections.flatMap((s) => s.rows).find((r) => r.label === label);

describe("buildPayrollMatrix", () => {
  it("คอลัมน์ = พนักงานตามลำดับที่ส่งเข้ามา", () => {
    const m = buildPayrollMatrix(
      [row(), row({ employee: { id: "e2", nickname: "เนม" } })],
      YM,
    );
    expect(m.employees.map((e) => e.name)).toEqual(["น้ำ", "เนม"]);
    expect(m.yearMonth).toBe(YM);
  });

  it("รวมสุทธิ = ผลบวกเงินสุทธิของทุกคน (ตรงกับหน้าจ่ายเงิน)", () => {
    const m = buildPayrollMatrix(
      [
        row({ calc: { netSalary: 22738.53 } }),
        row({ employee: { id: "e2" }, calc: { netSalary: 9790 } }),
      ],
      YM,
    );
    expect(m.netTotal).toBe(32528.53);
    expect(findRow(m, "รวมสุทธิ")?.total).toBe(32528.53);
  });

  it("ทุกแถวเงิน: คอลัมน์รวม = ผลบวกของช่องในแถวนั้น", () => {
    const m = buildPayrollMatrix(
      [
        row({
          calc: { socialSecurity: 600, earnings: 23338, deductions: 600 },
        }),
        row({
          employee: { id: "e2" },
          calc: { socialSecurity: 750, earnings: 12590, deductions: 750 },
        }),
      ],
      YM,
    );
    for (const r of m.sections.flatMap((s) => s.rows)) {
      if (r.total === null) continue;
      const sum = r.values.reduce<number>(
        (s, v) => s + (typeof v === "number" ? v : 0),
        0,
      );
      expect(r.total).toBeCloseTo(sum, 6);
    }
    expect(findRow(m, "ประกันสังคม")?.total).toBe(1350);
  });

  it("หักวันหยุด: แยกวันธรรมดา/อาทิตย์ และรวมตรงกับ overQuotaDeduction", () => {
    // เกินโควต้า 1 วันธรรมดา + อาทิตย์ 2 วัน · เรทวันละ 400
    const m = buildPayrollMatrix(
      [
        row({
          calc: {
            baseSalary: 12000,
            dailySalaryRate: 400,
            weekdayOverQuotaDays: 1,
            sundayOverQuotaDays: 2,
            overQuotaDeduction: 1600, // 400 + 2×400×1.5
          },
        }),
      ],
      YM,
    );
    expect(findRow(m, "หักวันธรรมดา")?.values[0]).toBe(400);
    expect(findRow(m, "หักวันอาทิตย์ (× 1.5)")?.values[0]).toBe(1200);
    expect(findRow(m, "รวมหักวันหยุด")?.values[0]).toBe(1600);
  });

  it("ค่าคอมกองกลาง: %/ชิ้น/เรท/เงิน มาจาก poolShare + breakdown ตรงๆ", () => {
    const m = buildPayrollMatrix(
      [
        row({
          calc: {
            poolItemsBreakdown: [
              {
                id: "normal",
                label: "ขายทั่วไป",
                kind: "pool",
                pieces: 147.4594,
                rate: 18,
                amount: 2654.2692,
              },
            ],
          },
          poolShare: {
            itemPieces: { normal: 359 },
            itemShares: {
              normal: {
                finalSharePercent: 21.34,
                leaveDeductionPercent: 5.36,
                redistributedPercent: 1.34,
                allocatedPieces: 147.4594,
                eligible: true,
                kind: "pool",
              },
            },
          },
        }),
      ],
      YM,
    );
    expect(findRow(m, "% หักวันลา")?.values[0]).toBe(5.36);
    expect(findRow(m, "% แบ่งให้เพื่อน")?.values[0]).toBe(1.34);
    expect(findRow(m, "% ที่ได้")?.values[0]).toBe(21.34);
    expect(findRow(m, "ชิ้นที่ขายได้")?.values[0]).toBe(359);
    expect(findRow(m, "ชิ้นที่ได้")?.values[0]).toBe(147.46);
    expect(findRow(m, "เรทต่อชิ้น")?.values[0]).toBe(18);
    expect(findRow(m, "เป็นเงิน")?.values[0]).toBe(2654.27);
    // % และเรทต่อชิ้น ไม่มีคอลัมน์รวม (บวกกันไม่มีความหมาย)
    expect(findRow(m, "% ที่ได้")?.total).toBeNull();
    expect(findRow(m, "เรทต่อชิ้น")?.total).toBeNull();
  });

  it("คนละตำแหน่งมี pool item คนละชุด → union · คนที่ไม่มี = ช่องว่าง", () => {
    const m = buildPayrollMatrix(
      [
        row({
          calc: {
            poolItemsBreakdown: [
              {
                id: "normal",
                label: "ขายทั่วไป",
                pieces: 10,
                rate: 18,
                amount: 180,
              },
            ],
          },
        }),
        row({
          employee: { id: "e2" },
          role: { id: "acct", name: "พนักงานบัญชี", poolGroup: null },
          calc: {
            poolItemsBreakdown: [
              { id: "buy", label: "รับซื้อ", pieces: 5, rate: 12, amount: 60 },
            ],
          },
        }),
      ],
      YM,
    );
    const titles = m.sections.map((s) => s.title);
    expect(titles).toContain("ค่าคอม: ขายทั่วไป");
    expect(titles).toContain("ค่าคอม: รับซื้อ");
    const normalMoney = m.sections
      .find((s) => s.title === "ค่าคอม: ขายทั่วไป")
      ?.rows.find((r) => r.label === "เป็นเงิน");
    expect(normalMoney?.values).toEqual([180, null]);
  });

  it("รายการประจำ/พิเศษ รวมตาม label (คนละคนมีคนละรายการ)", () => {
    const m = buildPayrollMatrix(
      [
        row({
          calc: {
            recurringIncomes: [{ label: "ค่าเดินทาง", amount: 500 }],
            recurringDeductions: [{ label: "ค่าชุด", amount: 200 }],
          },
          data: { customEarnings: [{ label: "โบนัสพิเศษ", amount: 1000 }] },
        }),
        row({
          employee: { id: "e2" },
          calc: { recurringIncomes: [{ label: "เบี้ยขยัน", amount: 300 }] },
          data: { customDeductions: [{ label: "หักของเสีย", amount: 150 }] },
        }),
      ],
      YM,
    );
    expect(findRow(m, "ค่าเดินทาง")?.values).toEqual([500, null]);
    expect(findRow(m, "เบี้ยขยัน")?.values).toEqual([null, 300]);
    expect(findRow(m, "ค่าชุด")?.values).toEqual([200, null]);
    expect(findRow(m, "โบนัสพิเศษ")?.values).toEqual([1000, null]);
    expect(findRow(m, "หักของเสีย")?.values).toEqual([null, 150]);
  });

  it("แถวที่ไม่มีใครมีค่า ถูกตัดทิ้ง (ตารางไม่รก)", () => {
    const m = buildPayrollMatrix([row()], YM);
    expect(findRow(m, "เงินค่าแทน")).toBeUndefined();
    expect(findRow(m, "หักผ่อนเงินกู้")).toBeUndefined();
    // แต่แถวสรุปต้องอยู่เสมอ แม้ยอดเป็น 0
    expect(findRow(m, "รวมรายจ่าย")?.values[0]).toBe(0);
  });

  it("ปิดข้อมูลธนาคารได้ (ตอนแชร์ตารางให้คนอื่นดู)", () => {
    const withBank = buildPayrollMatrix([row()], YM);
    expect(findRow(withBank, "เลขบัญชี")?.values[0]).toBe("734-0-80834-5");
    const without = buildPayrollMatrix([row()], YM, { includeBankInfo: false });
    expect(findRow(without, "เลขบัญชี")).toBeUndefined();
    expect(findRow(without, "ธนาคาร")).toBeUndefined();
  });

  it("ไม่มีพนักงานเลย → ตารางว่าง ไม่พัง", () => {
    const m = buildPayrollMatrix([], YM);
    expect(m.employees).toEqual([]);
    expect(m.netTotal).toBe(0);
  });
});
