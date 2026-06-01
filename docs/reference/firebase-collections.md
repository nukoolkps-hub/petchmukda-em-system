# Firebase Collections & Security Rules

Database ID: `petchmukda-bot` (named database, ไม่ใช่ default)

## Collections

### employees

| Field | Type | Description |
|---|---|---|
| name | string | ชื่อพนักงาน |
| avatar | string | ตัวอักษร/emoji สำหรับ avatar |
| avatarType | "text" / "emoji" / "image" | ประเภท avatar |
| avatarImageUrl | string / null | URL รูป avatar |
| role | string | ชื่อตำแหน่ง |
| roleId | string | ID ของ role document |
| bank | string | ชื่อธนาคาร |
| bankAccountNumber | string | เลขบัญชี |
| lineUserId | string | LINE User ID (ใช้เป็น auth uid) |
| baseSalary | number | เงินเดือนพื้นฐาน |
| singlePieceRate | number | rate ชิ้นเดี่ยว |
| normalSalePieceRate | number | rate ขายปกติ |
| specialSalePieceRate | number | rate ขายพิเศษ |
| buyPieceRate | number | rate ซื้อ |
| invitePieceRate | number | rate ชวน |
| transferPieceRate | number | rate โอน |
| salaryDisabled | boolean | ซ่อน tab เงินเดือน |
| poolExclusion | "sell" / "buy" / "both" / null | ยกเว้น pool |
| socialSecurity | number | ประกันสังคมรายเดือน (snapshot ลง salary doc ตอนคำนวณ) |
| startWorkMonth | string (YYYY-MM) | วันที่เริ่มงาน — ใช้ในหนังสือรับรองเงินเดือน |
| prefix | "นาย" / "นาง" / "นางสาว" | คำนำหน้าชื่อ — ใช้ในหนังสือรับรอง |

### leaves

| Field | Type | Description |
|---|---|---|
| employeeId | string | ref → employees |
| employeeName | string | ชื่อพนักงาน |
| type | "personal" / "sick" | ประเภทลา |
| start | string (YYYY-MM-DD) | วันเริ่มลา |
| end | string (YYYY-MM-DD) | วันสิ้นสุดลา |
| days | number | จำนวนวัน |
| reason | string | เหตุผล |
| createdAt | number (timestamp) | เวลาสร้าง |

### salaries/{employeeId}/months/{YYYY-MM}

| Field | Type | Description |
|---|---|---|
| singleRatePieces | number | ชิ้นเดี่ยว (ตำแหน่งที่ไม่แยก sell/buy) |
| normalSalePieces | number | ชิ้นขายปกติ |
| specialSalePieces | number | ชิ้นขายพิเศษ (ใครขายใครได้) |
| buyPieces | number | ชิ้นรับซื้อ |
| invitePieces | number | ชิ้นเชิญสมัครบัตร |
| transferPieces | number | ชิ้นย้ายข้อมูลบัตร |
| socialSecurity | number | ประกันสังคม |
| customEarnings | `{label,amount}[]` | รายรับที่ admin เพิ่มเอง |
| customDeductions | `{label,amount}[]` | รายหักที่ admin เพิ่มเอง |
| note | string | หมายเหตุ |
| **Snapshot fields** | | *เขียนอัตโนมัติตอน save salary — ใช้คำนวณ Pool ฝั่ง employee + ล็อกอดีต* |
| roleId | string | snapshot ของ `employees.roleId` ตอน save |
| poolExclusion | string\|null | snapshot ของ `employees.poolExclusion` ตอน save |
| totalLeaveDays | number | `weekdayLeaves + sundayLeaves` ของเดือนนั้น |
| baseSalary | number | snapshot เงินเดือนพื้นฐาน ตอน save |
| singlePieceRate / normalSalePieceRate / specialSalePieceRate / buyPieceRate / invitePieceRate / transferPieceRate | number | snapshot เรทค่าคอม ตอน save |
| socialSecurity | number | snapshot ประกันสังคม ตอน save |

> **ความไม่เปลี่ยนของอดีต (immutability):** ตั้งแต่มี snapshot เรท/ตำแหน่ง ข้อมูลเงินเดือนในอดีตจะ
> ไม่ขยับเมื่อเปลี่ยนตำแหน่ง/เรทพนักงานในอนาคต — `calculateSalary` อ่าน snapshot ก่อนเสมอ (fallback
> เรทปัจจุบันเฉพาะเดือนที่ยังไม่มี snapshot). กฎ "ล็อกเมื่อยืนยันยอด": เดือนที่ `payrollConfirms[ym]`
> มีแล้ว + มี snapshot อยู่ → `updateSalary` จะไม่ re-stamp เรท/ตำแหน่ง (กันเผลอแก้เดือนเก่าหลัง
> เปลี่ยนตำแหน่งแล้วเพี้ยน) · งวดที่ยังไม่ยืนยันยัง stamp ค่าสด
| **Slip freeze fields** | | *เขียนตอน "ยืนยันยอด" → freeze PDF ลง Storage* |
| slipUrl | string | URL ของสลิป PDF ใน Storage |
| slipFrozenAt | string (ISO) | เวลา freeze สลิป |
| updatedAt | number | timestamp ล่าสุด |

