# Testing — กลยุทธ์เทสต์ + invariants

เทสต์ของระบบนี้ **โฟกัส pure business logic ใน `src/utils/`** (เงินเดือน / กองกลาง /
วันลา / หน้าที่ / ราคาทอง) ไม่เทสต์ UI / Firebase — เพราะ logic เงินคือจุดที่พลาดแล้ว
ร้านเสียหาย/พนักงานได้เงินผิด ส่วน UI กับ Firestore เปลี่ยนบ่อยและ test ยาก คุ้มน้อยกว่า

## Setup

- **Framework:** Vitest (`vitest.config.ts`) · `environment: node` (ฟังก์ชันบริสุทธิ์ ไม่มี DOM)
- **ที่อยู่ไฟล์:** ข้าง source — `src/**/*.test.ts` (เช่น `src/utils/salaryUtils.pool.test.ts`)
- **Coverage scope:** `src/utils/**/*.ts` (v8) — ตั้งใจวัดเฉพาะ logic ชั้นนี้

```bash
npm test            # รันครั้งเดียว (CI ใช้ตัวนี้)
npm run test:watch  # watch mode ตอน dev
npm run test:coverage
```

## CI gate — เทสต์ fail = ไม่ deploy

`.github/workflows/deploy.yml` มี job `test` = `npm run typecheck` + `npm test` ·
ทุก deploy job (`deploy-hosting/functions/firestore-rules/storage-rules`) มี `needs: test`
→ **typecheck หรือเทสต์พังเมื่อไหร่ จะไม่ deploy** (กัน logic เงินพังขึ้น production)

## ไฟล์เทสต์ปัจจุบัน

| ไฟล์ | ครอบ |
|---|---|
| `salaryUtils.calculateSalary.test.ts` | สูตรเงินเดือน 1 คน (base/โบนัส/หัก/เบิก/เงินกู้/net) |
| `salaryUtils.pool.test.ts` | กองกลาง — threshold, exclusion, per-item share |
| `salaryUtils.resolvers.test.ts` | resolve เรท/ชิ้น (snapshot-first + legacy fallback) |
| `salaryUtils.raise.test.ts` | ขึ้นเงินเดือนประจำปี + per-year override |
| `payrollCompute.test.ts` | shared module — settle, diffSalaryFields/Counts, breakdownSig |
| `payrollSimulation.test.ts` | **จำลอง 1 ปี × 10 คน** ครอบทุกเคส → assert invariants |
| `payrollSimulationRoles.test.ts` | เปลี่ยนตำแหน่งกลางปี + หลาย pool group + slip display |
| `payrollSimulationGraceEdits.test.ts` | **จำลอง grace re-settle** (#637-#641) — idempotency + conservation |
| `payrollLock.test.ts` | กฎปิดรอบ 7 วัน (`getPayrollLock`/`isMonthLocked`) |
| `leaveUtils.test.ts` · `storeCalendar.test.ts` | นับวันลา/over-quota · ปฏิทินเปิด-ปิดร้าน |
| `advanceUtils.test.ts` · `dutyUtils.test.ts` | เบิกล่วงหน้า · หน้าที่ประจำ (rotation/fairness) |
| `changePriceUtils.test.ts` · `dateUtils.test.ts` · `format.test.ts` · `validators.test.ts` | ราคาทอง · วันที่ไทย · comma format · validators |

## Invariants — เงินต้องไม่เพี้ยน (ใช้ใน simulation tests)

เมื่อ assert การคำนวณเงิน ให้ยึด invariant เหล่านี้ (ถ้า fail = พบบั๊กเงินจริง → แก้ที่ source):

| Invariant | ความหมาย |
|---|---|
| **net = earnings − deductions** | เป๊ะทุกแถว (ภายใน EPS) |
| **total = Σ net** | ยอดรวมเดือน = ผลรวม net ทุกแถว · ฝั่ง admin = ฝั่งสลิป |
| **pool conservation** | per item (kind=pool): Σ allocated ≈ gross pool (เงินกองกลางไม่หาย/ไม่งอก) |
| **admin ↔ employee parity** | `computePoolSharesForGroup` จาก salaries (admin) = จาก poolSnapshots (พนักงาน) |
| **loan cap** | Σ repayments ≤ principal เสมอ |
| **ไม่มี NaN/Infinity** | ทุก field การเงิน finite |
| **โบนัสขยัน** | 0 ลา→2×dailyRate · 1 ลา→1× · ≥2 ลา→0 (ถ้าไม่ losesBaseSalary) |

## Idempotency — กฎเหล็กของ grace re-settle (#637-#641)

ระหว่าง grace การแก้ทุกอย่างจะ `syncConfirmedMonth()` settle **ทุกแถว** ซ้ำได้หลายรอบ
(จาก trigger หลายตัว) → **settle ซ้ำต้องได้ผลเท่าเดิม** ไม่งั้นเงินจะ drift สะสม ·
`payrollSimulationGraceEdits.test.ts` พิสูจน์โดย settle 4×/เดือน ตลอดปี แล้วเทียบ world
snapshot กับ settle 1×/เดือน (ต้องเท่ากันเป๊ะ)

กฎที่ทำให้ idempotent (อย่าทำพัง):
- **เงินกู้:** `calculateSalary` คิด `paidExcludingThis` โดยตัดเดือนปัจจุบันออก →
  re-settle ได้ยอดเท่าเดิม · `recordLoanRepaymentTx` no-op เมื่อค่าไม่เปลี่ยน
- **auto-carry:** หาด้วย targeted query + dedup key `employeeId|sourceMonth` →
  update/ลบ ไม่สร้างซ้ำ
- **net floor:** loan หักไม่เกิน `avail = max(0, earnings − deductionsBeforeLoan)` →
  net ไม่ติดลบจากเงินกู้อย่างเดียว (carry เกิดเฉพาะตอนเบิกเกินรายได้)

## เมื่อแก้ logic ใน `src/utils/` → ต้องทำอะไร

1. **เขียน/อัปเดตเทสต์** ของฟังก์ชันนั้น (unit) — cover เคส edge (0/ลบ/ขาด field)
2. ถ้าแก้ **payroll/pool/loan/advance/leave** → เพิ่มเคสใน simulation ที่เกี่ยว
   (`payrollSimulation*.test.ts`) แล้วเช็คว่า invariants ด้านบนยังผ่าน
3. ถ้าแก้สิ่งที่ **grace re-settle เรียกซ้ำ** → ยืนยัน idempotency
   (settle 2× == 1×) ใน `payrollSimulationGraceEdits.test.ts`
4. รัน `npm run typecheck && npm test && npx biome check` ให้เขียวก่อน push

> หลักการ: แก้ logic เงินที่ไหน เพิ่มเทสต์ที่นั่น — simulation จับ regression ข้ามระบบ
> (เช่นแก้สูตรกองกลางแล้วเผลอทำ loan/carry พัง) ที่ unit test เดี่ยวๆ จับไม่ได้
