# Petchmukda EM System

ห้างเพชรทองมุกดา — ระบบพนักงาน: การลา, เงินเดือน, ค่าคอมกองกลาง (Pool), เบิกเงินล่วงหน้า, LINE Bot

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- **Backend:** Firebase Cloud Functions (Node.js 22, TypeScript)
- **Database:** Firestore (named database: `petchmukda-bot`)
- **Auth:** Firebase Auth (LINE Login + Dev mode)
- **Storage:** Firebase Storage
- **Linting:** Biome
- **Icons:** `lucide-react` (อันเดียวทั้งระบบ — ไม่ผสมชุดอื่น) · **ห้ามใช้ emoji เป็น icon ใน UI** (label, heading, button, warning ฯลฯ) ทุกที่ต้อง Lucide เท่านั้น · ยกเว้น content/text ที่ความหมายเป็น emoji จริงๆ (เช่น avatar emoji picker, leave-type icons ใน `constants.ts`)
- **PDF:** pdfmake 0.3.x — Thai font Sarabun self-host ที่ `public/fonts/`
  - register ผ่าน `pdfMake.addVirtualFileSystem()` + `setFonts()` (ไม่ใช่ `.vfs` แบบ 0.1.x)
- **Routing:** react-router-dom v7 (HashRouter)

## Commands

```bash
npm run dev          # Frontend + Firebase Emulators
npm run build        # Production build (output: dist/) — copy public/fonts ด้วย
npm run typecheck    # TypeScript check
npm run check        # Biome lint + format
```

Deploy เกิดอัตโนมัติบน push เข้า `main` — ไม่มีการรัน `firebase deploy` ด้วยมือ (ดู Deployment ด้านล่าง)

## Architecture

```
main.tsx → AuthProvider → AuthGate → App.tsx (LeaveApp)
                                       ├── /home       → HomeTab (leave quota, team calendar)
                                       ├── /request    → RequestTab (leave form)
                                       ├── /salary     → SalaryView (employee salary view)
                                       ├── /knowledge  → KnowledgeView (ความรู้ต่างๆ — ราคา, สูตร, calc)
                                       └── /admin      → AdminPanel (admin-only)
```

### AdminPanel — section components

`AdminPanel.tsx` เป็น **router บางๆ** (~250 บรรทัด) — render section ตาม `section` prop
แต่ละ section แยกเป็น component ของตัวเอง (state เป็น local ของแต่ละตัว):

| section | component | state ภายใน |
|---|---|---|
| summary | `LeaveSummaryPanel` | เดือน/ปีที่เลือก, chip ที่กางอยู่ |
| leaves | `LeaveListPanel` | filter พนักงาน/ประเภท, ยืนยันลบ |
| roles (พนักงาน) | `EmployeeAdminPanel` → `EmployeeEditModal` | draft แก้ไข (`editingRole`), employee ที่เปิด, ยืนยันลบ |
| salary | `SalaryAdminEdit` | draft ค่าคอม |
| advance | `AdminAdvancePanel` | filter เดือน/สถานะ |
| payroll | `PayrollSummaryPanel` | เดือนที่เลือก |
| positions | `RolesAdminPanel` | draft role |

**กฎ:** component ไม่ควรเกิน ~300-400 บรรทัด — ถ้าโตเกินให้แยก (เช่น `EmployeeEditModal` แยกจาก `EmployeeAdminPanel`)

**แชร์ state ข้าม section — ต้อง "ยก state ขึ้น" (lift state up):**
ตอนนี้แต่ละ section ถือ state ของตัวเอง ถ้าอยากให้ section คุยกัน (เช่น เลือกเดือนใน "สรุปลา" แล้ว "รายการลา" กรองตาม) ทำแบบนี้:
1. ย้าย `useState` ของค่าที่จะแชร์ขึ้นไปไว้ใน `AdminPanel` (parent ร่วม)
2. ส่งลงเป็น props ทั้ง 2 ทาง: `value={x}` + `onChange={setX}` ให้ทุก section ที่ใช้
3. section อ่าน/เขียนผ่าน props แทน local state เดิม
> หลักการ: state ควรอยู่ที่ "บรรพบุรุษร่วมที่ใกล้ที่สุด" ของ component ที่ต้องใช้ร่วมกัน — อย่า duplicate state ไว้หลายที่ (จะ sync ไม่ตรง)