หมายเหตุ: `baseSalary` ไม่อยู่ใน salary doc — เก็บใน `employees.baseSalary` (ป้องกัน leak ผ่าน salaries ที่อ่านได้ทุกคน)

### advances

| Field | Type | Description |
|---|---|---|
| employeeId | string | ref → employees |
| employeeName | string | ชื่อพนักงาน |
| amount | number | จำนวนเงิน |
| reason | string | เหตุผล |
| month | string (YYYY-MM) | เดือนที่เบิก |
| status | "pending" / "approved" / "rejected" | สถานะ |
| submittedAt | string (ISO) | เวลาส่งคำขอ |
| approvedAt | string (ISO) | เวลาอนุมัติ |
| rejectedAt | string (ISO) | เวลาปฏิเสธ |
| rejectionReason | string | เหตุผลปฏิเสธ |
| slipImageUrl | string | URL สลิปโอนเงิน |
| lineNotificationStatus | string | สถานะ LINE notification |

### roles

| Field | Type | Description |
|---|---|---|
| name | string | ชื่อตำแหน่ง |
| poolGroup | string / null | กลุ่ม pool commission |
| icon | string | emoji icon |

### payrollConfirms/{YYYY-MM}

| Field | Type | Description |
|---|---|---|
| confirmedAt | string (ISO) | เวลายืนยัน (ล่าสุด — อัปเดตเมื่อ "ยืนยันยอดใหม่") |
| firstConfirmedAt | string (ISO) | เวลายืนยัน **ครั้งแรก** — ไม่รีเซ็ตเมื่อยืนยันใหม่ ใช้คิด grace 7 วัน |
| lockAtMs | number | `firstConfirmedAt + 7 วัน` (ms) — พ้นแล้วเดือนนี้ "ปิดรอบถาวร" |
| totalAmount | number | ยอดรวม |
| employeeCount | number | จำนวนพนักงาน |
| breakdownSig | string | ลายเซ็น `{id:netSalary}` ทุกคน — ใช้เทียบว่า "ข้อมูลเปลี่ยนหลังยืนยัน" |

> **ปิดรอบ 7 วัน:** เมื่อ `request.time > lockAtMs` → ห้ามแก้ค่าคอม/ลา/เบิก/
> ยืนยันใหม่ ของเดือนนั้น (บังคับทั้ง UI ผ่าน `src/utils/payrollLock.ts` และ
> firestore.rules ผ่านฟังก์ชัน `monthLocked(ym)`)

### poolSnapshots/{YYYY-MM}

สำเนา field ที่ **ไม่อ่อนไหว** ของทุกคนในเดือนนั้น สำหรับคำนวณกองกลาง (Pool) ฝั่งพนักงาน
โดยไม่ต้องเปิดสิทธิ์อ่าน salary doc เต็มใบ (1 doc/เดือน, map `empId → fields`)

```
poolSnapshots/2026-05 = {
  "<empId>": { normalSalePieces, specialSalePieces, buyPieces,
               roleId, poolExclusion, totalLeaveDays },
  ...,
  updatedAt: <number>
}
```

เขียนโดย `updateSalary` (mirror ทุกครั้งที่ save) + `backfillPoolSnapshots()` ตอน "ยืนยันยอด"
ดูสถาปัตยกรรม phase 1/2 ที่ [`../reference.md`](../reference.md) → "Privacy: salaries vs poolSnapshots"

### poolAdjustments/{YYYY-MM}

"รายการหักจากกองกลาง" ที่ admin ใส่ — บางสินค้าไม่ได้ค่าคอม (โปรโมชั่นฝั่งขาย,
ทองแท่ง MD ฝั่งรับซื้อ ฯลฯ) · หักระดับเดือน + **แยกตามตำแหน่ง (`poolGroup`)** ·
1 doc/เดือน

| Field | Type | Description |
|---|---|---|
| items | `Item[]` | รายการหัก (ดูด้านล่าง) |
| updatedAt | number | epoch ms |

```ts
interface Item {
  id: string;
  poolGroup: string;     // ตำแหน่ง/กลุ่มที่หักจาก (role.poolGroup)
  side: "normal" | "buy"; // ฝั่งขายทั่วไป หรือ รับซื้อ
  pieces: number;        // จำนวนชิ้นที่ไม่นับค่าคอม
  label: string;         // เหตุผล (เช่น "โปรโมชั่น", "ทองแท่ง MD")
}
```

