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
         + coveragePay              (เงินค่าแทน — coverage duty × จำนวนวันที่แทน)

Deductions = overQuotaDeduction
           + advanceDeduction
           + loanDeduction         (เงินกู้ผ่อนคืน — หักเท่าที่มี FIFO)
           + socialSecurity
           + customDeductions

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

### การขึ้นเงินเดือนประจำปี (Annual Raise)

เงินเดือนพื้นฐานที่ "มีผลจริง" (effective) = `baseSalary` (เริ่มต้น) + ผลรวมการขึ้นเงินรายปีที่ถึงรอบแล้ว

```
getEffectiveBaseSalary(employee, yearMonth?)
  = baseSalary
  + Σ raise(y)   สำหรับปี y = startYear+1 … targetYear ที่ eligible
```

| Field (`Employee`) | ความหมาย |
|---|---|
| `baseSalary` | เงินเดือนพื้นฐาน **เริ่มต้น** (ตอนเริ่มงาน) |
| `annualRaiseAmount` | จำนวนขึ้น AUTO ทุกเดือน ม.ค. (admin ตั้งครั้งเดียว · `0` = ไม่ขึ้น auto) |
| `annualRaises[year]` | override รายปี (ค.ศ. string) · มี precedence เหนือ auto สำหรับปีนั้น |

- **Eligibility:** ปี `y` จะขึ้นได้เมื่อทำงานครบ ≥ 365 วันก่อน 1 ม.ค. ปีนั้น (`isEligibleForRaiseYear`, อิง `startWorkMonth`)
- **Effective base** ถูกใช้ใน `calculateSalary` (live) + snapshot ตอน `updateSalary` (เดือนที่ freeze ไว้ใช้ค่าตอนนั้น · เดือนปัจจุบัน/อนาคต live)
- **UI:** admin แก้ใน `EmployeeEditModal` → section "การขึ้นเงินเดือนประจำปี" (auto amount + ประวัติ card รายปี + override) · พนักงานเห็น effective base ใน `PositionRateCard` (หน้าแรก)

Source: `src/utils/salaryUtils.ts` → `getEffectiveBaseSalary()` / `isEligibleForRaiseYear()` / `buildRaiseHistory()`

## Pool Commission System ("กองกลาง")

> UI ภาษาไทยเรียกระบบนี้ว่า **"กองกลาง"** · code/เอกสารเรียก `pool`

แบ่ง commission ร่วมกันตาม pool group ที่กำหนดใน Role · sell pool และ buy pool คำนวณ**แยกกัน**ด้วยสูตรเดียวกัน

### ขั้นตอน (ตาม Excel)

1. รวบรวมทุกคนใน pool group เดียวกัน (จาก `role.poolGroup`)
2. หา **top** ในฝั่งนั้น: `topSellPieces = max(sellPieces ทุกคน)`, `topBuyPieces = max(buyPieces)`
3. **กฎ 80%** — เกณฑ์เข้า pool: `pieces ≥ topPieces × POOL_THRESHOLD (= 0.8)` → ต่ำกว่าถูกตัดออก
   - ฝั่งขาย: ใช้ `sellPieces = normalSalePieces + specialSalePieces` เทียบ
   - **ข้อยกเว้น (duty):** คนที่ทำหน้าที่รายเดือนที่เปิด `grantsPoolEligibility` ในเดือนนั้น
     (`salary.poolThresholdExempt = true`) → ผ่านเกณฑ์ 80% อัตโนมัติทั้ง sell+buy
     (ติดทำหน้าที่ทั้งเดือน ขายไม่ทันเพื่อน) · **แต่ยังเคารพ `poolExclusion`** (Admin ปิดฝั่งไหน
     ฝั่งนั้นไม่ได้) และ **ไม่กระทบเกณฑ์ 50% เงินเดือนพื้นฐาน** · คน `poolExclusion="both"`
     ถูกกันออกจากรอบหน้าที่รายเดือน (`resolveDutyPool`) เพราะเสี่ยงหลุด 50%
