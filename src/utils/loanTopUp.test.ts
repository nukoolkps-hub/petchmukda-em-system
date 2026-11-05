/* ─── เพิ่มเงินกู้ (top-up) ───────────────────────────────────────────
   พังเงียบ: กู้เพิ่มแล้วยอดหักของเดือนที่ยืนยันไปแล้ว (grace) เปลี่ยนตอน re-settle
   invariant:
   1. ยอดกู้/ยอดผ่อน ณ เดือนก่อนเดือนเริ่มหักยอดเพิ่ม = ค่าเดิมเป๊ะ
   2. doc เก่าไม่มี topUps → ทุกเดือนเท่าเดิม (migrate-on-read)
   3. ยอดที่หักไปแล้ว (repayments) ไม่ถูกแตะ · ผ่อนครบแล้วกู้เพิ่ม = กลับมาผ่อน
   4. ประวัติรวมกันได้ยอดกู้รวมเท่า principal เสมอ                          */

import { describe, expect, it } from "vitest";
import {
  applyTopUp,
  type LoanTopUp,
  latestTopUp,
  loanBasePrincipal,
  loanHistory,
  loanMonthlyAsOf,
  loanPrincipalAsOf,
  loanRepaymentHistory,
  topUpUndoBlocker,
  undoLatestTopUp,
  validateTopUp,
} from "./loanTopUp";
import { buildLoanContext } from "./payrollCompute";
import { calculateSalary } from "./salaryUtils";

const base = {
  id: "l1",
  employeeId: "e1",
  principal: 10000,
  monthlyDeduction: 2000,
  startMonth: "2026-01",
  createdAt: "2025-12-20T03:00:00.000Z",
  status: "active",
  repayments: { "2026-01": 2000, "2026-02": 2000 } as Record<string, number>,
};

const topUp = (loan: any, over: Partial<Parameters<typeof applyTopUp>[1]>) => ({
  ...loan,
  ...applyTopUp(loan, {
    id: "t1",
    amount: 5000,
    effectiveMonth: "2026-04",
    monthlyDeduction: 3000,
    createdAt: "2026-03-28T05:00:00.000Z",
    ...over,
  }),
});

/** ยอดหักเงินกู้เดือน ym ผ่าน pipeline จริง (buildLoanContext → calculateSalary) */
function deductionFor(loan: any, ym: string) {
  const r = calculateSalary(
    { baseSalary: 30000 },
    { weekdays: 0, sundays: 0 },
    {},
    0,
    0,
    null,
    { id: "staff" },
    buildLoanContext([loan], "e1", ym),
  );
  return r?.loanDeduction ?? 0;
}

describe("applyTopUp", () => {
  it("บวกยอดกู้รวม · ยอดผ่อนเป็นค่าใหม่ · จำยอดผ่อนเดิมไว้", () => {
    const f = applyTopUp(base, {
      id: "t1",
      amount: 5000,
      effectiveMonth: "2026-04",
      monthlyDeduction: 3000,
      createdAt: "2026-03-28T05:00:00.000Z",
    });
    expect(f.principal).toBe(15000);
    expect(f.monthlyDeduction).toBe(3000);
    expect(f.status).toBe("active");
    expect(f.topUps).toEqual([
      {
        id: "t1",
        amount: 5000,
        effectiveMonth: "2026-04",
        createdAt: "2026-03-28T05:00:00.000Z",
        prevMonthlyDeduction: 2000,
        monthlyDeduction: 3000,
      },
    ]);
  });

  it("**ไม่แตะ repayments** (ยอดที่หักไปแล้วต้องคงเดิม)", () => {
    const loan = topUp(base, {});
    expect(loan.repayments).toEqual(base.repayments);
  });

  it("ผ่อนครบแล้วกู้เพิ่ม → กลับมา 'กำลังผ่อน'", () => {
    const paidOff = { ...base, status: "paid_off" };
    expect(topUp(paidOff, {}).status).toBe("active");
  });

  it("ไม่เขียน field ว่าง (note/slip) ลง doc", () => {
    const t = topUp(base, { note: "", slipImageUrl: "" }).topUps[0];
    expect("note" in t).toBe(false);
    expect("slipImageUrl" in t).toBe(false);
  });
});

