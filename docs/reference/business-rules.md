# Business Rules — สูตรเงินเดือนและกฎธุรกิจ

Config ทั้งหมดอยู่ใน `src/constants.ts` → `BUSINESS_RULES`

## สูตรเงินเดือน (calculateSalary)

```
Earnings = baseSalary
         + singleRatePieces × singlePieceRate
         + normalSalePieces × normalSalePieceRate
         + specialSalePieces × specialSalePieceRate
         + buyPieces × buyPieceRate
         + invitePieces × invitePieceRate
         + transferPieces × transferPieceRate
         + attendanceBonus

Deductions = overQuotaDeduction
           + advanceDeduction
           + socialSecurity
           + lateDeduction

Net = Earnings - Deductions
```

### Attendance Bonus

| วันลาในเดือน | โบนัส |
|---|---|
| 0 วัน | 500 บาท |
| 1 วัน | 300 บาท |
| >= 2 วัน | 0 บาท |

### Over-Quota Deduction

- โควต้าวันลา weekday = 2 วัน/เดือน
- วันลา weekday ที่เกินโควต้า → หัก `dailyRate × จำนวนวันเกิน`
- วันลาวันอาทิตย์ทุกวัน → หัก `dailyRate × 1.5 × จำนวนวัน`
- `dailyRate = baseSalary / 30`

Source: `src/utils/salaryUtils.ts` → `calculateSalary()`

## Pool Commission System

แบ่ง commission ร่วมกันตาม pool group ที่กำหนดใน Role

### Sell Pool + Buy Pool (คำนวณแยกกัน)

1. หาพนักงานใน pool group เดียวกัน
2. หา top performer (คนที่ขาย/ซื้อมากที่สุด)
3. เกณฑ์เข้า pool: pieces >= 80% ของ top → ถ้าต่ำกว่าไม่เข้า pool
4. Base share = 100% / จำนวนคนที่ eligible
5. Leave deduction factor = 1 - (leaveDays / workDays)
6. Actual share = base share × leave deduction factor
7. ส่วนที่ถูกหักจากคนลา → redistribute ให้คนที่เหลือตาม ratio

### Base Salary Threshold

- พนักงานที่มี `poolExclusion = "both"` + ขาย < 50% ของ top → ไม่ได้ baseSalary

### poolExclusion Field

| Value | ผล |
|---|---|
| `null` / `""` | เข้าทั้ง sell + buy pool |
| `"sell"` | ไม่เข้า sell pool |
| `"buy"` | ไม่เข้า buy pool |
| `"both"` | ไม่เข้าทั้ง 2 pool + มีเกณฑ์ baseSalary |

Source: `src/utils/salaryUtils.ts` → `computePoolSharesForGroup()`

## ระบบลา

- 2 ประเภท: ลากิจ (`personal`) + ลาป่วย (`sick`)
- Balance tracking per employee per month
- วันลาที่เกินโควต้าจะถูกหักจากเงินเดือน

Source: `src/utils/leaveUtils.ts`

## ระบบเบิกเงินล่วงหน้า

- เพดาน: 50% ของ baseSalary
- Status flow: `pending → approved / rejected`
- Approved → หักจากเงินเดือนรอบถัดไป
- LINE notification: แจ้ง admin เมื่อมีคำขอ, แจ้งพนักงานเมื่อ approve/reject
- Cleanup: Cloud Function ลบ advances เกิน 6 เดือน (ทุกวันที่ 1)