4. นับ `eligibleEmployeeCount` (n) = จำนวนคนที่ยังเหลือใน pool
5. **เปอร์เซ็นต์ฐาน:** `baseSharePercent = 100 ÷ n`
6. **ตัวคูณหักวันลา:** `leaveDeductionFactor = baseSharePercent ÷ DAYS_PER_MONTH (= 30)`
7. **วันลาที่ใช้คำนวณ:** `effectiveLeave[i] = max(0, totalLeave[i] − LEAVE_DEDUCTION_FREE_DAYS (= 2))` — 2 วันแรกฟรี ไม่ถูกหัก
8. **% หัก** ของแต่ละคน: `leaveDeductionPercent[i] = effectiveLeave[i] × leaveDeductionFactor × (n − 1)`
9. **% แบ่งเพื่อน** (กระจายให้คนอื่นๆ): `redistributedPercent[i] = leaveDeductionPercent[i] ÷ (n − 1)`
10. **% สุทธิ** ของแต่ละคน: `finalSharePercent[i] = baseSharePercent − leaveDeductionPercent[i] + Σ(redistributedPercent ของคนอื่น)`
11. **Pool รวมที่หารแบ่ง** (gross):
    - ฝั่งขาย: `Σ normalSalePieces` (ทั่วไปเท่านั้น — **ไม่รวมพิเศษ**)
    - ฝั่งรับซื้อ: `Σ buyPieces`
    - แล้ว**หัก** `poolAdjustments` ของตำแหน่งนั้น → ได้ `totalPoolPieces` (net)
12. **ชิ้นที่ได้:** `allocatedPieces[i] = (finalSharePercent[i] ÷ 100) × totalPoolPieces`

#### ทำไม 2 วันแรกฟรี
ลา 0-2 วัน → ไม่ถูกหัก ไม่ถูกเอามาเกลี่ยให้เพื่อน (แต่ยังรับจากเพื่อนที่ลาเกิน 2 วันได้ปกติ)
+ ยังได้ **โบนัสหยุดน้อย** ของตัวเองตามเดิม (`WEEKDAY_LEAVE_QUOTA`) — 2 ตัวแยกกัน

### ขาย-พิเศษ (specialSalePieces)

**ใครขายใครได้** — `commission = pieces × specialSalePieceRate` จ่ายตรงเข้า
คนนั้น · ไม่เข้ากองกลางที่หารแบ่ง · **แต่นับรวมใน `sellPieces`** ตอนเทียบ
80% threshold (พนักงานยังมีสิทธิ์เข้ากอง)

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
- **`leaveUtils` รับ `storeCalendar` param** — นับเฉพาะวันลาที่ตรงกับ "วันทำงาน" (ดู section "ปฏิทินเปิด-ปิดร้าน" ด้านล่าง)

### กฎตอนพนักงานยื่นลา (`useLeaveForm.validate()`)

| กฎ | รายละเอียด | error |
|---|---|---|
| ห้ามทับใบเดิม | วันที่เลือกห้ามทับซ้อนกับใบลาเดิมของตัวเอง (interval overlap: `lv.start ≤ end && lv.end ≥ start`) | "วันที่เลือกทับกับใบลาเดิม (…)" |
| ลาป่วยห้ามข้ามเดือน | `sick` ที่ `start` กับ `end` คนละเดือน → ให้ยื่นแยกเดือน | "ลาป่วยข้ามเดือนไม่ได้ — กรุณายื่นแยกเดือน" |
| ลาป่วยล่วงหน้า ≤ 2 อาทิตย์ | `sick` เลือกวันได้ไม่เกิน `TODAY + 14` วัน | "ลาป่วยล่วงหน้าได้ไม่เกิน 2 อาทิตย์" |

- ลากิจ (`personal`) ไม่มีข้อจำกัดข้ามเดือน/ล่วงหน้า (ลาล่วงหน้าได้)
- **UI ป้องกันชั้นแรก:** `RequestTab` ปฏิทินวันที่สิ้นสุด cap `maxDate = min(สิ้นเดือน start, TODAY+14)` เมื่อเลือกลาป่วย · `validate()` เป็น defense layer
- **ผู้ดูแล (admin)** เพิ่มใบลาให้พนักงานผ่าน `LeaveListPanel` ได้โดยไม่ติดกฎเหล่านี้ (override เคสลืมกดลา)

Source: `src/utils/leaveUtils.ts` · `src/hooks/useLeaveForm.ts` · `src/components/home/RequestTab.tsx`

## ปฏิทินเปิด-ปิดร้าน (storeCalendar)

ร้านหยุดวันเสาร์เป็นค่าตั้งต้น · admin override ผ่าน `/config/storeCalendar`:

