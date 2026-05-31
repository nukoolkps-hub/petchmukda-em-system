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

```
bonusDays = max(0, WEEKDAY_LEAVE_QUOTA - weekdayLeaveDays)   // quota = 2
attendanceBonus = bonusDays × dailyRate                        // dailyRate = baseSalary ÷ 30
```

| วันลา weekday ในเดือน | bonusDays | โบนัส |
|---|---|---|
| 0 วัน | 2 | `2 × dailyRate` |
| 1 วัน | 1 | `1 × dailyRate` |
| ≥ 2 วัน | 0 | 0 |

หมายเหตุ: นับเฉพาะวันลา **วันธรรมดา** (จันทร์–ศุกร์) — วันอาทิตย์ที่ลาไม่ถูกนับใน `weekdayLeaveDays` แต่ถูกหักผ่าน Over-Quota Deduction

### Over-Quota Deduction

- โควต้าวันลา weekday = 2 วัน/เดือน
- วันลา weekday ที่เกินโควต้า → หัก `dailyRate × จำนวนวันเกิน`
- วันลาวันอาทิตย์ทุกวัน → หัก `dailyRate × 1.5 × จำนวนวัน`
- `dailyRate = baseSalary / 30`

Source: `src/utils/salaryUtils.ts` → `calculateSalary()`

## Pool Commission System ("กองกลาง")

> UI ภาษาไทยเรียกระบบนี้ว่า **"กองกลาง"** · code/เอกสารเรียก `pool`

แบ่ง commission ร่วมกันตาม pool group ที่กำหนดใน Role · sell pool และ buy pool คำนวณ**แยกกัน**ด้วยสูตรเดียวกัน

### ขั้นตอน (ตาม Excel)

1. รวบรวมทุกคนใน pool group เดียวกัน (จาก `role.poolGroup`)
2. หา **top** ในฝั่งนั้น: `topSellPieces = max(sellPieces ทุกคน)`, `topBuyPieces = max(buyPieces)`
3. **กฎ 80%** — เกณฑ์เข้า pool: `pieces ≥ topPieces × POOL_THRESHOLD (= 0.8)` → ต่ำกว่าถูกตัดออก
4. นับ `eligibleEmployeeCount` (n) = จำนวนคนที่ยังเหลือใน pool
5. **เปอร์เซ็นต์ฐาน:** `baseSharePercent = 100 ÷ n`
6. **ตัวคูณหักวันลา:** `leaveDeductionFactor = baseSharePercent ÷ DAYS_PER_MONTH (= 30)`
7. **% หัก** ของแต่ละคน: `leaveDeductionPercent[i] = totalLeave[i] × leaveDeductionFactor × (n − 1)`
8. **% แบ่งเพื่อน** (กระจายให้คนอื่นๆ): `redistributedPercent[i] = leaveDeductionPercent[i] ÷ (n − 1)`
9. **% สุทธิ** ของแต่ละคน: `finalSharePercent[i] = baseSharePercent − leaveDeductionPercent[i] + Σ(redistributedPercent ของคนอื่น)`
10. **Pool รวม:** `totalPoolPieces = Σ pieces ของทุกคน` (รวมคนที่ถูกตัดด้วย — ชิ้นเขายังเข้า pool, แต่เขาไม่ได้รับส่วนแบ่ง)
11. **ชิ้นที่ได้:** `allocatedPieces[i] = (finalSharePercent[i] ÷ 100) × totalPoolPieces`

### ขาย-พิเศษ (specialSalePieces)

ไม่เข้า pool — ใครขายใครได้: `commission = pieces × specialSalePieceRate` แต่ยังนับรวมใน `topSellPieces` (ส่งผลต่อ 80% threshold)

### Base Salary Threshold

พนักงานที่มี `poolExclusion = "both"` **และ** `sellPieces < topSellPieces × BASE_SALARY_THRESHOLD (= 0.5)` → ไม่ได้ baseSalary

### poolExclusion Field

| Value | ผล |
|---|---|
| `null` / `""` | เข้าทั้ง sell + buy pool |
| `"sell"` | ไม่เข้า sell pool |
| `"buy"` | ไม่เข้า buy pool |
| `"both"` | ไม่เข้าทั้ง 2 pool + มีเกณฑ์ baseSalary |

### Snapshot (สำคัญสำหรับ employee view)

พนักงานอ่าน `employees` / `leaves` ของเพื่อนไม่ได้ (ปิดสิทธิ์) — ตอน admin save salary ระบบเขียน snapshot ลง salary doc:

| Field | จาก |
|---|---|
| `roleId` | `employee.roleId` ปัจจุบัน |
| `poolExclusion` | `employee.poolExclusion` |
| `totalLeaveDays` | `weekdayLeaves + sundayLeaves` ของเดือนนั้น |

`computePoolSharesForGroup` ใช้ snapshot ก่อนเสมอ (fallback ไป live data เฉพาะ admin ที่อ่านได้เต็ม) — ทำให้ admin/employee เห็นเลขตรงกัน

นอกจาก snapshot ใน salary doc แล้ว field ชุดเดียวกันยังถูก mirror ลง collection
`poolSnapshots/{ym}` (public, ไม่มี field อ่อนไหว) — เป็น infra สำหรับ phase 2 ที่จะ
ล็อกสิทธิ์อ่าน salaries ดู [`../reference.md`](../reference.md) → "Privacy: salaries vs poolSnapshots"

Source: `src/utils/salaryUtils.ts` → `computePoolSharesForGroup()` · snapshot inject ใน `src/data/useFirebaseAppData.ts` → `updateSalary()` · `src/firebase/poolSnapshots.ts`

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