### Knowledge ("ความรู้ต่างๆ") — block-based content

หน้า `/knowledge` (route + admin sidebar item · Icon: `Brain` 🧠) — รวมเนื้อหา reference + เครื่องคิดเลข

**`KnowledgeView`** — render top bar (`GoldPriceHeader` live) + search box (filter section.title) + accordion list (เปิดทีละ section · session-remember)

**Section** = `{ id, title, Icon, blocks[] }` อยู่ใน `src/content/knowledge/index.ts` (hardcode — เปลี่ยนน้อย + commit-driven)

**Block types** (rendered by `KnowledgeBlock` switch):
- **Static:** `h3` · `p` · `list` · `table` (มี `colWidths`/`colAlign`) · `formula` · `example` · `image` · `callout` (รองรับ `\n` multi-line) · `steps`
- **Live (subscribe goldPrice):** `change-price-table` · `sell-price-96-table` · `buy-price-96-table` (ใช้ `gold.buyPrice` · fallback pricePerBaht) — ใช้ `CHANGE_PRICE_WEIGHTS` (single source ของน้ำหนัก+ค่าแรง) + `SHORTCUT_MULTIPLIERS` shared sell/buy (เช่น ½ สลึง = ราคาทอง × 0.125)
- **Admin-editable live tables:** `labor-cost-table` · `block-cost-table` · `loyalty-points-redeem-table` — admin กด "แก้ไข" ในตาราง · sync ทุก signed-in ผ่าน `/config/{laborCost,blockCost,loyaltyPoints}`
- **Live with compute fn:** `live-example` (โจทย์+ขั้นตอนคำนวณจากราคาวันนี้ · receives sell/buy/silverBuy/laborBaht/labor) · `calculator` (input form + live output · `goldPriceDefault`/`buyPriceDefault`/`silverSell+BuyPriceDefault`/`disabledWhen`/`hidden`/`readOnly`/`unit`)
- **Other:** `secret` (PIN/รหัส dot mask)

**Calculator UX:**
- input ใช้ `type="text" inputMode="decimal"` · format ด้วย comma (1,234,567) ตอน blur · raw ขณะ focus เพื่อรองรับ "3.79" decimal
- `rawTexts` state preserve text ขณะพิมพ์ (กัน "3." กลายเป็น "3" ตอน parse)
- default value ใส่เฉพาะ gold/silver price + option dropdowns · field อื่น (labor, grams, etc.) ว่าง · user กรอกเอง
- badge "ราคาวันนี้" แสดงเมื่อ value == live (ทั้งตอนยังไม่แตะ + ตอนแก้กลับมาเท่าราคาวันนี้) · เขียว = sell · แดง = buy

**Typography กฎทอง ของ "ความรู้ต่างๆ":**
- **ตัวอักษร = Prompt font** (default ทั่วระบบ — ห้ามใส่ `font-mono` บน wrapper ของ text)
- **MathText = font-mono** (เฉพาะเครื่องหมายคำนวณ +/−/×/÷/=) · รองรับ `**bold**` markdown → `<strong>` extrabold maroon
- ทุกที่ที่อาจมี operator ใน UI ต้อง wrap `<MathText>` (กระจายในทุก block type) — operator regex ไม่จับ ASCII `-` (เพื่อไม่ชน "MD-XX" / "0.05 ก. - 10 บ.") · ถ้าจำเป็นต้องลบใน formula ให้ใช้ U+2212 "−"