```ts
interface StoreCalendar {
  extraOpenSaturdays: string[];   // "YYYY-MM-DD"
  extraClosedWeekdays: string[];  // "YYYY-MM-DD"
}
```

**Default vs override:**

| Day | Default | Override key | Counts as |
|---|---|---|---|
| อาทิตย์ | เปิด | — | × 1.5 ทุกวัน (กฎเดิม) |
| **เสาร์** | **ปิด** | `extraOpenSaturdays` (เปิด) | ลาในวันร้านปิด = ไม่นับ · ลาในเสาร์เปิดพิเศษ = วันธรรมดา |
| จ-ศ | เปิด | `extraClosedWeekdays` (ปิด) | ลาในวันร้านเปิด = นับ · ลาในวันปิดพิเศษ = ไม่นับ |

**Helper:**
- `isStoreClosed(ymd, calendar)` — true เมื่อร้านปิด
- `isQuotaCountableDay(ymd, calendar)` — true เมื่อ "ลา = นับเข้าโควต้า/หัก × 1"
- `applicableDuties(duties, today, calendar)` — filter หน้าที่ทั้งหมดถ้าร้านปิด · client/server มี sync check

**ผลต่อระบบ:**
- หน้าที่ (duty): Cloud Function `recomputeDutyAssignments` filter ก่อนเขียน snapshot → วันที่ปิดไม่มี assignment เลย
- การลา: `countWeekdayLeaves(monthLeaves, calendar)` + `getOverQuotaDays(monthLeaves, calendar)` รับ calendar จาก root (App.tsx → ส่งผ่าน props ทุก consumer)
- โบนัสขยัน: ใช้ `countWeekdayLeaves` ผลคำนวณเดียวกัน

**UI Admin:** "วันเปิด-ปิดร้าน" ใน sidebar (กลุ่ม "ปฏิทิน") · เพิ่ม/ลบ → save ทันที + trigger recompute duty assignments

Source: `src/utils/storeCalendar.ts`, `src/firebase/storeCalendar.ts`, `src/components/admin/StoreCalendarPanel.tsx`

## ระบบเบิกเงินล่วงหน้า

- เพดาน: 50% ของ baseSalary
- Status flow: `pending → approved / rejected`
- Approved → หักจากเงินเดือนรอบถัดไป
- พนักงาน**ขอเอง** · admin อนุมัติ/ปฏิเสธ
- บล็อกการเบิกในวันสุดท้ายของเดือน (วันทำเงินเดือน)
- LINE notification: แจ้ง admin เมื่อมีคำขอ, แจ้งพนักงานเมื่อ approve/reject
- Cleanup: Cloud Function ลบ advances เกิน 6 เดือน (ทุกวันที่ 1)

## ระบบเงินกู้ผ่อนคืน (`employeeLoans`)

ต่างจากเบิกล่วงหน้า — **admin สร้างเอง** + หักจากเงินเดือนอัตโนมัติทุกเดือน
จนครบ โดยใช้ **ledger** เก็บยอดที่หักจริงรายเดือน

- ฟิลด์หลัก: `principal` (เงินต้น) · `monthlyDeduction` (ผ่อนเดือนละ) ·
  `startMonth` · `status` · `repayments[ym]` (ledger)
- คงเหลือ = `principal − Σ repayments`
- **สูตรหัก (FIFO):** เรียงตาม `startMonth` → `id` · ต่อก้อน:
  - `due = min(monthlyDeduction, คงเหลือ ไม่นับเดือนนี้)`
  - `take = min(due, เงินเดือนสุทธิที่เหลือ)` ← **หักเท่าที่มี** (cap)
- บันทึก ledger ตอน admin "ยืนยันยอด" — `repayments[ym]` เขียน
  เป็น overwrite (idempotent re-confirm) + `status = "paid_off"` เมื่อครบ
- Status flow: `active → paid_off / cancelled`

Source: `src/firebase/employeeLoans.ts`, `src/utils/salaryUtils.ts` (`calculateSalary`)

## เงินค่าแทน (coverage pay)

Coverage duty (kind="coverage") ตั้ง `coveragePayPerOccurrence` (฿/ครั้ง) ได้
— คนที่ถูกเลือกเป็นคนแทน (`actualEmpId` ของ coverage assignment) ใน
yearMonth ได้เงินตอบแทน = `rate × จำนวนวัน`

