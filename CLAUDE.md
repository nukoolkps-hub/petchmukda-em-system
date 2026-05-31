# Petchmukda EM System

ระบบจัดการพนักงานห้างเพชรทองมุกดา — การลา, เงินเดือน, ค่าคอมกองกลาง (Pool), เบิกเงินล่วงหน้า, LINE Bot

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- **Backend:** Firebase Cloud Functions (Node.js 22, TypeScript)
- **Database:** Firestore (named database: `petchmukda-bot`)
- **Auth:** Firebase Auth (LINE Login + Dev mode)
- **Storage:** Firebase Storage
- **Linting:** Biome
- **Icons:** `lucide-react` (อันเดียวทั้งระบบ — ไม่ผสมชุดอื่น)
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
                                       ├── /home     → HomeTab (leave quota, team calendar)
                                       ├── /request  → RequestTab (leave form)
                                       ├── /salary   → SalaryView (employee salary view)
                                       └── /admin    → AdminPanel (admin-only)
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

### Data Flow

```
useAppData() → useFirebaseAppData() → Firestore real-time (onSnapshot)
                                       ├── employees     (admin: all · employee: own only)
                                       ├── leaves        (admin: all · employee: own only)
                                       ├── salaries      (admin: all via collectionGroup · employee: own only)
                                       ├── advances      (admin: all · employee: own only)
                                       ├── roles         (all signed-in)
                                       ├── payrollConfirms (all signed-in)
                                       └── poolSnapshots  (all signed-in — peer pool fields)
```

**Scope ของ subscription แตกต่างกัน:**
- `employees`, `leaves`, `advances`, `salaries` → employee เห็นเฉพาะของตัวเอง (filter by `lineUserId == auth.uid` / scoped query)
- `poolSnapshots` → ทุกคน signed-in อ่านได้ (public, non-sensitive — peer data สำหรับ pool calc)
- `roles`, `payrollConfirms` → ทุกคน signed-in อ่านได้

**กองกลาง (Pool) calc + snapshot:** — รายละเอียดเต็ม → `docs/reference.md`
- ทุกหน้าที่โชว์ค่าคอมเรียก `computePoolSharesForGroup` ตัวเดียวกัน (single source of truth) → SalaryView, PayrollSummaryPanel, SalaryAdminEdit, PoolFlowModal เลขตรงกันเสมอ
- ตอน admin save salary, `updateSalary` เขียน snapshot `{ roleId, poolExclusion, totalLeaveDays }` ลง salary doc + mirror ลง collection `poolSnapshots/{ym}` (public, non-sensitive)
- **Privacy (phase 2 — ปัจจุบัน):** salaries อ่านได้แค่ admin/เจ้าของ (`firestore.rules`) · พนักงาน subscribe เฉพาะของตัวเอง · peer data ที่ pool calc ต้องใช้ดึงจาก `poolSnapshots` แล้ว merge ใน `useFirebaseAppData.salaryData` — ดู `docs/reference.md` → "Privacy: salaries vs poolSnapshots"
- ปุ่ม "ยืนยันยอด" ใน PayrollSummaryPanel เรียก `backfillPoolSnapshots()` ก่อน freeze สลิป — รับประกันว่า snapshot ถูกเขียนเสมอ (แม้สลิป freeze จะ fail)

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
| `functions/src/index.ts` | Cloud Functions barrel exports |
| `functions/src/line/` | LINE Bot webhook + commands |
| `firestore.rules` | Firestore security rules |
| `storage.rules` | Storage security rules |

## Business Rules (Summary)

| Rule | Value |
|---|---|
| โควต้าวันลา/เดือน (weekday) | 2 วัน |
| ตัวคูณวันอาทิตย์ | 1.5× ของ dailyRate |
| เกณฑ์เข้า Pool (sell/buy แยกกัน) | ≥ 80% ของ top |
| เกณฑ์ได้เงินเดือนพื้นฐาน | ≥ 50% ของ top (poolExclusion=both) |
| วันลา "ฟรี" ก่อนเริ่มหัก % ใน Pool | 2 วันแรก (ไม่กระทบ) |
| เพดานเบิกล่วงหน้า | 50% ของ baseSalary |
| โบนัสแห่งความขยัน (0 วันลา) | 2 × dailyRate |
| โบนัสแห่งความขยัน (1 วันลา) | 1 × dailyRate |
| โบนัสแห่งความขยัน (≥ 2 วันลา) | 0 |
| `dailyRate` | baseSalary ÷ 30 |

ค่าทั้งหมดอยู่ใน `src/constants.ts` → `BUSINESS_RULES` · สูตรเต็ม → `docs/reference/business-rules.md`

## Conventions

- ภาษาไทยใน UI, ภาษาอังกฤษใน code
- **Terminology:** UI ใช้คำว่า "กองกลาง" — code ใช้ `pool` (`poolGroup`, `computePoolSharesForGroup`, ฯลฯ) อย่าเปลี่ยน identifier เป็นไทย
- Named Firestore database: `petchmukda-bot` (ไม่ใช่ default)
- Cloud Functions region: `asia-southeast1`
- Emulator detect จาก hostname (`localhost` / `127.0.0.1`)
- Color theme: Maroon (#7B1C1C) + Gold (#C9973A) + Cream (#FDF8F0)
- Mobile-first layout (max 430px) + Desktop sidebar (>= 768px)
- Breaking changes acceptable (pre-production)

## Deployment

ทุกอย่าง auto deploy ผ่าน GitHub Actions (`.github/workflows/deploy.yml`) เมื่อ push เข้า `main`:
- **Hosting** (`deploy-hosting`)
- **Functions** (`deploy-functions`) — ไม่ต้องรัน `firebase deploy` เอง
- **Firestore Rules** (`deploy-firestore-rules`)
- **Storage Rules** (`deploy-storage-rules`)

ผู้พัฒนาทำงานผ่าน Claude Code on the web ทั้งหมด — **ไม่มี local clone**, file ทุกอย่างอยู่บน GitHub และ container ของ session นี้เท่านั้น ดังนั้นทำ deploy ด้วยมือไม่ได้ และไม่ต้องบอก user ให้รันคำสั่งบนเครื่องตัวเอง

- **LINE config:** Firestore `config/secrets` document
- **URL:** https://petchmukda-bot.web.app

## Reference Docs

- **`docs/reference.md`** — สารบัญ + สถาปัตยกรรมกองกลาง (Pool): single source of truth, privacy phase 1/2 (เริ่มที่นี่)
- `docs/reference/business-rules.md` — สูตรเงินเดือน, กองกลาง (Pool), วันลา
- `docs/reference/firebase-collections.md` — Firestore schema + security rules
- `docs/reference/line-integration.md` — LINE Bot commands, webhook, auth
- `docs/reference/ui-components.md` — Component tree + shared components