**MathText spec:** wrap +/−/×/÷/= ใน span `font-mono 1.3em font-black text-maroon` · ใช้ใน blocks:
- `formula` (+ `formula.result`)
- `table` cells
- `example.step.calc` / `example.step.meaning` / `example.given`
- `live-example.step.calc` / `live-example.step.meaning` / `live-example.given`
- `callout.text` · `p.text` · `list.items`
- `Calculator`: `field.label` / `out.label` / `out.hint`

### Data Flow

```
useAppData() → useFirebaseAppData() → Firestore real-time (onSnapshot)
                                       ├── employees     (admin: all · employee: own only)
                                       ├── leaves        (all signed-in — ปฏิทินทีม + กันยื่นลาทับวัน)
                                       ├── salaries      (admin: all via collectionGroup · employee: own only)
                                       ├── advances      (admin: all · employee: own only)
                                       ├── roles         (all signed-in)
                                       ├── payrollConfirms (all signed-in)
                                       ├── poolSnapshots  (all signed-in — peer pool fields)
                                       ├── storeCalendar  (all signed-in — `/config/storeCalendar`)
                                       ├── goldPrice      (all signed-in — `/config/goldPrice` · ราคาทอง+เงิน live)
                                       ├── laborCost      (all signed-in — `/config/laborCost` · admin-edit ค่าแรงเริ่มต้น)
                                       ├── blockCost      (all signed-in — `/config/blockCost` · admin-edit ค่าบล็อก+ค่าประกัน)
                                       └── loyaltyPoints  (all signed-in — `/config/loyaltyPoints` · admin-edit แต้มแลกทอง)
```

**Scope ของ subscription แตกต่างกัน:**
- `employees`, `advances`, `salaries` → employee เห็นเฉพาะของตัวเอง (filter by `lineUserId == auth.uid` / scoped query)
- `leaves` → ทุกคน signed-in อ่านได้ (ปฏิทินทีมโชว์ใบลาทุกคน + กันยื่นลาทับวัน · ไม่มีฟิลด์อ่อนไหว) · leave doc เก็บ snapshot `employeeName + employeeNickname` ให้ peer อ่านชื่อได้โดยไม่ต้องเปิด `/employees` ทั้งคน · render: live > snapshot (ดู `docs/reference.md` → "Privacy: leaves") · filter/lookup ใช้ `employeeId` เสมอ ไม่ใช่ชื่อ
- `poolSnapshots` → ทุกคน signed-in อ่านได้ (public, non-sensitive — peer data สำหรับ pool calc)
- `roles`, `payrollConfirms` → ทุกคน signed-in อ่านได้