- **คำนวณ:** `computeCoverageEarningsForMonth(employeeId, yearMonth, duties, employees, allLeaves)`
  ใน `src/utils/dutyUtils.ts` — replay coverage ตั้งแต่ต้นปี (จำเป็นเพื่อให้
  "เคยแทนน้อยสุด" นับถูก) · นับเฉพาะวันใน yearMonth เข้า count, รอบก่อนหน้า
  นับเข้า history เท่านั้น
- **ผู้ทำหน้าที่ประจำเดือนไม่ถูกเลือก:** `pickCoverageCandidate` exclude
  คนที่เป็น `monthly primary` ของวันนั้น (`monthlyPrimariesForDay`) — กัน
  cascade pull คนจาก monthly duty มาทำ coverage. ถ้า candidate ทุกคนเป็น
  monthly primary → `reason: "coverage_no_candidate"`
- **Stamp ที่ไหน:** `updateSalary` (`src/data/useFirebaseAppData.ts`) คำนวณ +
  เขียน `salary.coveragePay` + `salary.coveragePayBreakdown` (denorm
  สำหรับ employee view + slip)
- **เพิ่มเข้า earnings:** `calculateSalary` รวม `coveragePay` ใน `earnings`
- **แสดงที่ไหน:** SalaryAdminEdit (การ์ดแยก) · สลิป 2 path
  (`printSalarySlip.ts` + `pdfBuilders/salarySlipPDF.ts`) บรรทัด
  "เงินค่าแทน" + breakdown
- **rate = 0/undefined → ไม่จ่าย:** ไม่ stamp + ไม่ขึ้นในสลิป

**⚠️ Tradeoff — stateless replay:** ทั้ง client `computeCoverageEarningsForMonth`
และ server `replayCoverageHistory` คำนวณจากข้อมูลปัจจุบัน (employees +
candidateEmpIds + allLeaves + displayOrder) ตั้งแต่ต้นปี → ไม่ persist history.
ถ้า admin แก้ pool/candidate/displayOrder กลางปี คำนวณรอบใหม่จะให้ผลต่างจาก
snapshot รายวันที่ผ่านมา (server ก็เหมือนกัน — recompute trigger หลังทุก CRUD)
· ตอน admin "ยืนยันยอด" เดือนใด ค่า `coveragePay` ใน salary doc จะ frozen
แล้ว ไม่ถูก re-stamp ผ่าน lock 7 วัน (ดู `freezeSnapshot` ใน updateSalary)

Source: `src/utils/dutyUtils.ts` → `computeCoverageEarningsForMonth()`

## Rotation หน้าที่ — กติกาเลือกคน + fairness guarantee

การเลือก primary ของหน้าที่หมุนเวียน (weekly/monthly) ใช้ `pickPrimary` ลำดับนี้:

1. **Cache (B)** — `duty.cachedPrimary { periodIndex, empId }` เขียนโดย Cloud
   Function ตอน recompute · ใช้ถ้า periodIndex ตรง + คนยังอยู่ใน pool + ยังไม่
   ถูกหน้าที่อื่นจอง → pool เปลี่ยนกลาง period **ไม่กระทบ** คนทำหน้าที่
2. **Hash slot (A)** — `(periodIndex + hashDutyId(duty.id)) % pool.length`
   → เพิ่ม/ลบหน้าที่อื่นไม่กระทบ slot ของหน้าที่นี้
3. **Skip-collision** — ถ้า slot ที่ hash ชี้ถูกหน้าที่อื่นจองแล้ว เลื่อนหา
   คนถัดไป → หน้าที่หลายตัวใน pool เดียวกันได้คนละคนเสมอ (เมื่อคนพอ)
4. **คนใหม่** — LINE bot ตั้ง `displayOrder = max+1` เฉพาะเมื่อทุกคนมี
   displayOrder แล้ว → ต่อท้ายคิว ไม่แทรกหน้า

**Fairness guarantee (วัดจาก simulation 52 สัปดาห์):**

