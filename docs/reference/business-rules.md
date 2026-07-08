# Business Rules — สูตรเงินเดือนและกฎธุรกิจ

Config ทั้งหมดอยู่ใน `src/constants.ts` → `BUSINESS_RULES`

## สูตรเงินเดือน (calculateSalary)

```
Earnings = baseSalary                  (effective = baseSalary + Σ annualRaises ≤ year ·
                                        0 ถ้า losesBaseSalary หรือ salaryDisabled)
         + Σ pieceBreakdown.amount      (multi-item piece commission · non-pool roles)
         + Σ poolItemsBreakdown.amount  (multi-item pool sales · admin custom items)
         + Σ bonusBreakdown.amount      (multi-item "โบนัสอื่นๆ" · admin custom +
                                         default 2 รายการ · ไม่แบ่งกองกลาง)
         + attendanceBonus              (0 ถ้า losesBaseSalary · 0/1/2× dailyRate)
         + coveragePay                  (เงินค่าแทน — coverage duty × จำนวนครั้งที่แทน)
         + saturdayExtraPayEarnings     (เสาร์เปิดพิเศษที่ admin tick "จ่ายเพิ่ม" ·
                                         dailyRate × จำนวนเสาร์ที่ทำงาน)
         + Σ recurringEarnings          (รายรับประจำเดือน admin ตั้งใน employee profile ·
                                         ใช้ทุกเดือนจนกว่าจะลบ · เช่น ค่าเดินทาง · เบี้ยขยัน)
         + Σ customEarnings             (per-month admin เพิ่มเอง · ไม่เป็นประจำ)

Deductions = overQuotaDeduction
           + advanceDeduction       (รวม approved advances ที่ month === salary.month)
           + loanDeduction          (เงินกู้ผ่อนคืน — 1 ก้อน/คน · หักเท่าที่มี)
           + socialSecurity
           + Σ recurringDeductions  (รายจ่ายประจำเดือน admin ตั้งใน employee profile)
           + Σ customDeductions     (per-month admin เพิ่มเอง · ไม่เป็นประจำ)

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

### การนับ "วันลา" — 3 บริบท (อย่าสับสน · เลขต่างกันได้โดยตั้งใจ)

ระบบแสดง "วันลา" หลายที่ด้วย scope การนับต่างกัน — **ทุกตัวถูกต้องในบริบทของมัน**:

| ที่แสดง | นับอะไร | ฟังก์ชัน |
|---|---|---|
| **โควต้า** (HomeTab quota card · RequestTab "x / 2 วัน") | วันธรรมดาที่ร้านเปิด · **ไม่นับอาทิตย์** (อาทิตย์หัก × 1.5 แยก ไม่กินโควต้า) | `countWeekdayLeaves` |
| **chip "ลากิจ/ลาป่วย เดือนนี้"** (HomeTab mini stats) | **วันลาที่ร้านเปิดจริง** แยกตามประเภท · นับอาทิตย์เปิด + เสาร์เปิดพิเศษ · **ตัดวันร้านปิด** (เสาร์ปิด/วันปิดพิเศษ/admin แก้เปิด→ปิด) · เป็นแค่ตัวบอกจำนวนวัน **ไม่เกี่ยวกับ logic เงิน** | `dateRange` + `!isStoreClosed` |
| **กองกลาง** (pool deduction · PoolFlowModal "ลา x วัน") | weekday + sunday (= วันลาที่ร้านเปิดทั้งหมด) · ใช้หักกองกลาง (2 วันแรกฟรี) | `totalLeaveDays` snapshot (`weekdayLeaves + sundays`) |

**ตัวอย่าง** (มิ.ย. · ลากิจ 10(พ),20(ส·เปิดพิเศษ),21(อา·เปิด),23(อ),29(จ),30(อ)):
- โควต้า = **5** (ตัดอาทิตย์ 21) · chip ลากิจ = **6** (รวมอาทิตย์ + เสาร์เปิด) · pool totalLeaveDays = **6**

> chip mini stats (รวมทุกประเภท) จะเท่ากับ `totalLeaveDays` ของกองกลางเสมอ (ทั้งคู่ = วันลาที่ร้านเปิด) — ต่างกันแค่ chip แยกตามประเภทและไม่นำไปคิดเงิน

**UI cue:** ในประวัติการลา (RequestTab) ใบลาที่คร่อมวันอาทิตย์ที่ร้านเปิดจะมี badge **"อาทิตย์ ×1.5"** (ไอคอน `Sun`) เพื่อสื่อว่าวันนั้นหัก × 1.5 ไม่กินโควต้าวันธรรมดา (`hasDeductibleSunday`)

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

## Pool Commission System ("กองกลาง") — Item-based Architecture

> UI ภาษาไทยเรียกระบบนี้ว่า **"กองกลาง"** · code/เอกสารเรียก `pool`
> **PR #488-#516** เปลี่ยนจาก hardcode 3 ฝั่ง (normal/special/buy) → admin custom items per role

### Role config: `poolItems`

แต่ละ role pool group กำหนด `poolItems` ได้อิสระ · 1 item = 1 ประเภท commission:

```ts
interface PoolItem {
  id: string;
  label: string;
  kind: "pool" | "personal";
  threshold: number;  // % ของ top item ที่ต้องถึงเพื่อเข้ากอง (0-100, default 80)
}
```

- **kind="pool"** — แชร์กองกลาง · มี threshold % ต่อ item · admin custom ได้
- **kind="personal"** — ส่วนตัว · ไม่เข้ากองกลาง · ไม่ถูกหักลา (`finalSharePercent=100` คงที่)
- **`Role.primaryPoolItemId`** — primary item สำหรับ `losesBaseSalary` check (default item แรก kind=pool)

**Default migration** (legacy role ที่ไม่มี `poolItems`):
```
[
  { id: "normal",  label: "ขายทั่วไป", kind: "pool",     threshold: 80 },
  { id: "special", label: "ขายพิเศษ", kind: "personal", threshold: 80 },
  { id: "buy",     label: "รับซื้อ",   kind: "pool",     threshold: 80 },
]
primaryPoolItemId: "normal"
```

### ขั้นตอน (per kind=pool item)

1. รวบรวมทุกคนใน pool group เดียวกัน (`role.poolGroup`)
2. **per-item top:** `topItemPieces[itemId] = max(itemPieces[empId][itemId] ทุกคน)`
3. **กฎ threshold (per-item)** — เกณฑ์เข้ากองแต่ละ item:
   `itemPieces[empId][itemId] ≥ topItemPieces[itemId] × (poolItem.threshold / 100)`
   - ต่ำกว่าถูกตัดออกจากกอง item นี้
   - admin custom threshold per item (default 80% เหมือนเดิม)
   - **ข้อยกเว้น (duty):** `poolThresholdExempt=true` → ผ่าน threshold ของ**ทุก item** อัตโนมัติ
4. นับ `eligibleEmployeeCount` per item (n) = จำนวนคนที่ยังเหลือใน pool item นั้น
5. **เปอร์เซ็นต์ฐาน:** `baseSharePercent = 100 / n` (per item)
6. **ตัวคูณหักวันลา:** `leaveDeductionFactor = baseSharePercent / 30` (per item · ต่างกันตาม n)
7. **วันลาที่ใช้คำนวณ:** `effectiveLeave[i] = max(0, totalLeave[i] − 2)` — 2 วันแรกฟรี
8. **% หัก** ของแต่ละคน: `leaveDeductionPercent[i] = effectiveLeave[i] × leaveDeductionFactor × (n − 1)`
9. **% แบ่งให้เพื่อนร่วมงาน:** `redistributedPercent[i] = leaveDeductionPercent[i] / (n − 1)`
10. **% สุทธิ:** `finalSharePercent[i] = base − myDeduction + Σ(% ที่เพื่อนร่วมงานแบ่งให้)`
11. **Pool รวม** ของ item: `grossItemPool[itemId] = Σ pieces ทุกคน` · หัก `excludedByItemId[itemId]` (จาก `poolAdjustments`) → `totalItemPool[itemId]`
12. **ชิ้นที่ได้:** `allocatedPieces[i] = (finalSharePercent[i] / 100) × totalItemPool[itemId]`

#### kind="personal" item
- `finalSharePercent = 100` · `allocatedPieces = myPieces` (ส่วนตัว)
- ลาไม่กระทบ
- **แต่เคารพ `poolExclusion`** (PR #516 fix) — ถ้า admin tick personal item ใน exclusion → ตัด commission ของ item นี้

### Base Salary Threshold (50% rule)

**ถ้า `poolExclusion="all"` (หรือ legacy `"both"`):**
- เช็ค `myPrimaryPieces < topItemPieces[primaryPoolItemId] × 0.5`
- True → `losesBaseSalary = true` → ไม่ได้ baseSalary + attendanceBonus
- **Primary item input ใน SalaryAdminEdit ยัง enable แม้ "ปิดทั้งหมด"** (PR #515) — เพื่อให้ admin ใส่ pieces ของ primary มาเช็ค 50% ได้

> ถ้า `topPrimaryPieces=0` (ไม่มีใครมี pieces ของ primary item) → check ข้าม (`losesBaseSalary=false`)

### `poolExclusion` Field (ใหม่ — flexible variants)

| Value | ผล |
|---|---|
| `null` / `""` | ไม่ปิด · เข้าทุก pool item |
| `string[]` (array) | ปิดเฉพาะ item ids ที่ระบุ (per-item exclusion) |
| `"all"` | ปิดทุก item + 50% rule บน primary item |
| `"both"` (legacy) | migrate → "all" |
| `"sell"` (legacy) | migrate → `["normal", "special"]` |
| `"buy"` (legacy) | migrate → `["buy"]` |

`resolvePoolExclusionItemIds(exclusion, poolItems)` → `{ excludedIds: Set, isAll: bool }` ใช้ทุก surface (calc + UI)

### `poolAdjustments` (per-item routing · PR #506)

```ts
interface PoolAdjustmentItem {
  poolGroup: string;
  poolItemId?: string;  // PR #506: admin เลือก pool item ที่จะหัก
  side?: "normal" | "buy";  // legacy fallback (migrate → poolItemId)
  pieces: number;
  label: string;
}
```

Calc engine routes via `excludedByItemId[poolItemId]` · per-item deduction · รองรับ custom items

### Snapshot (สำคัญสำหรับ employee view)

พนักงานอ่าน `employees` / `leaves` ของคนอื่นไม่ได้ (ปิดสิทธิ์) — ตอน admin save salary ระบบเขียน snapshot ลง salary doc:

| Field | จาก |
|---|---|
| `roleId` | `employee.roleId` ปัจจุบัน |
| `poolExclusion` | `employee.poolExclusion` |
| `totalLeaveDays` | `weekdayLeaves + sundayLeaves` ของเดือนนั้น |
| `poolItemRates` | `employee.poolItemRates` (map per item id) |
| `poolItemPieces` | per-month count ต่อ item (จาก SalaryAdminEdit) |
| `bonusRates` | `employee.bonusRates` (map per bonus item id) |
| `bonusCounts` | per-month count ต่อ bonus item |
| `pieceRates` | `employee.pieceRates` (map per piece item id, non-pool roles) |
| `coveragePay`/`coveragePayBreakdown` | จาก `computeCoverageEarningsForMonth` · **preserve เดิมถ้า re-save** (PR #516 fix Bug E) |

`computePoolSharesForGroup` ใช้ snapshot ก่อนเสมอ (fallback ไป live data เฉพาะ admin ที่อ่านได้เต็ม) — admin/employee เห็นเลขตรงกัน

mirror ชุดเดียวกัน + `poolItemPieces` ลง `poolSnapshots/{ym}` (public, ไม่มี field อ่อนไหว) → employee-side calc เห็น peers' custom items
ดู [`../reference.md`](../reference.md) → "Privacy: salaries vs poolSnapshots"

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
| ลาป่วยล่วงหน้า ≤ 2 อาทิตย์ | `sick` เลือกวันได้ไม่เกิน `TODAY + 14` วัน | "ลาป่วยล่วงหน้าได้ไม่เกิน 2 อาทิตย์" |

- ลากิจ (`personal`) ไม่มีข้อจำกัดล่วงหน้า (ลาล่วงหน้าได้)
- **UI ป้องกันชั้นแรก:** `RequestTab` ปฏิทินวันที่เริ่ม/สิ้นสุด cap `maxDate = TODAY+14` เมื่อเลือกลาป่วย · `validate()` เป็น defense layer
- **ผู้ดูแล (admin)** เพิ่มใบลาให้พนักงานผ่าน `LeaveListPanel` ได้โดยไม่ติดกฎเหล่านี้ (override เคสลืมกดลา)

Source: `src/utils/leaveUtils.ts` · `src/hooks/useLeaveForm.ts` · `src/components/home/RequestTab.tsx`

## ปฏิทินเปิด-ปิดร้าน (storeCalendar)

ร้านหยุดวันเสาร์เป็นค่าตั้งต้น · admin override ผ่าน `/config/storeCalendar`:

```ts
interface StoreCalendar {
  extraOpenSaturdays: string[];    // "YYYY-MM-DD" · เสาร์เปิดพิเศษ
  paidExtraSaturdays: string[];    // "YYYY-MM-DD" · เสาร์เปิดพิเศษ + "จ่ายเพิ่ม 1 วัน"
                                   //                (saturdayExtraPayEarnings ใน slip)
                                   //                ต้องเป็น subset ของ extraOpenSaturdays
  extraClosedWeekdays: string[];   // "YYYY-MM-DD" · จ-ศ ปิดพิเศษ (อบรม/หยุดยาว)
  extraClosedSundays: string[];    // "YYYY-MM-DD" · อาทิตย์ปิดพิเศษ
                                   //                (ลาไม่นับ + ไม่หัก × 1.5)
}
```

**Default vs override:**

| Day | Default | Override key | Counts as |
|---|---|---|---|
| อาทิตย์ | เปิด (× 1.5) | `extraClosedSundays` (ปิด) | ลาในวันเปิด = หัก × 1.5 · ลาในอาทิตย์ปิดพิเศษ = ไม่นับ ไม่หัก |
| **เสาร์** | **ปิด** | `extraOpenSaturdays` (เปิด) · `paidExtraSaturdays` (เปิด + จ่ายเพิ่ม) | ลาในวันปิด = ไม่นับ · ลาในเสาร์เปิดพิเศษ = วันธรรมดา · `paidExtraSaturdays` เพิ่ม `dailyRate` ลง `saturdayExtraPayEarnings` ของทุกคนที่ทำงานวันนั้น |
| จ-ศ | เปิด | `extraClosedWeekdays` (ปิด) | ลาในวันเปิด = นับ · ลาในวันปิดพิเศษ = ไม่นับ |

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

- **เพดาน % ของ effective base salary (รวม raises) — ขึ้นตามอายุงาน:**
  | อายุงาน | เพดาน |
  |---|---|
  | <3 ปี | 50% |
  | ครบ 3 ปี | 60% |
  | ครบ 4 ปี | 70% |
  | ครบ 5 ปี | 80% |
  | ครบ 6 ปี+ | 100% |
  Source: `src/utils/advanceUtils.ts` → `ADVANCE_LIMIT_TIERS`
- **1 ครั้ง/เดือน** — pending/approved บล็อกยื่นใหม่ในเดือนเดียวกัน · rejected เท่านั้นที่ยื่นใหม่ได้ · auto-carry (`autoCarryFromMonth` ตั้ง) ไม่นับ
- Status flow: `pending → approved / rejected`
- Approved → **หักจากเงินเดือน "ในเดือนที่เบิก"** (ไม่ใช่เดือนถัดไป) · advance.month = ตอนยื่น · `monthApprovedAdvances` รวมเป็น `advanceDeduction` ในสลิปเดือนเดียวกัน
- พนักงาน**ขอเอง** · admin อนุมัติ/ปฏิเสธ + แนบสลิปการโอน (storage `loanSlips/{advanceId}/`)
- บล็อกการเบิกในวันสุดท้ายของเดือน (วันทำเงินเดือน)
- LINE notification: แจ้ง admin เมื่อมีคำขอ, แจ้งพนักงานเมื่อ approve/reject
- Cleanup: Cloud Function ลบ advances เกิน 6 เดือน (ทุกวันที่ 1)

### Auto-carry advance (เงินสุทธิติดลบ → ยกไปเดือนถัดไป)

**ปัญหาที่แก้:** ถ้า earnings - deductions < 0 ในเดือน X (เช่น advance ทุก ๆ tier + ค่าหักอื่นเกิน earnings) · เงินสุทธิ "ติดลบ" บนกระดาษ · ต้องจัดการนอกระบบ + กัน chain หนี้

**Flow:**
1. Admin ยืนยันยอดเดือน X · `salary.netSalary < 0`
2. `denormalizeNetSalaries()` เขียน `salary.netSalary` (เป็นลบได้) + clear `deficitClearedAt: null`
3. `syncAutoCarryAdvances()` สร้าง advance ใหม่ใน month X+1:
   - `status: "approved"` (ไม่ผ่าน pending)
   - `amount: |net|`
   - `autoCarryFromMonth: "X"` (marker)
   - `reason: "ยกจากเงินสุทธิติดลบเดือน X"`
4. AdvanceRequestModal:
   - **บล็อก**พนักงานยื่นเบิกใหม่ในเดือน X+1 (banner แดง · ปุ่ม disabled)
   - แสดง info banner: "ยกมาจากเดือน X ฿N · จะถูกหักอัตโนมัติ"
   - auto-carry ไม่นับใน "1/month" rule (system-generated) แต่นับใน tier limit
5. Admin override (ปุ่ม "อนุญาตให้ยื่นเบิกใหม่"): set `salary.deficitClearedAt = ISO`
   - ปลด**เฉพาะการบล็อก**ยื่นเบิกใหม่ · auto-carry ยังหักปกติ
6. Admin re-confirm หลังแก้ salary fields ให้ net เป็นบวก:
   - `syncAutoCarryAdvance(deficit=0)` → **ลบ** auto-carry advance
   - `denormalizeNetSalaries()` set `deficitClearedAt: null`

**Idempotency:** `syncAutoCarryAdvance` เช็ค existing advance ที่ `autoCarryFromMonth === sourceMonth + employeeId` → update amount ถ้าเปลี่ยน · create ใหม่ถ้าไม่มี · ลบถ้า deficit = 0

Source: `src/data/useFirebaseAppData.ts` (`syncAutoCarryAdvance`) · `src/components/admin/PayrollSummaryPanel.tsx` (denormalize + sync + UI) · `src/components/modals/AdvanceRequestModal.tsx` (block + info)

## ระบบเงินกู้ผ่อนคืน (`employeeLoans`)

ต่างจากเบิกล่วงหน้า — **admin สร้างเอง** + หักจากเงินเดือนอัตโนมัติทุกเดือน
จนครบ โดยใช้ **ledger** เก็บยอดที่หักจริงรายเดือน

- **กฎสำคัญ: 1 active loan ต่อพนักงาน** — admin ห้ามสร้างใหม่จนกว่าก้อนเดิม
  จะ `paid_off` หรือ `cancelled` · UI block ใน CreateLoanModal:
  · banner แดงเตือน + ปุ่ม submit disabled
  · dropdown พนักงาน — option ที่มี active loan ถูก `disabled` + suffix
    "— มีเงินกู้ค้าง"
  · default selection auto-switch ไปคนแรกที่ "ว่าง"
- ฟิลด์หลัก: `principal` (เงินต้น) · `monthlyDeduction` (ผ่อนเดือนละ) ·
  `startMonth` · `status` · `repayments[ym]` (ledger) · `slipImageUrl?`
  (สลิปการโอน · admin upload ตอนสร้าง)
- คงเหลือ = `principal − Σ repayments`
- **สูตรหัก:** ต่อเดือน:
  - `due = min(monthlyDeduction, คงเหลือ ไม่นับเดือนนี้)`
  - `take = min(due, เงินเดือนสุทธิที่เหลือ)` ← **หักเท่าที่มี** (cap)
  - หมายเหตุ: code ยัง support FIFO หลายก้อน (`buildLoanContext` เรียงตาม
    `startMonth` → `id`) เผื่อ admin cancel ก้อนแล้วเปิดใหม่กลางเดือน · แต่
    UI ใหม่กรอง 1 ก้อน/คน → FIFO loop รัน 1 รอบ
- บันทึก ledger ตอน admin "ยืนยันยอด" — `repayments[ym]` เขียน
  เป็น overwrite (idempotent re-confirm) + `status = "paid_off"` เมื่อครบ
- Status flow: `active → paid_off / cancelled`
- **LINE notification (ตอนสร้าง):** Cloud Function `processLoanNotifications`
  (scheduled `* * * * *`) push flex message + รูปสลิป (ถ้ามี) ไปที่
  `employee.lineUserId` · admin toggle เปิด/ปิดผ่าน `loanCreatedEnabled`
- **พนักงานเปิดดูสลิป:** ปุ่ม "สลิป" มุมขวาบน loan card ใน /salary →
  modal โชว์รูปเต็มจอ · storage rule `loanSlips/{loanId}/*` จำกัด read
  เฉพาะ admin + loan owner

Source: `src/firebase/employeeLoans.ts`, `src/utils/salaryUtils.ts` (`calculateSalary`), `functions/src/loan/processLoanNotifications.ts`

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
- **โชว์ "สด" ใน preview (ก่อน admin ยืนยันยอด):** server คำนวณเงินค่าแทนเดือน
  ปัจจุบันของ**ทุกคน**ลง snapshot `dutyAssignmentsToday.coverageThisMonth`
  (`computeCoverageEarningsForMonthAll` — replay รอบเดียว ตรงกับ per-employee
  เป๊ะ) · `SalaryView` inject ค่านี้เข้า `previewData.coveragePay` เฉพาะเดือน
  ปัจจุบัน + ยังไม่ยืนยันยอด → พนักงานเห็นยอดทันทีที่ถูกเลือกมาแทน (กำลังใจ) ·
  ถ้าคนแทนลาเอง วันนั้นระบบเลือกคนถัดไป (fairness) ยอดขยับตามสด · เดือนที่
  ยืนยันแล้ว/อดีต → ใช้ค่าที่ stamp (freeze) ตามเดิม · privacy: ยอด derivable
  จาก coverageForecast + rate (public) อยู่แล้ว ไม่ leak เพิ่ม

**⚠️ Tradeoff — stateless replay:** ทั้ง client `computeCoverageEarningsForMonth`
และ server `replayCoverageHistory` คำนวณจากข้อมูลปัจจุบัน (employees +
candidateEmpIds + allLeaves + displayOrder) ตั้งแต่ต้นปี → ไม่ persist history.
ถ้า admin แก้ pool/candidate/displayOrder กลางปี คำนวณรอบใหม่จะให้ผลต่างจาก
snapshot รายวันที่ผ่านมา (server ก็เหมือนกัน — recompute trigger หลังทุก CRUD)
· `coveragePay` refresh สดทุกครั้งที่ updateSalary ตราบใดที่เดือนยัง**ไม่ยืนยันยอด**
(ให้ตรงกับ preview สดฝั่งพนักงานเสมอ) · เดือนที่ยืนยันแล้ว (grace/locked) →
preserve ค่าเดิม กันยอดทางการ/สลิปขยับเงียบหลังยืนยัน (ดู `preserveCoverage`
ใน updateSalary) ส่วน
เรท/ตำแหน่ง/baseSalary จะ freeze ถาวรเมื่อ**ปิดรอบ** (พ้น grace 7 วัน) เท่านั้น
— ระหว่าง grace period (ยืนยันแล้วแต่ยังไม่ครบ 7 วัน) ยัง re-stamp เรทสดได้
ตามกฎ "ยังแก้ได้" (ดู `freezeSnapshot = monthLocked(...)` ใน updateSalary)

Source: `src/utils/dutyUtils.ts` → `computeCoverageEarningsForMonth()`

### ดูคนแทนล่วงหน้า (coverage forecast)

หน้าที่แบบ coverage forecast ด้วย rotation period ไม่ได้ (ต้องรู้ว่าคนใน
ตำแหน่งเป้าหมายลาวันไหนจากใบลาที่ยื่นไว้) → คำนวณ **ฝั่ง server** เขียนลง
snapshot `dutyAssignmentsToday.coverageForecast[]` ให้ **ทุกคน (รวมพนักงาน)**
อ่านได้ (พนักงานอ่าน peer employees/leaves เองไม่ได้ตาม privacy rules)

- **คำนวณ:** `computeCoverageForecast(duties, employees, allLeaves, todayYmd, endYmd)`
  ใน `src/utils/dutyUtils.ts` (client · tested) + mirror `functions/src/duty/dutyUtils.ts`
  (server · ใช้จริงใน `recompute.ts` → snapshot) — replay ตั้งแต่ต้นปีเพื่อ
  seed history ยุติธรรม แล้วบันทึกผลเฉพาะวัน `>= today` → สิ้นปี · จับวันต่อเนื่อง
  ที่คนแทนคนเดิมเป็นช่วงเดียว (segment) · ใช้ helper ชุดเดียวกับ coverage จริง
  (`pickCoverageCandidate` / `monthlyPrimariesForDay` / `dutyAbsentTargets`) →
  forecast ตรงกับที่มอบหมาย/จ่ายจริง
- **แสดงที่ไหน:** ปุ่ม "ดูล่วงหน้า" → `DutyForecastModal` (การ์ด amber แยกต่อ
  ช่วงวัน · "{คนที่ลา} ลา → {คนแทน} แทน") · admin เห็นทุกคน · พนักงาน toggle
  "เฉพาะของคุณ" (เห็นเมื่อฉันเป็นคนแทน หรือฉันคือคนที่ลา)
- **rotation ล่วงหน้ายังคำนวณ client-side** (`computeDutyForecast`) จาก snapshot
  pool เดิม — coverage เพิ่มเป็นข้อมูลใหม่ใน snapshot ไม่กระทบของเดิม

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

**คนแทนตอน primary ลา (substitute):**
- **monthly** — เลือกแบบไม่ซ้ำ "เคยแทนน้อยสุดก่อน" (`pickRotationSubstitute` +
  `replayRotationSubHistory` replay ตั้งแต่ต้นปี · sync client/server ผ่าน
  check-duty-sync) — primary ของ monthly คงที่ทั้งเดือน ถ้าใช้ neighbor-scan
  คนถัดไปในลำดับจะโดนซ้ำทุกครั้ง · เสมอกัน tie-break ตามลำดับ pool ต่อจาก
  primary · ลาต่อเนื่องหลายวัน → สลับคนแทนรายวัน (ยุติธรรมแบบเดียวกับ
  coverage duty) · replay ประมาณ primary เดือนก่อนๆ จาก pool ปัจจุบัน
  (stateless tradeoff เดียวกับ coverage)
- **weekly** — neighbor-scan เดิม (คนถัดจาก primary ในลำดับ pool · ข้ามคนลา/
  คนติดหน้าที่อื่น) — primary หมุนทุกสัปดาห์ โอกาสซ้ำต่ำ
- **`substituteExcludedEmpIds`** — admin ตั้งต่อหน้าที่ว่าใคร "ไม่ให้เป็นคนแทน"
  (ยังหมุนเป็นเวรหลักได้ตามปกติ · ต่างจาก `excludedEmpIds` ที่ตัดออกจากทั้งหมด) ·
  ข้ามทั้ง 2 pass ของ substitute-scan (weekly + monthly + forecast) · ถ้าตั้ง
  จนไม่เหลือคนแทน วันนั้นขึ้น "ไม่มีคนแทน" (admin เลือกเอง) · UI: DutyEditModal
  section "ไม่ให้เป็นคนแทน" (chip amber ต่อคน) · ไม่กระทบ coverage duty (ใช้
  `candidateEmpIds` allowlist แทน)

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

### Pool membership — ใครเข้ารอบหน้าที่ (`resolveDutyPool`)

pool ของหน้าที่หมุนเวียน = พนักงานในตำแหน่ง (`roleId`) ที่ **ไม่** `salaryDisabled`
และ **ไม่** อยู่ใน `duty.excludedEmpIds` (admin ตัดออกเอง) · เรียงตาม `displayOrder`

- **หน้าที่ประจำเดือน (period="monthly") บล็อกคนที่ปิดกองกลางทั้งหมด:** คนที่
  `poolExclusion = "all"` (legacy `"both"`) ถูก**ตัดออกจาก pool อัตโนมัติ** —
  ติดหน้าที่ทั้งเดือนเสี่ยงหลุดเกณฑ์เงินเดือนพื้นฐาน 50% โดย exemption ช่วยไม่ได้
  (exemption ยกเว้นแค่เกณฑ์ 80%) · weekly ไม่บล็อก
- **พรีวิวใน DutyEditModal สะท้อนกฎเดียวกัน:** คนที่ถูกบล็อกขึ้น chip "ปิดกองกลาง"
  (ขีดฆ่า · กดสลับไม่ได้) + ตัดออกจาก `includedCount` → เลข "ลำดับการสลับ" ตรงกับ
  การ์ดหน้าที่ (DutyCard อ่านจาก snapshot จริง) เป๊ะ
- **`grantsPoolEligibility`** (monthly เท่านั้น) — ให้สิทธิ์เข้ากองกลางแม้ขาย/ซื้อ
  ไม่ถึง 80% (ยังเคารพฝั่งที่ admin ปิด · ไม่กระทบเกณฑ์ 50%) · DutyCard ขึ้น badge
  "ให้สิทธิ์กองกลาง"
- **`skipSundays`** (weekly เท่านั้น) — ข้ามวันอาทิตย์ (ให้ focus ขาย) · หน้าที่นี้
  ไม่โผล่ใน "หน้าที่วันนี้" ของวันอาทิตย์ (`applicableDuties` filter) · DutyCard ขึ้น
  badge "ข้ามวันอาทิตย์"

Source: `resolveDutyPool()` / `applicableDuties()` (client + server `dutyUtils.ts`)

## รายการยกเว้นค่าคอม (`poolAdjustments`) — Per-item routing

admin ใส่ "จำนวนที่ไม่นับค่าคอม" ระดับเดือน · 2 variants:

### 1. Pool variant (หักจากกองกลาง)
```ts
{ kind: "pool", poolGroup: string, poolItemId: string, pieces: number, label: string }
```
- `poolItemId` — admin เลือก pool item ที่จะหัก (PR #506)
- legacy `side: "normal"|"buy"` → migrate-on-read เป็น poolItemId
- **แยกตาม `poolGroup`:** หัก item ของกลุ่ม A ไม่กระทบกลุ่ม B
- **เกณฑ์ threshold ใช้ gross** (ไม่หัก) — พนักงานยังมีสิทธิ์อยู่ในกอง
- **กองที่หารแบ่งใช้ net:** `totalItemPool[id] = gross − Σ excludedByItemId[id]`
- ใช้ได้กับทุก kind=pool item รวม custom (e.g., "ขายมือสอง")

### 2. Piece variant (หักจาก count multi-item)
```ts
{ kind: "piece", employeeId: string, pieceItemId: string, pieces: number, label: string }
```
- admin เลือก พนักงาน + รายการค่าคอม (piece item)
- หักจาก count ของพนักงานคนนั้น item เดียว
- ใช้กับ role ที่ไม่ใช่ pool (e.g., บัญชี "ทำบิล")
- snapshot `employeeName` + `pieceItemLabel` (PR #481) → กัน orphan display เมื่อ admin ลบทีหลัง

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

### แก้ระหว่าง grace → auto re-settle + ประวัติ

ช่วง grace (ยืนยันแล้ว **แต่ยังไม่ปิดรอบ**) ยังแก้ได้ · เมื่อ admin แก้สิ่งใดก็ตามที่
กระทบยอดของเดือนนั้น ระบบ **re-settle ทั้งเดือนอัตโนมัติ** (ไม่ต้องกด "ยืนยันยอดใหม่"
เอง) — ทำใน `syncConfirmedMonth()` (`src/data/useFirebaseAppData.ts`, admin เท่านั้น):

1. **settle "ทุกแถว"** ในเดือนนั้น (ไม่ใช่แค่คนที่แก้) — เพราะการเกลี่ย/หักกองกลาง
   กระทบ net ของเพื่อนทั้งกลุ่ม → denorm net + auto-carry + loan ledger ต้องตรงทุกคน
2. **re-stamp** `payrollConfirms.totalAmount` + `breakdownSig` (preserve
   `firstConfirmedAt`/`lockAtMs`) → แบนเนอร์ "ยอดเปลี่ยน" ไม่เด้ง
3. **append `changeLog`** — `{ at, employeeName, changes[], totalBefore, totalAfter }`

**แหล่งที่ trigger auto re-settle (grace month):**

| การแก้ | ตัวอธิบายใน changeLog |
|---|---|
| เรท/ตำแหน่ง/baseSalary/ขึ้นเงินเดือน/ประกันสังคม/poolExclusion/ปิดสิทธิ์/รายการประจำ (`updateEmployee`) | `diffSalaryFields` (ก่อน → หลัง รายตัว) |
| จำนวนชิ้น/โบนัส/รายรับ-หักพิเศษ (`SalaryAdminEdit` → `updateSalary {resyncConfirmed}`) | `diffSalaryCounts` |
| เพิ่ม/ลบ ใบลา | "เพิ่ม/ลบวันลา …" |
| อนุมัติ/ปฏิเสธ เบิกล่วงหน้า | "อนุมัติ/ปฏิเสธเบิกล่วงหน้า X ฿" |
| เพิ่ม/แก้/ลบ เงินกู้ผ่อนคืน (`add/update/deleteEmployeeLoan`) | `diffLoanFields` + `loanSummary` — "…เงินกู้ผ่อนคืน — เงินต้น/หักต่อเดือน/เดือนเริ่ม/สถานะ ก่อน → หลัง" |
| แก้รายการหักกองกลาง (`setPoolAdjustment`) | `diffPoolAdjustment` — "หักกองกลาง: เพิ่ม/ลบ \"label\" X ชิ้น" หรือ "… X → Y ชิ้น" |
| แก้ปฏิทินเปิด-ปิดร้าน (`updateStoreCalendar`) | `diffCalendarChanges` — "เปิด/ปิด/จ่ายเพิ่มเสาร์พิเศษ <วันที่>" ต่อเดือน |

> **Single source กัน drift:** field ที่ trigger re-settle ของ `updateEmployee`
> มาจาก `SALARY_AFFECTING_SCALAR_FIELDS` / `SALARY_AFFECTING_OBJECT_FIELDS`
> (export จาก `payrollCompute.ts` — อยู่ติดกับ `diffSalaryFields`) · เทสต์
> "diffSalaryFields covers every salary-affecting field" บังคับว่าทุก field ใน
> list ต้องมีตัว diff ที่อธิบายได้จริง → เพิ่ม field ใหม่แล้วลืมสอน diff = เทสต์ fail
> (กันเคส re-settle ถูกแต่ changeLog ขึ้นรายการว่าง)
>
> ทุก diff helper เป็น pure (`payrollCompute.ts`) คืน **string เท่านั้น** — เป็น
> ข้อความประวัติ display-only · ไม่ไหลกลับเข้าสูตรคำนวณเงิน/net ใดๆ · ถ้า diff
> ว่าง (เช่น แก้แค่ label) แต่ยอดรวมขยับ → fallback ข้อความรวมเดิม

**กฎสำคัญที่ทำให้ปลอดภัย (idempotent — settle ซ้ำกี่ครั้งก็ได้ผลเท่าเดิม):**
- เงินกู้: `calculateSalary` คิด `paidExcludingThis` โดย**ตัดเดือนปัจจุบันออก** →
  re-settle ซ้ำได้ยอดเท่าเดิม · `recordLoanRepaymentTx` no-op เมื่อค่าไม่เปลี่ยน
- auto-carry: `getAutoCarryAdvances` (query เจาะจง) + dedup → ไม่สร้างซ้ำ · ลบเมื่อ net กลับบวก
- net ไม่ติดลบจากเงินกู้อย่างเดียว (loan floor `avail≥0`) → carry เกิดเฉพาะตอนเบิกเกินรายได้
- พิสูจน์ด้วย `src/utils/payrollSimulationGraceEdits.test.ts` (จำลอง 1 ปี · settle ซ้ำ 4×/เดือน)

**วันลาในเดือน grace → ต้อง restamp `totalLeaveDays` snapshot:** `computePoolSharesForGroup`
อ่าน leave จาก salary snapshot ก่อน (ไม่ใช่ live leaves) · `restampLeaveSnapshot()` เขียน
`totalLeaveDays` ใหม่ลง salary doc + mirror poolSnapshot ก่อน re-settle → การหักกองกลางจาก
วันลาเปลี่ยนตาม (ไม่ใช่แค่ over-quota/โบนัสขยัน) · สูตร snapshot = `weekday + sundays`
(ตรงกับ `updateSalary` + ตัวอ่านใน `computePoolSharesForGroup`)

**ปฏิทินร้าน — กันแก้เดือนที่ปิดรอบถาวร:** `updateStoreCalendar` diff วันที่เก่า/ใหม่ ·
ถ้ามีวันอยู่ในเดือน locked → throw (ปฏิทินเป็น config กลาง · view คิดสด แต่ net freeze ไม่ขยับ
→ เพี้ยน) · เดือน grace ยัง re-settle ได้ปกติ (`StoreCalendarPanel` โชว์แบนเนอร์ + กันปุ่ม)

## สำรองข้อมูล + ล้างข้อมูล (admin)

ฟีเจอร์ฝั่ง admin สำหรับ operational — UI อยู่ใน `AdminPanel` (`WipeDataPanel`) +
สถานะ backup ใน admin · ทุกอย่างเป็น **admin custom claim เท่านั้น**

### สำรองข้อมูล → GitHub (`backupToGitHub.ts`)

สำรอง Firestore ทั้งหมดเป็นไฟล์ JSON ส่งไปเก็บใน repo GitHub แยกต่างหาก:

- **Scheduled** `backupFirestoreScheduled` — ทุกอาทิตย์ ตี 3 (`0 3 * * 0` · Asia/Bangkok)
- **Manual** `triggerFirestoreBackupNow` callable (admin) — ปุ่มใน admin UI
- ผลลัพธ์: 1 ไฟล์/รอบ ที่ `backups/{YYYY-MM-DD_HH-mm-ss}.json` ใน repo backup
- **Config ใน `/config/secrets`:** `GITHUB_BACKUP_TOKEN` (PAT · scope `contents:write`) ·
  `GITHUB_BACKUP_REPO` (`"owner/repo"`) · `GITHUB_BACKUP_BRANCH` (default `"main"`)
- **Status:** เขียนผล (ok/fail + timestamp + totalDocs/sizeBytes + error) ลง
  `/config/backupStatus` → frontend subscribe ผ่าน `src/firebase/backup.ts`
  (`subscribeBackupStatus`) แสดงสถานะ + เวลาสำรองล่าสุดใน admin

### ล้างข้อมูล (Start-fresh · `WipeDataPanel`)

ใช้ตอนเริ่มใช้งานจริง (ล้างข้อมูลทดสอบ) · **2 mode** · ทั้งคู่ใช้ 2-step confirm:
กดปุ่ม → modal → พิมพ์ token `"ล้างข้อมูล"` → ยืนยัน (กัน accidental trigger)

| Mode | Cloud Function | ลบอะไร |
|---|---|---|
| ล้างทั้งระบบ | `wipeTestData` | top-level collections: `employees` (+ `months` subcollection) · `leaves` · `advances` · `employeeLoans` · `payrollConfirms` · `poolSnapshots` · `poolAdjustments` · `dutyAssignmentsToday` · `certCounters` · `recentTips` · `dailySummarySent` · `stats` (leaveCount/เดือน) |
| ล้างรายคน | `wipeEmployeeData` | เฉพาะคนที่เลือก (1+): `employees/{id}` (+ `months`) · `salaries/{id}/months/*` · `leaves`/`advances`/`employeeLoans` ที่ `employeeId == id` · ลบ key `employeeId` ออกจาก `poolSnapshots/{ym}` ทุก doc (`FieldValue.delete`) |

- callable ต้องมี `{ confirm: "ล้างข้อมูล" }` + admin claim ไม่งั้น throw `permission-denied`/`invalid-argument`
- **ลบเฉพาะ Firestore** — ไฟล์ใน Cloud Storage (สลิป/สลิปโอน) **ไม่ถูกลบ** (UI เตือนไว้)
- client wrapper: `src/firebase/wipeTestData.ts` (`wipeTestData()` / `wipeEmployeeData(ids)`)
- **ไม่ถูกแตะโดยตั้งใจ:** `config/*` (goldPrice/secrets/storeCalendar/laborCost ฯลฯ) ·
  `roles`/`duties` (master data) · `loginStates` (token login ชั่วคราว · single-use ·
  หมดอายุเอง 10 นาที — ไม่ใช่ข้อมูลพนักงาน)
- **เพิ่ม field ที่กระทบ collection ใหม่ → ต้องเพิ่มใน `TOP_LEVEL_COLLECTIONS` ด้วย**
  (เช่น `stats` ที่ `onLeaveCreated` เขียน · เคยตกค้างมาก่อน) — กันข้อมูลค้างหลัง start fresh

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