**กองกลาง (Pool) — Item-based architecture (PR #488-#513):**
- **`Role.poolItems`** — admin custom pool sales items per role (เดิม hardcode 3 รายการ)
  - `PoolItem = { id, label, kind: "pool"|"personal", threshold: number }`
  - `kind="pool"` แชร์กองกลาง (มี threshold % ของ top) · `kind="personal"` ใครขายใครได้ (ไม่แชร์)
  - `Role.primaryPoolItemId` — primary item สำหรับ `losesBaseSalary` check (< 50% ของ top primary → ขาด base) ตอน `poolExclusion="all"`
  - default 3 items: `{normal,kind=pool,80}`, `{special,kind=personal,80}`, `{buy,kind=pool,80}` · null/undefined → migrate-on-read
- **`Employee.poolItemRates: Record<string, number>`** — rate ต่อ item id · legacy `normalSalePieceRate`/`specialSalePieceRate`/`buyPieceRate` fallback
- **`Employee.poolExclusion`**: `null | "all" | string[]` — null=ไม่ปิด · `"all"`=ปิดทั้งหมด · `string[]`=ปิดเฉพาะ item ids
  - legacy `"sell"|"buy"|"both"` รองรับ backward compat (migrate-on-read)
- **`SalaryMonth.poolItemPieces: Record<string, number>`** — count ต่อ item id (snapshot per month) · legacy `normalSalePieces`/`specialSalePieces`/`buyPieces` fallback

**Pool adjustment (PoolAdjustmentModal):**
- `PoolAdjustmentItem.poolItemId` — admin เลือก pool item ที่จะหัก (Phase 3D) · legacy `side: "normal"|"buy"` รองรับ backward compat
- Calc engine routes via `excludedByItemId[itemId]` · per-item deduction

**Calc + snapshot:** — รายละเอียดเต็ม → `docs/reference.md`
- ทุกหน้าที่โชว์ค่าคอมเรียก `computePoolSharesForGroup` ตัวเดียวกัน (single source of truth) → SalaryView, PayrollSummaryPanel, SalaryAdminEdit, PoolFlowModal เลขตรงกันเสมอ
- Return shape: backward-compat fields เก่า + per-item `itemShares` · `itemPieces` · `topItemPieces` · `grossItemPool` · `totalItemPool` · `excludedItemsByItemId` · `poolItems` · `primaryPoolItemId`
- ตอน admin save salary, `updateSalary` เขียน snapshot `{ roleId, poolExclusion, totalLeaveDays }` ลง salary doc + mirror ลง collection `poolSnapshots/{ym}` (public, non-sensitive)
- **Privacy (phase 2 — ปัจจุบัน):** salaries อ่านได้แค่ admin/เจ้าของ (`firestore.rules`) · พนักงาน subscribe เฉพาะของตัวเอง · peer data ที่ pool calc ต้องใช้ดึงจาก `poolSnapshots` แล้ว merge ใน `useFirebaseAppData.salaryData` — ดู `docs/reference.md` → "Privacy: salaries vs poolSnapshots"
- ปุ่ม "ยืนยันยอด" ใน PayrollSummaryPanel เรียก `backfillPoolSnapshots()` ก่อน freeze สลิป — รับประกันว่า snapshot ถูกเขียนเสมอ (แม้สลิป freeze จะ fail)

### Gold price (`/config/goldPrice`) — auto-fetch infra

ราคาทองคำสมาคม 96.5% ใช้ทั่วระบบความรู้ต่างๆ (live tables + calculator default + live-example) · ดึงอัตโนมัติทุก 15 นาที

- **Cloud Function `fetchGoldPriceScheduled`** (`functions/src/goldPrice/fetchGoldPrice.ts`) — `onSchedule "*/15 * * * *" Asia/Bangkok`
- **Source chain** (fallback): `mukdagold /api/price2` (primary · JSON proxy ของสมาคม) → HSH `apicheckpricev3` REF (XML)
- **Skip write ถ้า no-change** — เช็ค `sellPrice + sourceDate + sourceTime` เท่าเดิม → ไม่เขียนซ้ำ (กัน Firestore write churn)
- **Sanity check:** 10,000 ≤ sellPrice ≤ 200,000 ฿/บาท
- **Manual trigger:** `fetchGoldPriceNow` callable (admin only) — ปุ่ม refresh ใน `GoldPriceHeader`
- **Error visibility:** fail ทั้งหมด → `lastFetchError + lastFetchErrorAt` ลง doc · UI โชว์กล่องแดงใน admin

Frontend: `useGoldPrice()` hook + `goldPriceDefault: true` flag ใน `CalcField` → input field sync ราคา live จนกว่า user แก้เอง (`touched` state)

### Auth Flow

```
กดปุ่ม LINE Login → redirect ไป LINE
  → callback กลับ + code
  → Cloud Function lineAuth แลก code → LINE profile
  → เช็ค ADMIN_LINE_USER_ID → ให้ admin claim (ถ้าตรง)
  → เช็ค employee.lineUserId → สร้าง Firebase custom token
  → signInWithCustomToken → เข้าระบบ
```

## Key Source Files

| Path | Description |
|---|---|
| `src/App.tsx` | Main orchestrator — routes, hooks, modals |
| `src/components/admin/AdminPanel.tsx` | Admin router — render section components (ดู "AdminPanel — section components") |
| `src/components/admin/EmployeeAdminPanel.tsx` + `EmployeeEditModal.tsx` | จัดการพนักงาน: list + ฟอร์มแก้ไข |
| `src/components/admin/LeaveSummaryPanel.tsx` / `LeaveListPanel.tsx` | สรุปลา / รายการลา |
| `src/types/index.ts` | Domain types ทั้งหมด |
| `src/constants.ts` | Colors, business rules, validation patterns |
| `src/data/useFirebaseAppData.ts` | Firestore real-time subscriptions + CRUD — `updateSalary` inject pool snapshot + mirror `poolSnapshots` |
| `src/firebase/hooks/useFirestore.ts` | Subscription hooks per collection (scope: admin vs employee) |
| `src/firebase/poolSnapshots.ts` | Public, non-sensitive copy ของ pool fields (privacy phase 2 infra) |
| `src/components/modals/PoolFlowModal.tsx` | แผนผังเงินเดือน (📊) — flow การแบ่งค่าคอมกองกลาง |
| `src/utils/salaryUtils.ts` | สูตรเงินเดือน + `computePoolSharesForGroup` (ใช้ snapshot ก่อนเสมอ) |
| `src/utils/leaveUtils.ts` | นับวันลา, คำนวณ over-quota |
| `src/utils/pdfFonts.ts` | Lazy-load + register Sarabun font กับ pdfmake (`addVirtualFileSystem`) |
| `src/firebase/auth.ts` | LINE Login + auth helpers |
| `src/contexts/AuthContext.tsx` | Auth state provider |
| `public/fonts/Sarabun-*.ttf` | Self-host Thai font (CSP block CDN ภายนอก) |
| `functions/src/index.ts` | Cloud Functions barrel exports + `setGlobalOptions({ serviceAccount: "petchmukda-bot@appspot.gserviceaccount.com" })` |
| `functions/src/line/` | LINE Bot webhook + commands (`ทดสอบแจ้งเตือน`, `คำสั่ง`, `ไอดีกลุ่ม`, ฯลฯ) |
| `functions/src/dailySummary/` | สรุปประจำวัน 07:30 — Google Calendar + คนหยุด + เคล็ดลับ Claude |
| `functions/src/maintenance/cleanupOldTips.ts` | ลบ `recentTips` ที่เก่ากว่า 60 วัน (กัน collection โต) |
| `functions/src/goldPrice/fetchGoldPrice.ts` | ดึงราคาทองคำสมาคมทุก 15 นาที (scheduled) + manual trigger (onCall) — source chain: mukdagold → HSH |
| `src/firebase/goldPrice.ts` | `/config/goldPrice` doc — subscribe/update + `triggerFetchGoldPriceNow` callable |
| `src/firebase/laborCost.ts` / `blockCost.ts` / `loyaltyPoints.ts` | `/config/{laborCost,blockCost,loyaltyPoints}` docs — admin-editable inline ในความรู้ต่างๆ · sync ทุก live table + calc |
| `src/utils/changePriceUtils.ts` | สูตรค่าเปลี่ยน นน. เท่ากัน + ราคาขาย/รับซื้อ 96.5% · `CHANGE_PRICE_WEIGHTS` + `SHORTCUT_MULTIPLIERS` (shared sell+buy) · `computeBuyPrice96` ใช้ `gold.buyPrice` (fallback sell) · `ceilTo50` |
| `src/content/knowledge/index.ts` | เนื้อหา "ความรู้ต่างๆ" hardcode 20+ sections (มาตรฐานน้ำหนัก, ค่าแรง, ขาย, รับซื้อ, จำนำ, VAT, ฯลฯ) |
| `src/content/knowledge/types.ts` | block types: h3 · p · list · table (`colWidths`/`colAlign`) · formula · example · live-example · calculator · change-price-table · sell-price-96-table · buy-price-96-table · labor-cost-table · block-cost-table · loyalty-points-redeem-table · secret · callout · image · steps |
| `src/components/knowledge/KnowledgeView.tsx` | Accordion render + search box (filter section.title) |
| `src/components/knowledge/KnowledgeBlock.tsx` | Block dispatch — render แต่ละ block type · callout รองรับ multi-line ผ่าน `whitespace-pre-line` |
| `src/components/knowledge/Calculator.tsx` | Live calculator block — `goldPriceDefault`/`buyPriceDefault`/`silverSell+BuyPriceDefault` sync ราคา live · `disabledWhen` conditional disable · comma thousand-separator + decimal preserve (rawTexts state) · badge "ราคาวันนี้" สีแยกขายเขียว/รับซื้อแดง · แสดงเมื่อ value = live |
| `src/components/knowledge/LiveExample.tsx` / `MathText.tsx` | example อิงราคาวันนี้ (sell/buy/silverBuy/labor) · wrap +/−/×/÷/= ใน font-mono · MathText รองรับ `**bold**` |
| `src/components/knowledge/GoldPriceHeader.tsx` / `ChangePriceTable.tsx` / `SellPrice96Table.tsx` / `BuyPrice96Table.tsx` | Live tables ใน "ความรู้ต่างๆ" · BuyPrice96Table ใช้ `gold.buyPrice` (ไม่ใช่ pricePerBaht) · GoldPriceHeader มีปุ่ม refresh ทั้งทอง+เงิน (toast แสดงราคาก่อน/หลัง) |
| `src/components/knowledge/LaborCostTable.tsx` / `BlockCostTable.tsx` / `LoyaltyPointsRedeemTable.tsx` | Admin-editable live tables — inline edit + sync ทุก signed-in |
| `firestore.rules` | Firestore security rules |
| `storage.rules` | Storage security rules |

## Business Rules (Summary)

| Rule | Value |
|---|---|
| โควต้าวันลา/เดือน (weekday) | 2 วัน |
| ตัวคูณวันอาทิตย์ | 1.5× ของ dailyRate |
| เกณฑ์เข้า Pool (per item · admin custom) | default 80% ของ top item (PR #488+) |
| เกณฑ์ได้เงินเดือนพื้นฐาน | ≥ 50% ของ top primary item (poolExclusion="all") |
| วันลา "ฟรี" ก่อนเริ่มหัก % ใน Pool | 2 วันแรก (ไม่กระทบ) |
| เพดานเบิกล่วงหน้า | 50% ของ baseSalary |
| โบนัสแห่งความขยัน (0 วันลา) | 2 × dailyRate |
| โบนัสแห่งความขยัน (1 วันลา) | 1 × dailyRate |
| โบนัสแห่งความขยัน (≥ 2 วันลา) | 0 |
| `dailyRate` | baseSalary ÷ 30 |

ค่าทั้งหมดอยู่ใน `src/constants.ts` → `BUSINESS_RULES` · สูตรเต็ม → `docs/reference/business-rules.md`

### ปฏิทินเปิด-ปิดร้าน (storeCalendar)

**ร้านหยุดวันเสาร์เป็นค่าตั้งต้น** · admin override ได้ผ่าน `/config/storeCalendar`:
- `extraOpenSaturdays`: เสาร์ที่ admin เปิดพิเศษ (พนักงานมาทำงาน)
- `extraClosedWeekdays`: จ-ศ ที่ admin ปิดพิเศษ (อบรม/หยุดยาว ฯลฯ)

| วัน | สถานะ default | การลา |
|---|---|---|
| อาทิตย์ | เปิด (× 1.5) | หักทุกวัน × 1.5 dailyRate, ไม่นับโควต้า (กฎเดิม) |
| **เสาร์** | **ปิด** | **ไม่นับ** (ลาวันร้านปิดไม่กระทบเงินเดือน) |
| เสาร์ ∈ extraOpenSaturdays | เปิด | นับเหมือนวันธรรมดา (โควต้า 2 วัน/เดือน + เกินหัก × 1) |
| จ-ศ | เปิด | นับเข้าโควต้า · เกินหัก × 1 dailyRate |
| จ-ศ ∈ extraClosedWeekdays | ปิด | ไม่นับ |

**ผลต่อระบบ:**
- **หน้าที่:** วันที่ร้านปิด → ไม่โผล่ assignment ใดๆ (server filter ใน Cloud Function `recomputeDutyAssignments`)
- **การลา:** `leaveUtils.ts` รับ `storeCalendar` param · ใช้นับ "วันทำงาน" สำหรับโควต้า/หัก/โบนัสขยัน
- **UI admin:** Section "วันเปิด-ปิดร้าน" ใน sidebar (กลุ่ม "ปฏิทิน")

Single source: `src/utils/storeCalendar.ts` · sync helper `applicableDuties` ใน duty client/server ผ่าน CI sync check (`scripts/check-duty-sync.mjs`)

## Conventions

- ภาษาไทยใน UI, ภาษาอังกฤษใน code
- **Terminology:** UI ใช้คำว่า "กองกลาง" — code ใช้ `pool` (`poolGroup`, `computePoolSharesForGroup`, ฯลฯ) อย่าเปลี่ยน identifier เป็นไทย
- **วันที่ใน UI ต้องเป็นไทยเสมอ** — พ.ศ. (= ค.ศ. + 543) + เดือนไทย (ม.ค./ก.พ./... หรือเต็ม) · ห้ามใช้ `toLocaleDateString("th-TH", { year: "numeric" })` ตรงๆ (มันคืน ค.ศ.) · ใช้ helper จาก `src/utils/dateUtils.ts` (`fmtDate`, `fmtShort`, `fmtDateWithWeekday`) หรือ `THAI_MONTH_NAMES` จาก `src/constants.ts` · data layer (Firestore, state) ใช้ `YYYY-MM-DD` ค.ศ. ต่อ — แปลงเฉพาะตอน render
- **Color contrast บน maroon bg → text-white** (ไม่ใช่ text-gold-lt) เพื่อ readability — gold-lt อ่านยากบน maroon
- **Typography:** font หลักคือ **Prompt** (set ใน `index.css` → `--font-sans: "Prompt", "Sarabun", "Noto Sans Thai", sans-serif` + apply กับ body) · default inherit ทั่วระบบ ไม่ต้อง specify · ในกรณี button/input/select ที่ browser override → ใส่ `font-[inherit]` · ข้อยกเว้น (ใช้ font อื่น):
  - **`font-mono`** — `MathText` (เครื่องหมายคำนวณ +/−/×/÷/= · Prompt stroke บางเกินไป) · `Secret` (PIN/รหัส dot mask · กัน confusion) · `ErrorBoundary` (stack trace)
  - **`font-[Prompt,monospace]`** (Prompt หลัก + mono fallback) — identifier ที่ admin พิมพ์ เช่น role id, LINE command, lineUserId · pattern ใน `RolesAdminPanel`, `LineBotCommandsPanel`, `EmployeeEditModal`
- Named Firestore database: `petchmukda-bot` (ไม่ใช่ default)
- Cloud Functions region: `asia-southeast1`
- Emulator detect จาก hostname (`localhost` / `127.0.0.1`)
- Color theme: Maroon (#7B1C1C) + Gold (#C9973A) + Cream (#FDF8F0)
- **Metal tones — เฉพาะใน "ความรู้ต่างๆ" (knowledge content) เท่านั้น:** ส่วนอื่นทั้งระบบ (admin, salary, leave, LINE bot ฯลฯ) **คงสี maroon brand theme เดิม ห้ามเปลี่ยน** · convention นี้สโคปแคบที่ block `h3`/`table`/`calculator`/`live-example` ใน knowledge view เพื่อสื่อความหมายวัสดุ
  - **ทอง (96.5%, 99.99%)** → `tone="maroon"` (default) · CSS `bg-maroon`/`text-maroon` (#7B1C1C)
  - **เงิน** → `tone="silver"` · CSS `bg-silver`/`text-silver` (#5A5A60 graphite gray) · h3 text-only variant: `tone="silver-text"`
  - **นาก** → `tone="nak"` · CSS `bg-rose-gold`/`text-rose-gold` (#B76E79 rose gold — สื่อสีจริงของนาก ทอง + ทองแดง) · h3 text-only variant: `tone="nak-text"`
  - กฎ: เมื่อเพิ่ม example/calculator/table ใหม่ใน knowledge ต้อง tag tone ให้ตรงกับวัสดุ — อย่าทิ้ง default maroon ไว้กับ section เงิน/นาก
- Mobile-first layout (max 430px) + Desktop sidebar (>= 768px)
- Breaking changes acceptable (pre-production)

## Deployment

ทุกอย่าง auto deploy ผ่าน GitHub Actions (`.github/workflows/deploy.yml`) เมื่อ push เข้า `main`:
- **Hosting** (`deploy-hosting`)
- **Functions** (`deploy-functions`) — ไม่ต้องรัน `firebase deploy` เอง
- **Firestore Rules** (`deploy-firestore-rules`)
- **Storage Rules** (`deploy-storage-rules`)

ผู้พัฒนาทำงานผ่าน Claude Code on the web ทั้งหมด — **ไม่มี local clone**, file ทุกอย่างอยู่บน GitHub และ container ของ session นี้เท่านั้น ดังนั้นทำ deploy ด้วยมือไม่ได้ และไม่ต้องบอก user ให้รันคำสั่งบนเครื่องตัวเอง

- **LINE config:** Firestore `config/secrets` document (`LINE_CHANNEL_ACCESS_TOKEN`, `ADMIN_LINE_USER_ID`, `ANTHROPIC_API_KEY`, ฯลฯ)
- **URL:** https://petchmukda-bot.web.app

### Daily Summary (07:30)

Cloud Functions `sendDailySummary` ส่ง flex สรุปประจำวันเข้า LINE 3 กลุ่ม (`DAILY_SUMMARY_GROUPS` ใน `functions/src/dailySummary/config.ts`) — มี 3 section ในกล่องเดียว:
1. **📋 ภารกิจวันนี้** — ดึงจาก Google Calendar (3 calendars แยกตามกลุ่ม)
2. **👥 พนักงานหยุดวันนี้** — เฉพาะกลุ่มที่ `includeLeaves: true` (we r mukda)
3. **💡 เคล็ดลับมืออาชีพ** — Claude API (เฉพาะ `sendAiTip: true`) + dedup ด้วย `recentTips` collection (30 ล่าสุด)

**Setup ที่ต้องทำครั้งเดียวต่อ Firebase project:**
1. Share Google Calendars ทั้ง 3 ใบกับ `petchmukda-bot@appspot.gserviceaccount.com` (permission: "See all event details")
2. Enable **Google Calendar API** ใน GCP Console: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=petchmukda-bot
3. เพิ่ม `ANTHROPIC_API_KEY` ใน Firestore `config/secrets`

**Manual test:** พิมพ์ `ทดสอบแจ้งเตือน` ใน LINE 1:1 chat — bot push ตัวอย่างมาให้ admin ดู (เรียก Claude API จริง + เห็นทุก section)

**Idempotency:** `dailySummarySent/{ymd}` claim ผ่าน transaction — กัน Cloud Scheduler ยิงซ้ำส่งสแปม

## Reference Docs

- **`docs/reference.md`** — สารบัญ + สถาปัตยกรรมกองกลาง (Pool): single source of truth, privacy phase 1/2 (เริ่มที่นี่)
- `docs/reference/business-rules.md` — สูตรเงินเดือน, กองกลาง (Pool), วันลา, ราคาทอง 96.5%, สูตรค่าเปลี่ยน
- `docs/reference/firebase-collections.md` — Firestore schema (รวม `/config/goldPrice`) + security rules
- `docs/reference/line-integration.md` — LINE Bot commands, webhook, auth
- `docs/reference/ui-components.md` — Component tree + shared components + Knowledge view