| สถานการณ์ | ผล |
|---|---|
| pool คงที่ | ทุกคนได้แต่ละหน้าที่เท่ากันเป๊ะ (หมุนครบทุก L period) |
| คนมากกว่าหน้าที่ | คิว "พัก" หมุนเวียนเท่ากัน |
| คนเข้า/ออกกลางปี | คลาดเคลื่อน ≤ ~7% ตามสัดส่วนเวลาที่อยู่จริง |
| เพิ่มหน้าที่กลางปี | ของเดิมไม่ขยับ · ภาระใหม่กระจายเกือบเท่า (±1 ครั้ง/ปี) |

> ออกแบบเป็น **stateless formula** (ไม่ใช่ history replay แบบ coverage)
> โดยตั้งใจ — แลก fairness ส่วนน้อยตอน churn กับความนิ่ง/คาดเดาได้ของตาราง

**⚠️ Client/server sync:** อัลกอริทึมนี้อยู่ 2 ที่ (`src/utils/dutyUtils.ts` +
`functions/src/duty/dutyUtils.ts`) — มี `scripts/check-duty-sync.mjs` เทียบ
function body ใน CI (รันใน `npm run typecheck` + ก่อน deploy functions)
ถ้าแก้ฝั่งเดียว build จะ fail

Source: `src/utils/dutyUtils.ts` → `pickPrimary()`, `assignPrimaries()`

## รายการหักจากกองกลาง (`poolAdjustments`)

admin ใส่ "จำนวนที่ไม่นับค่าคอม" ระดับเดือน — บางสินค้าไม่ได้ค่าคอม
(สินค้าโปรโมชั่นฝั่งขาย, ทองแท่ง MD ฝั่งรับซื้อ ฯลฯ) · 1 doc/เดือน

- Schema: `items: [{id, poolGroup, side: "normal"|"buy", pieces, label}]`
- **แยกตามตำแหน่ง (`poolGroup`):** หัก item ของกลุ่ม A ไม่กระทบกลุ่ม B
- **เกณฑ์ 80% ใช้ gross** (ไม่หัก) — พนักงานยังมีสิทธิ์อยู่ในกองจากยอดที่ทำ
- **กองที่หารแบ่งใช้ net:** `totalSellPoolPieces = gross − Σ items(side="normal")`
- ไม่มี side adjustment สำหรับ "ขาย-พิเศษ" (ใครขายใครได้อยู่แล้ว)

## กฎปิดรอบ 7 วัน

หลัง admin "ยืนยันยอด" แต่ละเดือน — แก้ไขได้อีก **7 วัน** นับจาก
"ยืนยันครั้งแรก" (`firstConfirmedAt`, ไม่รีเซ็ตเมื่อยืนยันใหม่). พ้นกำหนด →
**ล็อกถาวร**: ห้ามแก้ค่าคอม/เงินเดือน · ห้ามยื่น/ลบลา · ห้ามเบิกเงิน ·
ห้ามยืนยันใหม่ · ห้ามหักกองกลาง — ของเดือนนั้น

- `payrollConfirms/{ym}.lockAtMs = firstConfirmedAt + 7 วัน` (ms)
- Single source of truth: `src/utils/payrollLock.ts` (`getPayrollLock`)
- บังคับ 2 ชั้น:
  - **UI:** ปุ่ม disabled + banner "ปิดรอบแล้ว"
  - **Firestore rules:** ฟังก์ชัน `monthLocked(ym)` ใน firestore.rules
    ป้องกันการเขียน leaves/advances/salaries/payrollConfirms/poolAdjustments
    ของเดือนที่ล็อก

## ราคาทอง/เงิน + สูตรในความรู้ต่างๆ

ระบบ "ความรู้ต่างๆ" (`/knowledge`) ใช้ราคาทองสมาคม 96.5% + ราคาเงินแท่ง 99.99% สด ที่ดึงอัตโนมัติทุก 15 นาที (Cloud Function `fetchGoldPriceScheduled` · `/config/goldPrice`) → live tables + calculator default + live-example คำนวณตามราคาวันนี้

### Source chain (Cloud Function)

| Source | Endpoint | Fields |
|---|---|---|
| **mukdagold (gold · primary)** | `goldprice.mukdagold.com/api/price2` | `sellPrice`, `buyPrice`, `priceChanged`, `date`, `time` |
| **mukdagold (silver)** | `goldprice.mukdagold.com/api/silver_price` | `bidGPrice` (ซื้อ/กรัม), `askGPrice` (ขาย/กรัม รวม VAT 7%), `bidKgPrice`, `askKgPrice`, `time` |
| **HSH (gold fallback)** | `apicheckpricev3.huasengheng.com` REF struct | `Buy`, `Sell`, `SellChange`, `TimeUpdate` |