**กฎ:** เกณฑ์ 80% ใช้ gross (ไม่หัก พนักงานยังมีสิทธิ์อยู่ในกอง) ·
กองที่หารแบ่งใช้ `net = gross − Σ items ของ poolGroup นั้น`

### employeeLoans/{loanId}

เงินกู้ผ่อนคืน — admin สร้าง (ต่างจากเบิกล่วงหน้าที่พนักงานขอ) ·
หักจากเงินเดือนอัตโนมัติทุกเดือนจนครบ · ใช้ **ledger** (`repayments[ym]`)
เก็บยอดที่หักจริงแต่ละเดือน → คงเหลือแม่นยำเสมอ

| Field | Type | Description |
|---|---|---|
| employeeId | string | id พนักงาน |
| employeeName | string | snapshot ชื่อ (ตอนสร้าง) |
| principal | number | เงินต้น |
| monthlyDeduction | number | ผ่อนเดือนละกี่บาท |
| startMonth | string | `YYYY-MM` เดือนแรกที่เริ่มหัก |
| note | string | เหตุผล |
| status | `"active" \| "paid_off" \| "cancelled"` | สถานะ |
| repayments | `Record<YYYY-MM, number>` | **ledger** — ยอดที่หักจริงแต่ละเดือน |
| createdAt | string (ISO) | เวลาสร้าง |

**คงเหลือ:** `principal − Σ repayments` (helper `loanRemaining()`)

**สูตรหัก:** ตอน `calculateSalary` ของแต่ละเดือน:
1. คำนวณ `netBeforeLoan = earnings − (advance + ss + overQuota + custom)`
2. วน loop active loans เรียง FIFO (`startMonth` → `id`):
   - `due = min(monthlyDeduction, คงเหลือ ที่ไม่นับเดือนนี้)`
   - `take = min(due, avail)` ← cap ที่เงินสุทธิที่เหลือ
   - `avail -= take` · `loanRepayments[id] = take`
3. `loanDeduction = Σ take` → หักจาก deductions
4. ตอน admin ยืนยันยอด → เขียน `repayments[ym]` (idempotent) +
   `status = "paid_off"` เมื่อ Σ ≥ principal

### config/secrets (Cloud Functions only)

| Field | Description |
|---|---|
| ADMIN_LINE_USER_ID | LINE User ID ของ admin |
| LINE_LOGIN_CHANNEL_ID | LINE Login Channel ID |
| LINE_LOGIN_CHANNEL_SECRET | LINE Login Channel Secret |
| LINE_CHANNEL_ACCESS_TOKEN | Messaging API Access Token |
| LINE_CHANNEL_SECRET | Messaging API Channel Secret |

## Security Rules Summary

| Collection | Read | Write |
|---|---|---|
| employees | admin / owner | admin (full), owner (profile + bank fields only) |
| leaves | admin / owner | owner (create), owner (delete future-only), admin (update/delete any) |
| salaries/{empId}/months/{ym} | admin / owner | admin only |
| collectionGroup `months` | admin only | blocked |
| poolSnapshots/{YYYY-MM} | all signed-in | admin only |
| poolAdjustments/{YYYY-MM} | all signed-in | admin (+ เดือนยังไม่ปิดรอบ) |
| employeeLoans/{loanId} | admin / owner | admin only |
| advances | admin / owner | owner (create), admin (update/delete) — เดือนปิดรอบแล้วเขียนไม่ได้ |
| roles | all signed-in | admin only |
| payrollConfirms | all signed-in | admin (เดือนปิดรอบ → ยืนยันใหม่ไม่ได้) |
| certCounters/{พ.ศ.} | all signed-in | all signed-in (count ต้อง +1 เท่านั้น) |
| config/* | blocked | blocked (Functions ใช้ Admin SDK) |

**Peer data สำหรับกองกลาง (Pool):**
salary doc มี field อ่อนไหว (`note`, `customDeductions`,
`socialSecurity`, `slipUrl`) — ปิดไม่ให้พนักงานอ่านของเพื่อน แต่ pool calc
ต้องรู้ pieces + roleId + poolExclusion + วันลา ของเพื่อนทั้งกลุ่ม → ย้ายไปไว้ใน
`poolSnapshots/{ym}` ที่อ่านได้ทุก signed-in (mirror ทุกครั้งที่ admin save salary)
ดู [`../reference.md`](../reference.md) → "Privacy: salaries vs poolSnapshots"

## Storage Rules

| Path | Read | Write |
|---|---|---|
| avatars/{employeeId}/ | all signed-in | admin / owner (image < 8MB) |
| advanceSlips/{advanceId}/ | admin / owner | admin only (image < 8MB) |
| salarySlips/{employeeId}/{YYYY-MM}.pdf | admin / owner | admin only (PDF < 8MB) — freeze ตอนยืนยันยอด |
