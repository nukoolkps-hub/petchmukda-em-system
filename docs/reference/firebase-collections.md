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
| baseSalary | number | เงินเดือนพื้นฐาน **เริ่มต้น** (effective base = + annualRaises ที่ถึงรอบ) |
| annualRaiseAmount | number | จำนวนขึ้นเงินเดือน AUTO ทุก ม.ค. (`0` = ไม่ขึ้น) |
| annualRaises | `Record<year, number>` | override การขึ้นเงินรายปี (key = ค.ศ. string) |
| singlePieceRate | number | (legacy) rate ชิ้นเดี่ยว · multi-item refactor (PR #463) → ใช้ `pieceRates` แทน |
| pieceRates | `Record<string, number>` | rate ต่อ piece item id (non-pool roles · multi-item) |
| normalSalePieceRate | number | (legacy) rate ขายทั่วไป — fallback chain (PR #488+ → `poolItemRates["normal"]`) |
| specialSalePieceRate | number | (legacy) rate ขายพิเศษ — fallback chain |
| buyPieceRate | number | (legacy) rate รับซื้อ — fallback chain |
| poolItemRates | `Record<string, number>` | rate ต่อ pool item id (PR #488+ · รวม custom items) |
| invitePieceRate | number | (legacy) rate เชิญชวนสมัครบัตร — fallback chain (PR #477 → `bonusRates["invite"]`) |
| transferPieceRate | number | (legacy) rate ย้ายข้อมูลบัตร — fallback chain |
| bonusRates | `Record<string, number>` | rate ต่อ bonus item id (PR #477 · "โบนัสอื่นๆ" multi-item) |
| salaryDisabled | boolean | ซ่อน tab เงินเดือน |
| poolExclusion | `null` / `"all"` / `string[]` | ยกเว้น pool (PR #488+ · per-item) · legacy `"sell"/"buy"/"both"` migrate-on-read |
| socialSecurity | number | ประกันสังคมรายเดือน (snapshot ลง salary doc ตอนคำนวณ) |
| startWorkMonth | string (YYYY-MM) | วันที่เริ่มงาน — ใช้ในหนังสือรับรองเงินเดือน |
| prefix | "นาย" / "นาง" / "นางสาว" | คำนำหน้าชื่อ — ใช้ในหนังสือรับรอง |

### leaves

| Field | Type | Description |
|---|---|---|
| employeeId | string | ref → employees (**join คีย์หลัก** · ใช้กรอง/ลูกอัพแทน employeeName ทุกที่ — กันโดน rename) |
| employeeName | string | snapshot ชื่อจริง ตอนยื่นลา (สำหรับ peer view · พนักงานอ่าน employees ของเพื่อนไม่ได้) |
| employeeNickname | string \| null | snapshot ชื่อเล่น ตอนยื่นลา (null ถ้าไม่ได้ตั้งไว้) |
| type | "personal" / "sick" | ประเภทลา |
| start | string (YYYY-MM-DD) | วันเริ่มลา |
| end | string (YYYY-MM-DD) | วันสิ้นสุดลา |
| days | number | จำนวนวัน |
| reason | string | เหตุผล |
| createdByAdmin | boolean | admin เพิ่มให้ (badge "ADMIN" ในลิสต์) |
| createdAt | number (timestamp) | เวลาสร้าง |

หมายเหตุ: **read = ทุก signed-in** — ปฏิทินทีมโชว์ใบลาของทุกคน + กันยื่นลาทับวัน · ไม่มีฟิลด์อ่อนไหวใน leave doc

> **Pattern แสดงชื่อ (live > snapshot):** ตอน render ชื่อในใบลา ใช้ลำดับ
> `live.nickname → snapshot.employeeNickname → live.name → snapshot.employeeName`
> · live = lookup จาก `employeeDirectory.find(e => e.id === lv.employeeId)`
> · live ทับ snapshot → admin เพิ่มชื่อเล่น/เปลี่ยนชื่อภายหลัง ใบลาเก่าโชว์ค่าใหม่ทันที
> · snapshot fallback — สำหรับ peer ที่พนักงานอ่าน employees doc ไม่ได้ (rules ปิด → directory ไม่มี record ของเพื่อน) ใช้ snapshot ใน leave doc แทน
> · ใช้ pattern เดียวกันใน `TeamCalendar.tsx`, `LeaveListPanel.tsx`

### loginStates/{state} (CSRF defense — LINE Login)

| Field | Type | Description |
|---|---|---|
| createdAt | number | เวลาสร้าง state |
| expiresAt | number | หมดอายุ (TTL 10 นาที) |

- `prepareLineLogin` (callable) สร้าง random state ก่อน redirect ไป LINE · `lineAuth` ตรวจ + consume (single-use, transaction) ตอน callback
- เขียน/อ่านผ่าน Admin SDK เท่านั้น (client rules = `false`)

Source: `functions/src/auth/prepareLineLogin.ts` · `functions/src/auth/lineAuth.ts`

### salaries/{employeeId}/months/{YYYY-MM}

| Field | Type | Description |
|---|---|---|
| singleRatePieces | number | (legacy) ชิ้นเดี่ยว — fallback chain (PR #463 → `piecePieces` map) |
| piecePieces | `Record<string, number>` | จำนวนชิ้นต่อ piece item id (non-pool roles · multi-item) |
| normalSalePieces | number | (legacy) ขายทั่วไป — fallback chain |
| specialSalePieces | number | (legacy) ขายพิเศษ — fallback chain |
| buyPieces | number | (legacy) รับซื้อ — fallback chain |
| poolItemPieces | `Record<string, number>` | จำนวนชิ้นต่อ pool item id (PR #488+ · รวม custom) |
| invitePieces | number | (legacy) เชิญชวนสมัครบัตร — fallback chain |
| transferPieces | number | (legacy) ย้ายข้อมูลบัตร — fallback chain |
| bonusCounts | `Record<string, number>` | จำนวนครั้งต่อ bonus item id (PR #477) |
| socialSecurity | number | ประกันสังคม |
| customEarnings | `{label,amount}[]` | รายรับที่ admin เพิ่มเอง |
| customDeductions | `{label,amount}[]` | รายหักที่ admin เพิ่มเอง |
| coveragePay | number | เงินค่าแทน (coverage duty) จาก `computeCoverageEarningsForMonth` |
| coveragePayBreakdown | `{empId,count,total,...}[]` | breakdown ค่าแทน · preserve เดิมถ้า re-save (PR #516) |
| note | string | หมายเหตุ |
| **Snapshot fields** | | *เขียนอัตโนมัติตอน save salary — ล็อกอดีต* |
| roleId | string | snapshot ของ `employees.roleId` ตอน save |
| poolExclusion | string \| string[] \| null | snapshot exclusion (รองรับ array + legacy variants) |
| poolThresholdExempt | boolean | snapshot exempt จาก duty primary (PR #488+ · auto-pass threshold) |
| totalLeaveDays | number | `weekdayLeaves + sundayLeaves` ของเดือนนั้น |
| baseSalary | number | snapshot เงินเดือนพื้นฐาน ตอน save |
| singlePieceRate / pieceRates | number / map | snapshot piece rates · multi-item |
| normalSalePieceRate / specialSalePieceRate / buyPieceRate | number | (legacy) snapshot rate fallback |
| poolItemRates | `Record<string, number>` | snapshot pool item rates (PR #488+) |
| invitePieceRate / transferPieceRate | number | (legacy) snapshot rate fallback |
| bonusRates | `Record<string, number>` | snapshot bonus rates (PR #477) |
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
| poolGroup | string / null | กลุ่ม pool commission (null = ไม่ใช่ pool role) |
| icon | string | emoji icon |
| mainDuties | string (HTML) / null | หน้าที่หลัก · sanitized HTML |
| **pieceItems** | `PieceItem[]` / null | (non-pool roles) รายการค่าคอมรายชิ้น · `{id, label}` · PR #463 multi-item |
| pieceLabel | string / null | (legacy) ก่อน multi-item · migrate-on-read |
| **poolItems** | `PoolItem[]` / null | (pool roles) รายการ pool sales · `{id, label, kind, threshold}` · PR #488+ |
| primaryPoolItemId | string / null | item สำหรับ 50% rule (default: ตัวแรก kind=pool) |
| **bonusItems** | `PieceItem[]` / null | "โบนัสอื่นๆ" multi-item · null → migrate-on-read เป็น default 2 รายการ (invite/transfer) |

```ts
// poolItems schema
interface PoolItem {
  id: string;
  label: string;
  kind: "pool" | "personal";  // pool = แชร์ · personal = ใครขายใครได้
  threshold: number;          // % ของ top (0-100, default 80)
}
```

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
  "<empId>": {
    // legacy fields (fallback chain)
    normalSalePieces, specialSalePieces, buyPieces,
    // PR #494: multi-item map (รวม custom pool items)
    poolItemPieces: { "normal": 50, "buy": 30, "p_2hand": 10, ... },
    roleId, poolExclusion, totalLeaveDays, poolThresholdExempt
  },
  ...,
  updatedAt: <number>
}
```

เขียนโดย `updateSalary` (mirror ทุกครั้งที่ save) + `backfillPoolSnapshots()` ตอน "ยืนยันยอด"
ดูสถาปัตยกรรม phase 1/2 ที่ [`../reference.md`](../reference.md) → "Privacy: salaries vs poolSnapshots"

### poolAdjustments/{YYYY-MM}

"รายการยกเว้นค่าคอม" ที่ admin ใส่ — 2 variants · 1 doc/เดือน

| Field | Type | Description |
|---|---|---|
| items | `Item[]` | รายการหัก (ดูด้านล่าง) |
| updatedAt | number | epoch ms |

```ts
interface Item {
  id: string;
  kind?: "pool" | "piece";  // PR #465+ · default "pool"

  // pool variant — หักจากกองกลาง
  poolGroup?: string;       // role.poolGroup
  poolItemId?: string;      // PR #506: เลือก pool item · รวม custom items
  side?: "normal" | "buy";  // legacy fallback · migrate → poolItemId

  // piece variant — หักจาก count multi-item ของพนักงานคนเดียว
  employeeId?: string;
  pieceItemId?: string;
  roleId?: string;          // ใช้ resolve labels ใน UI
  employeeName?: string;    // snapshot (PR #481) · กัน orphan display
  pieceItemLabel?: string;  // snapshot

  // shared
  pieces: number;
  label: string;            // เหตุผล (e.g., "โปรโมชั่น", "ทำพลาด")
}
```

**กฎ:** เกณฑ์ threshold ใช้ gross (ไม่หัก · พนักงานยังมีสิทธิ์อยู่ในกอง) · กองที่หารแบ่งใช้ `net = gross − Σ excludedByItemId[id]`

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

### config/storeCalendar

ปฏิทินวันเปิด-ปิดร้าน (admin-managed) · ดู `CLAUDE.md` → "ปฏิทินเปิด-ปิดร้าน"

| Field | Type | Description |
|---|---|---|
| extraOpenSaturdays | string[] | `YYYY-MM-DD` เสาร์เปิดพิเศษ |
| extraClosedWeekdays | string[] | `YYYY-MM-DD` จ-ศ ปิดพิเศษ |
| updatedAt | number | ms epoch |

### config/goldPrice

ราคาทองคำสมาคม 96.5% + ราคาเงินแท่ง 99.99% (ชายนิ่งโกลล์) · ดึงอัตโนมัติทุก 15 นาทีโดย Cloud Function `fetchGoldPriceScheduled` (`functions/src/goldPrice/fetchGoldPrice.ts`) · subscribe ทั่วระบบความรู้ต่างๆ (live tables + calculator + live-example)

| Field | Type | Description |
|---|---|---|
| pricePerBaht | number | ราคาขายทอง 96.5% ฿/บาท (sellPrice ของสมาคม) |
| buyPrice | number | ราคารับซื้อทอง 96.5% ฿/บาท |
| priceChanged | number | เปลี่ยนแปลงจากรอบก่อน (informational) |
| **silverBuyPerGram** | number | ราคาเงินแท่งรับซื้อ ฿/กรัม (จาก mukdagold `bidGPrice`) |
| **silverSellPerGram** | number | ราคาเงินแท่งขายออก ฿/กรัม **รวม VAT 7%** (จาก mukdagold `askGPrice`) |
| **silverBuyPerKg** | number | ราคาเงินแท่งรับซื้อ ฿/กิโล |
| **silverSellPerKg** | number | ราคาเงินแท่งขายออก ฿/กิโล (รวม VAT) |
| **silverUpdatedAt** | string | ISO timestamp จาก mukdagold silver API |
| updatedAt | number | ms epoch ที่ doc ถูกเขียน |
| updatedBy | string | `auto · สมาคมค้าทองคำ (mukdagold)` / `(ฮั่วเซงเฮง)` · admin manual |
| source | string | `mukda-price2` / `hsh-ref` (debug) |
| sourceDate / sourceTime | string | timestamp จาก source (เทียบ dirty-check skip write) |
| lastFetchError | string | ข้อความ error ครั้งล่าสุด (`""` = ไม่มี) |
| lastFetchErrorAt | number | ms epoch ของ error |

**Source chain** (Cloud Function ลองตามลำดับ):
1. **Gold:** mukdagold `/api/price2` → HSH `apicheckpricev3` REF (fallback)
2. **Silver:** mukdagold `/api/silver_price` (no fallback · fail = silent skip ไม่กระทบ gold)

- ราคา gold เดียวกัน (proxy ของสมาคม) · HSH เป็น fallback
- **Sanity check:** gold 10,000–200,000 ฿/บาท · silver 10–200 ฿/กรัม
- **Skip write ถ้า no-change** ทั้ง gold (`sellPrice + sourceDate + sourceTime`) + silver (`silverBuyPerGram + silverSellPerGram`) เท่าเดิม

**Manual trigger:** Cloud Function `fetchGoldPriceNow` (onCall, admin only) — ปุ่ม refresh ใน `GoldPriceHeader`

**Read:** ทุก signed-in (ผ่าน `useGoldPrice()` hook) · **Write:** Cloud Function (Admin SDK) + admin จาก UI (`triggerFetchGoldPriceNow`)

### config/laborCost

ค่าแรงเริ่มต้น (ทอง 96.5%) override ของ `CHANGE_PRICE_WEIGHTS.laborBase` · admin แก้ได้จาก UI inline ที่ตาราง "ค่าแรง เริ่มต้น" ใน /knowledge (เฉพาะ ADMIN) → sync ทุก live table + calculator ทั่ว /knowledge ทันที

| Field | Type | Description |
|---|---|---|
| values | `Record<string, number>` | key = weightId (e.g. `"0.6g"`, `"1-saleung"`, `"1-baht"`, `"2-baht-plus"`) · value = ค่าแรง (฿) |
| updatedAt | number | ms epoch |
| updatedBy | string | ชื่อ admin (เผื่ออนาคต) |

**Merge logic:** `getWeightsWithLabor(overrides)` ใน `changePriceUtils.ts` · field ที่ admin ไม่ override ใช้ default จาก `CHANGE_PRICE_WEIGHTS`

**Read:** ทุก signed-in · **Write:** admin only

### config/blockCost

ค่าบล็อก + ค่าส่ง + ค่าประกัน (ทองคำแท่ง + เงินแท่ง) · admin แก้ inline ใน "ความรู้ต่างๆ" → section "ค่าบล็อก" · sync ทันที (เก็บ string รองรับ format "300 / 350 / 450")

| Field | Type | Description |
|---|---|---|
| values | `Record<string, string>` | key = rowId (e.g. `"gold-2baht"`, `"silver-1kilo"`, `"insurance-pct"`) · value = ค่า string (≤60 chars) |
| updatedAt | number | ms epoch |
| updatedBy | string | ชื่อ admin |

**Merge logic:** `getBlockCostValue(overrides, key)` ใน `blockCost.ts` · key ที่ admin ไม่ override ใช้ default จาก `DEFAULT_BLOCK_COST_VALUES`

**Read:** ทุก signed-in · **Write:** admin only

### config/loyaltyPoints

ตารางสะสมแต้มแลกทองคำแท่ง · admin แก้ทั้ง 2 column (แต้มที่ใช้ + ได้รับทอง) จากตารางในความรู้ต่างๆ section "แต้มสะสม"

| Field | Type | Description |
|---|---|---|
| values | `Record<string, string>` | key = `"redeem-r{1-5}-{pts\|gold}"` · value = ค่า string (≤80 chars · รองรับ "1.905 กรัม (½ สลึง)") |
| updatedAt | number | ms epoch |
| updatedBy | string | ชื่อ admin |

**Merge logic:** `getLoyaltyPointsValue(overrides, key)` ใน `loyaltyPoints.ts` · key ที่ admin ไม่ override ใช้ default จาก `DEFAULT_LOYALTY_POINTS_VALUES`

**Read:** ทุก signed-in · **Write:** admin only

## Security Rules Summary

| Collection | Read | Write |
|---|---|---|
| employees | admin / owner | admin (full), owner (profile + bank fields only) |
| leaves | **all signed-in** | owner (create), owner (delete future-only), admin (update/delete any) |
| loginStates/{state} | blocked (client) | blocked (client) — เขียน/อ่านผ่าน Admin SDK เท่านั้น |
| salaries/{empId}/months/{ym} | admin / owner | admin only |
| collectionGroup `months` | admin only | blocked |
| poolSnapshots/{YYYY-MM} | all signed-in | admin only |
| poolAdjustments/{YYYY-MM} | all signed-in | admin (+ เดือนยังไม่ปิดรอบ) |
| employeeLoans/{loanId} | admin / owner | admin only |
| advances | admin / owner | owner (create), admin (update/delete) — เดือนปิดรอบแล้วเขียนไม่ได้ |
| roles | all signed-in | admin only |
| payrollConfirms | all signed-in | admin (เดือนปิดรอบ → ยืนยันใหม่ไม่ได้) |
| certCounters/{พ.ศ.} | all signed-in | all signed-in (count ต้อง +1 เท่านั้น) |
| config/storeCalendar | all signed-in | admin only |
| config/goldPrice | all signed-in | admin only (+ Cloud Function ผ่าน Admin SDK) |
| config/laborCost | all signed-in | admin only |
| config/blockCost | all signed-in | admin only |
| config/loyaltyPoints | all signed-in | admin only |
| config/notifications | admin only | admin only |
| config/* (อื่นๆ) | blocked | blocked (Functions ใช้ Admin SDK) |

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