describe("ยอด ณ เดือน — กู้เพิ่มไม่ย้อนไปเปลี่ยนเดือนก่อน", () => {
  const loan = topUp(base, {});

  it("doc เก่าไม่มี topUps = ค่าเดิมทุกเดือน", () => {
    expect(loanPrincipalAsOf(base, "2026-01")).toBe(10000);
    expect(loanMonthlyAsOf(base, "2030-01")).toBe(2000);
    expect(loanBasePrincipal(base)).toBe(10000);
  });

  it("ก่อนเดือนเริ่มหักยอดเพิ่ม = ยอดเดิม · ตั้งแต่เดือนนั้น = ยอดใหม่", () => {
    expect(loanPrincipalAsOf(loan, "2026-03")).toBe(10000);
    expect(loanMonthlyAsOf(loan, "2026-03")).toBe(2000);
    expect(loanPrincipalAsOf(loan, "2026-04")).toBe(15000);
    expect(loanMonthlyAsOf(loan, "2026-04")).toBe(3000);
    expect(loanBasePrincipal(loan)).toBe(10000);
  });

  it("กู้เพิ่มหลายครั้ง — ย้อนได้ทีละขั้น", () => {
    const twice = {
      ...loan,
      ...applyTopUp(loan, {
        id: "t2",
        amount: 4000,
        effectiveMonth: "2026-06",
        monthlyDeduction: 3500,
        createdAt: "2026-05-30T05:00:00.000Z",
      }),
    };
    expect(loanPrincipalAsOf(twice, "2026-03")).toBe(10000);
    expect(loanMonthlyAsOf(twice, "2026-03")).toBe(2000);
    expect(loanPrincipalAsOf(twice, "2026-05")).toBe(15000);
    expect(loanMonthlyAsOf(twice, "2026-05")).toBe(3000);
    expect(loanPrincipalAsOf(twice, "2026-06")).toBe(19000);
    expect(loanMonthlyAsOf(twice, "2026-06")).toBe(3500);
  });

  it("**re-settle เดือนก่อนหลังกู้เพิ่ม ได้ยอดหักเท่าเดิมเป๊ะ** (ผ่าน calculateSalary จริง)", () => {
    // ก้อนเดิมเหลือ 500 ในเดือน 3 → หัก 500 · กู้เพิ่มเริ่มเดือน 4
    const nearlyDone = {
      ...base,
      repayments: { "2026-01": 5000, "2026-02": 4500, "2026-03": 500 },
    };
    const before = deductionFor(nearlyDone, "2026-03");
    const after = deductionFor(topUp(nearlyDone, {}), "2026-03");
    expect(before).toBe(500);
    expect(after).toBe(before);
  });

  it("เดือนที่เริ่มหักยอดเพิ่ม หักตามยอดผ่อนใหม่", () => {
    expect(deductionFor(topUp(base, {}), "2026-04")).toBe(3000);
  });
});

describe("validateTopUp", () => {
  const ok = {
    amount: 5000,
    monthlyDeduction: 2000,
    effectiveMonth: "2026-04",
  };

  it("ผ่านเมื่อข้อมูลครบ", () => {
    expect(validateTopUp(base, ok)).toBe("");
  });

  it("ยอดว่าง / ยอดผ่อนว่าง / ไม่เลือกเดือน → ไม่ผ่าน", () => {
    expect(validateTopUp(base, { ...ok, amount: 0 })).not.toBe("");
    expect(validateTopUp(base, { ...ok, monthlyDeduction: 0 })).not.toBe("");
    expect(validateTopUp(base, { ...ok, effectiveMonth: "" })).not.toBe("");
  });

  it("ยอดผ่อนเกินยอดคงเหลือหลังกู้เพิ่ม → ไม่ผ่าน", () => {
    // คงเหลือ 10000 − 4000 = 6000 · + 5000 = 11000
    expect(validateTopUp(base, { ...ok, monthlyDeduction: 11000 })).toBe("");
    expect(validateTopUp(base, { ...ok, monthlyDeduction: 11001 })).not.toBe(
      "",
    );
  });

  it("เงินกู้ที่ยกเลิกแล้วกู้เพิ่มไม่ได้", () => {
    expect(validateTopUp({ ...base, status: "cancelled" }, ok)).not.toBe("");
  });

  it("**เดือนเริ่มหักห้ามก่อนครั้งที่กู้เพิ่มล่าสุด** (ยอดผ่อนย้อนหลังจะต่อกันผิด)", () => {
    const loan = topUp(base, { effectiveMonth: "2026-05" });
    expect(validateTopUp(loan, { ...ok, effectiveMonth: "2026-04" })).not.toBe(
      "",
    );
    expect(validateTopUp(loan, { ...ok, effectiveMonth: "2026-05" })).toBe("");
  });
});

describe("loanHistory", () => {
  it("กู้ครั้งเดียว = 1 รายการ เท่ายอดกู้", () => {
    const h = loanHistory({ ...base, note: "ค่ารักษา" });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({
      kind: "initial",
      amount: 10000,
      effectiveMonth: "2026-01",
      monthlyDeduction: 2000,
      totalAfter: 10000,
      note: "ค่ารักษา",
    });
  });

  it("กู้เพิ่ม → ต่อท้ายตามลำดับเวลา · ยอดรวมสุดท้าย = principal", () => {
    const loan = topUp(base, { note: "ซ่อมรถ" });
    const h = loanHistory(loan);
    expect(h.map((e) => e.kind)).toEqual(["initial", "topup"]);
    // ยอดผ่อนของครั้งแรกต้องเป็นค่าเดิม ไม่ใช่ค่าที่ถูกแก้ตอนกู้เพิ่ม
    expect(h[0].monthlyDeduction).toBe(2000);
    expect(h[1]).toMatchObject({
      amount: 5000,
      monthlyDeduction: 3000,
      prevMonthlyDeduction: 2000,
      totalAfter: 15000,
      note: "ซ่อมรถ",
    });
    expect(h[h.length - 1].totalAfter).toBe(loan.principal);
  });

  it("ยอดผ่อนไม่เปลี่ยน → ไม่ใส่ prevMonthlyDeduction", () => {
    const h = loanHistory(topUp(base, { monthlyDeduction: 2000 }));
    expect("prevMonthlyDeduction" in h[1]).toBe(false);
  });

  it("topUps ที่ไม่ใช่ array (ข้อมูลเพี้ยน) ไม่ทำให้พัง", () => {
    const h = loanHistory({ ...base, topUps: null as unknown as LoanTopUp[] });
    expect(h).toHaveLength(1);
  });
});