Sanity check: gold 10,000–200,000 ฿/บาท · silver 10–200 ฿/กรัม · silver fail = silent skip (ไม่กระทบ gold)

### Constants

| Constant | Value | ใช้ทำอะไร |
|---|---|---|
| 0.0656 | 1/15.244 | แปลงราคา ฿/บาท → ฿/กรัม (ทองคำแท่ง 1 บาท = 15.244 ก.) |
| 3.6% | × 1.036 | ราคาทอง 99.99% = ราคาทอง 96.5% × 1.036 |
| 3.1% | × 0.031 | ค่าเปลี่ยน นน. เท่ากัน — สัดส่วนของเนื้อทอง |
| 85% | × 0.85 | ค่าเปลี่ยน — ส่วนของค่าแรงเริ่มต้น (after discount) |
| 50% | × 0.5 | นาก (สัดส่วน gold-copper alloy) |
| 25% | × 0.25 | ค่าเปลี่ยนนาก ปกติ (ไม่ตรวจ %) |
| 60% | × 0.6 | ค่าเปลี่ยนทอง 90 ปกติ (ไม่ตรวจ %) |
| 98% | × 0.98 | VAT ราคารับซื้อคืน = ราคารับซื้อทองคำแท่ง × 98% |
| ปัดทวีคูณ 50 ฿ | `ceilTo50()` | ค่าเปลี่ยน นน. เท่ากัน เริ่มต้น |

### น้ำหนัก + ค่าแรงเริ่มต้น (ทองรูปพรรณ 96.5%)

ค่า default จาก `CHANGE_PRICE_WEIGHTS` ใน `src/utils/changePriceUtils.ts` · **admin override** ได้ที่ตาราง "ค่าแรง เริ่มต้น" ใน /knowledge (สิทธิ์ admin) → `/config/laborCost` · `getWeightsWithLabor(overrides)` merge default + override

| น้ำหนัก | id | grams | ค่าแรง default |
|---|---|---|---|
| 0.6 กรัม | `0.6g` | 0.6 | 450 |
| 1 กรัม | `1g` | 1.0 | 550 |
| ½ สลึง | `half-saleung` | 1.895 | 650 |
| 1 สลึง | `1-saleung` | 3.79 | 750 |
| 2 สลึง | `2-saleung` | 7.58 | 850 |
| 3 สลึง | `3-saleung` | 11.37 | 950 |
| 1 บาท | `1-baht` | 15.16 | 1,050 |
| 6 สลึง | `6-saleung` | 22.74 | 1,900 |
| 2 บาท+ | `2-baht-plus` | 15.16 | 1,050 (ต่อบาท · `perBaht: true`) |

### สูตรราคาขาย 96.5%

`computeSellPrice96` ใน `src/utils/changePriceUtils.ts` — multiplier shortcut:

```ts
// ½ สลึง = ราคาทอง × 0.125 + ค่าแรง
// 1 สลึง = ราคาทอง × 0.25  + ค่าแรง
// 2 สลึง = ราคาทอง × 0.50  + ค่าแรง
// 3 สลึง = ราคาทอง × 0.75  + ค่าแรง
// 1 บาท  = ราคาทอง        + ค่าแรง
// 6 สลึง = ราคาทอง × 1.50  + ค่าแรง
// อื่นๆ  = (ราคาทอง × 0.0656 × grams) + ค่าแรง
// 2 บาท+ = (ราคาทอง + ค่าแรงต่อบาท) × จำนวนบาท
```

### สูตรราคารับซื้อ 96.5%

`computeBuyPrice96`: `(ราคาทอง × (1 − discount%)) × 0.0656 × น้ำหนักสินค้า`
- discount เลือกได้ 5% / 6% / 7% ใน BuyPrice96Table

### สูตรราคาขายทอง 99.99%

```
ราคาทอง 99.99% = ราคาทอง 96.5% × 1.036
ราคา/กรัม = ราคา 99.99% × 0.0656
ราคาขาย/ชิ้น = (ราคา/กรัม + ค่าแรง) × น้ำหนักสินค้า(g)
```

### สูตรราคารับซื้อทอง 99.99%

ทั่วไป: `(ราคาทอง − 5-7%) × 0.0656 × น้ำหนักสินค้า = ราคารับซื้อ`