describe("loanRepaymentHistory", () => {
  it("เรียงเดือน เก่า → ใหม่ · ข้ามเดือนที่หัก 0", () => {
    expect(
      loanRepaymentHistory({
        repayments: { "2026-03": 1000, "2026-01": 2000, "2026-02": 0 },
      }),
    ).toEqual([
      { yearMonth: "2026-01", amount: 2000 },
      { yearMonth: "2026-03", amount: 1000 },
    ]);
  });
});

describe("ลบการกู้เพิ่มครั้งล่าสุด", () => {
  const once = topUp(base, {});
  const twice = {
    ...once,
    ...applyTopUp(once, {
      id: "t2",
      amount: 4000,
      effectiveMonth: "2026-06",
      monthlyDeduction: 3500,
      createdAt: "2026-05-30T05:00:00.000Z",
    }),
  };

  it("ครั้งล่าสุด = ตามเวลาที่กด", () => {
    expect(latestTopUp(twice)?.id).toBe("t2");
    expect(latestTopUp(base)).toBeNull();
  });

  it("**ลบแล้วได้ doc เท่าก่อนกู้เพิ่มเป๊ะ** (ยอดกู้ · ยอดผ่อน · สถานะ · topUps)", () => {
    const undone = { ...twice, ...undoLatestTopUp(twice) };
    expect(undone.principal).toBe(once.principal);
    expect(undone.monthlyDeduction).toBe(once.monthlyDeduction);
    expect(undone.status).toBe(once.status);
    expect(undone.topUps).toEqual(once.topUps);
    // ลบต่ออีกครั้ง → กลับเป็นก้อนแรก
    const back = { ...undone, ...undoLatestTopUp(undone) };
    expect(back.principal).toBe(base.principal);
    expect(back.monthlyDeduction).toBe(base.monthlyDeduction);
    expect(back.topUps).toEqual([]);
  });

  it("ก้อนที่ผ่อนครบก่อนกู้เพิ่ม → ลบแล้วกลับเป็น 'ผ่อนครบแล้ว'", () => {
    const paidOff = {
      ...base,
      status: "paid_off",
      repayments: { "2026-01": 5000, "2026-02": 5000 },
    };
    const reopened = topUp(paidOff, {});
    expect(reopened.status).toBe("active");
    expect(undoLatestTopUp(reopened)?.status).toBe("paid_off");
  });

  it("ไม่แตะ repayments", () => {
    expect("repayments" in (undoLatestTopUp(once) || {})).toBe(false);
  });

  it("ไม่มีรายการกู้เพิ่ม → null / ลบไม่ได้", () => {
    expect(undoLatestTopUp(base)).toBeNull();
    expect(topUpUndoBlocker(base)).not.toBe("");
  });

  it("ยังไม่เคยหักด้วยยอดใหม่ → ลบได้", () => {
    // หักเดือน 1-2 (ก่อนเดือนเริ่มหักยอดใหม่ 2026-04) ไม่นับ
    expect(topUpUndoBlocker(once)).toBe("");
  });

  it("**หักเงินเดือนตั้งแต่เดือนที่ยอดใหม่มีผลไปแล้ว → ลบไม่ได้**", () => {
    const deducted = {
      ...once,
      repayments: { ...once.repayments, "2026-04": 3000 },
    };
    expect(topUpUndoBlocker(deducted)).not.toBe("");
    // เดือนนั้นหัก 0 (เงินไม่พอ) = ยังไม่กระทบ ledger → ลบได้
    const zero = { ...once, repayments: { ...once.repayments, "2026-04": 0 } };
    expect(topUpUndoBlocker(zero)).toBe("");
  });

  it("เงินกู้ที่ยกเลิกแล้ว → ลบไม่ได้", () => {
    expect(topUpUndoBlocker({ ...once, status: "cancelled" })).not.toBe("");
  });

  it("ประวัติบอก id ของรายการกู้เพิ่ม (ปุ่มลบผูกกับรายการล่าสุด)", () => {
    const h = loanHistory(twice);
    expect(h.map((e) => e.topUpId)).toEqual([undefined, "t1", "t2"]);
  });
});