### สูตรค่าเปลี่ยน นน. เท่ากัน เริ่มต้น

`computeChangePriceBreakdown` ปัดทวีคูณ 50 ฿:
```
goldPart  = ราคาทอง × 0.0656 × grams × 3.1%
laborPart = ค่าแรงเริ่มต้น × 85%
total     = ceilTo50(goldPart + laborPart)
```

### สูตรราคารับซื้อทอง 90 / นาก / เงิน

| | ทั่วไป | มีตรวจ % |
|---|---|---|
| ทอง 90 | `gold × 60% × 0.0656 × น้ำหนักสินค้า` | `gold × (realPct − 10)% × 0.0656 × น้ำหนักสินค้า` |
| นาก | `gold × 25% × 0.0656 × น้ำหนักสินค้า` | `gold × (realPct − 10)% × 0.0656 × น้ำหนักสินค้า` |
| เงิน | `silverBuyPerGram × น้ำหนักสินค้า` (live mukdagold) | — |

### สูตรราคาขายนาก

`(ราคาทอง × 0.50) × 0.0656 × น้ำหนักสินค้า + ค่าแรง = ราคาขาย`

### สูตรราคาขาย/รับซื้อเงิน (live silver price)

- ขาย: `(silverSellPerGram × น้ำหนักสินค้า) + ค่าแรง`
- รับซื้อ: `silverBuyPerGram × น้ำหนักสินค้า` (ไม่มีค่าแรง)
- ราคาเงินจาก `gold.silverSellPerGram` (รวม VAT 7%) / `gold.silverBuyPerGram`

### สูตรราคาจำนำ + ดอกเบี้ย

| ประเภท | อัตราหัก |
|---|---|
| ทอง 99.99% | หัก 15-20% จากราคารับซื้อทองคำแท่ง |
| ทอง 96.5% | หัก 15-20% จากราคารับซื้อทองคำแท่ง |
| ทอง 90 | หัก 40-50% · ตรวจ % = realPct − 25% |
| นาก | หัก 80-85% · ตรวจ % = realPct − 25% |
| เงิน 99.99% | หัก 30-35% · ตรวจ % = realPct − 35% |

ดอกเบี้ย: 1.5% ต่อเดือน · แบ่ง 2 ช่วง (1-15 วัน 0.75% / 16-31 วัน 1.5%) · ขั้นต่ำ 30 ฿

### VAT ทองรูปพรรณ 96.5% (VAT นอก)

```
1. ราคาขาย    = (ราคาทอง × 0.0656 × น้ำหนักสินค้า) + ค่าแรง (ตามตาราง)
2. ราคารับซื้อคืน (VAT) = (ราคารับซื้อทองคำแท่ง × 98%) × 0.0656 × น้ำหนักสินค้า
3. ฐานภาษี    = ราคาขาย − ราคารับซื้อคืน (VAT)
4. VAT       = ฐานภาษี × 7%
```

Calculator: ช่อง "ราคารับซื้อคืน (VAT)" เป็น **read-only** · sync `buy × 98%` ตลอด (CalcField: `buyPriceMultiplier: 0.98 + readOnly: true`)

### MD แยกชิ้น

MD-XX = XX × 100 ฿ (เช่น MD-03 = 300, MD-08 = 800) — บวกเพิ่มต่อชิ้นตามที่ระบุ

### ส่วนลด (ทอง/นาก/เงิน · ทองคำแท่ง + เงินแท่ง ไม่ร่วม)

| ประเภท | ปกติ | HBD |
|---|---|---|
| ทอง 99.99% (ค่าแรงขาย/กรัม + ค่าแรงขาย) | ลด 15% | ลด 25% |
| ทอง 96.5% (ค่าแรงขาย) | ลด 15% | ลด 25% |
| ค่าเปลี่ยน 96.5% | ลด 5% | ลด 5% |
| ทอง 90 — ต่างหู/พระแผง (ราคาขาย) | ลด 10% | ลด 15% |
| ทอง 90 — ต่างหู/กรอบพระ/Italy 18k (ค่าแรงขาย) | ลด 15% | ลด 25% |
| นาก (ค่าแรงขาย) | ลด 15% | ลด 25% |
| เงิน (ค่าแรงขาย) | ลด 15% | ลด 25% |
