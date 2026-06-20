# 💎 ห้างเพชรทองมุกดา — ระบบพนักงาน

ระบบจัดการพนักงานครบวงจร — การลา · เงินเดือน · ค่าคอมกองกลาง · เบิกเงินล่วงหน้า · กู้เงินผ่อนคืน · หน้าที่หมุนเวียน · LINE Bot

> ⚡ **Production-ready** — React 19 + TypeScript + Firebase + LINE Login + Cloud Functions

---

## 🛠 Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- **Backend:** Firebase Cloud Functions (Node 22, TypeScript)
- **Database:** Firestore (named DB `petchmukda-bot`)
- **Auth:** Firebase Auth (LINE Login + Dev mode)
- **Storage:** Firebase Storage
- **Icons:** `lucide-react` (ห้ามใช้ emoji เป็น icon ใน UI)
- **PDF:** pdfmake 0.3.x + Sarabun font (self-hosted)
- **Routing:** react-router-dom v7 (HashRouter)
- **Lint:** Biome

---

## 🚀 Quick Start

```bash
npm install
npm run dev          # Vite + Firebase Emulators (auth/firestore/functions/storage)
```

เปิด `http://localhost:5173` — emulator mode ใช้บัญชี dev สำหรับทดสอบ

ขั้นตอนอื่นๆ:
```bash
npm run build         # production build (output: dist/)
npm run typecheck     # tsc + check client/server algorithm sync
npm run check         # Biome lint + format (--write)
npm run check:duty-sync   # ตรวจ rotation algorithm client/server ตรงกัน
npm run build:functions   # compile Cloud Functions
```

---

## 📂 โครงสร้างโปรเจกต์

```
src/
├── App.tsx                          # Orchestrator (routes + hooks + modals)
├── constants.ts                     # COLORS · BUSINESS_RULES · THAI_BANKS
├── main.tsx                         # Entry + AuthProvider + AuthGate
│
├── contexts/
│   └── AuthContext.tsx              # Auth state provider
│
├── data/
│   ├── useAppData.ts                # ทาง entry สำหรับ component (เรียก useFirebaseAppData)
│   └── useFirebaseAppData.ts        # subscription + CRUD ทุก collection
│
├── firebase/
│   ├── config.ts                    # initApp + named DB + emulator detect
│   ├── auth.ts                      # LINE Login + dev mode
│   ├── employees.ts · leaves.ts     # CRUD ต่อ collection
│   ├── salaries.ts · advances.ts
│   ├── roles.ts · duties.ts
│   ├── employeeLoans.ts · poolSnapshots.ts
│   ├── poolAdjustments.ts · payrollConfirms.ts
│   ├── dutyAssignments.ts           # server-computed snapshot reader
│   ├── storeCalendar.ts             # ปฏิทินเปิด-ปิดร้าน
│   └── hooks/
│       ├── useAuth.ts
│       └── useFirestore.ts          # real-time hooks ต่อ collection
│
├── hooks/                           # custom hooks (useProfile · useLeaveForm · useClickOutside · …)
├── utils/
│   ├── dutyUtils.ts                 # ⚠️ มี sync check กับ functions/src/duty/dutyUtils.ts
│   ├── leaveUtils.ts                # นับวันลา (calendar-aware)
│   ├── salaryUtils.ts               # calculateSalary + computePoolSharesForGroup
│   ├── storeCalendar.ts             # isStoreClosed · isQuotaCountableDay
│   ├── sanitizeRichText.ts          # XSS whitelist sanitizer
│   ├── payrollLock.ts               # กฎปิดรอบ 7 วันหลังยืนยันยอด
│   └── dateUtils.ts · format.ts · …
│
├── components/
│   ├── admin/                       # AdminPanel + sub-panels
│   ├── home/                        # HomeTab · TeamCalendar · RequestTab
│   ├── salary/                      # SalaryView · SalaryAdminEdit
│   ├── modals/                      # PoolFlowModal · ManualModal · …
│   ├── shared/                      # AvatarCircle · BaseModal · ModalHeader · ToggleSwitch · …
│   └── layout/                      # Sidebar · BottomNav · MobileHeader · adminNavConfig
│
└── print/                           # printSalarySlip + pdfBuilders + pdfFonts (Sarabun)

functions/src/
├── index.ts                         # barrel exports
├── advance/                         # notifications + cleanup
├── auth/                            # bootstrapAdmin · devAuth · lineAuth · setAdmin
├── dailySummary/                    # สรุปวันละครั้ง → LINE
├── duty/                            # dutyUtils + recompute snapshot ⚠️ mirror ของ src/utils/dutyUtils.ts
├── line/                            # webhook + commands (เชื่อมพนักงาน · ทดสอบแจ้งเตือน · ฯลฯ)
├── maintenance/                     # cleanupOldSlips · cleanupOldTips · cleanupOldAdvances
└── payroll/                         # onLeaveCreated trigger

scripts/
└── check-duty-sync.mjs              # CI script เทียบ function body client/server

public/fonts/Sarabun-*.ttf           # Self-host Thai font (CSP block CDN)
firestore.rules · storage.rules
firebase.json · firestore.indexes.json
```

---

## 🎯 Features

### ระบบหลัก
- 📅 **ระบบลา** — ลากิจ/ลาป่วย · โควต้า 2 วัน/เดือน (วันธรรมดา) · ลาวันอาทิตย์หัก × 1.5
- 💰 **ระบบเงินเดือน** — เรท/ชิ้น × จำนวน + กองกลาง (Pool) + โบนัสขยัน
- 🤝 **กองกลาง (Pool)** — แบ่งค่าคอมตามสูตร Excel · เกณฑ์เข้า Pool ≥ 80% ของ top · `computePoolSharesForGroup` (single source of truth)
- 💸 **เบิกล่วงหน้า** — เพดาน 50-100% ตามอายุงาน · 1 ครั้ง/เดือน · admin approve/reject + แนบสลิปโอน · LINE แจ้งผล · หักในเดือนที่เบิก
- 💳 **กู้เงินผ่อนคืน** — 1 ก้อน/คน · หักจากเงินเดือนรายเดือนจนครบ · admin แนบสลิปโอน → LINE bot แจ้งพนักงานทันที (พร้อมรูปสลิป)
- 🖨 **พิมพ์เอกสาร** — สลิปเงินเดือน (เลือกได้: รายละเอียดทั้งหมด/บางส่วน) + ใบรับรองเงินเดือน (ระบุยอดเองได้ · ห้ามเกินจริง) · PDF + Thai font Sarabun

### ระบบหน้าที่ (Rotation Stability A+B+C)
- 🔄 **หน้าที่หมุนเวียน** — admin ตั้งครั้งเดียว · ระบบหมุนรายสัปดาห์/รายเดือนอัตโนมัติ
- 🤝 **แทนคนลา (coverage)** — เลือก "คนเคยแทนน้อยสุดก่อน" (ยุติธรรม) · ตั้งเงินตอบแทนต่อครั้งได้
- 🛡 **Stable hash slot** — เพิ่ม/ลบหน้าที่ตัวอื่น ไม่กระทบ slot ของหน้าที่นี้
- 🔒 **Primary cache per period** — pool เปลี่ยนกลางสัปดาห์ ตารางไม่เด้ง
- 📅 **ปฏิทินดูล่วงหน้า** — พนักงานวางแผนได้ถึงสิ้นปี

### ระบบปิด-ปิดร้าน (Store Calendar)
- 🏪 **เสาร์ปิด default** + admin เปิดบางเสาร์เป็นกรณีพิเศษ
- 🔒 admin ปิดวันธรรมดาบางวันได้ (อบรม · หยุดยาว)
- ✅ ปฏิทินหน้าแรกของพนักงาน + ฝั่ง admin sync real-time
- 📊 ลาวันปิด = ไม่นับ · ลาเสาร์เปิดพิเศษ = นับเข้าโควต้า

### ระบบตำแหน่ง (Role)
- 👥 จัดกลุ่มพนักงานเป็นตำแหน่ง · บางตำแหน่งแชร์กองกลาง (poolGroup)
- 📝 **หน้าที่หลัก** ของตำแหน่ง — rich text editor (เล็ก/กลาง/ใหญ่ · bold · bullet)
- 🛡 XSS sanitize on-write (single source of truth — ปลอดภัยทุก surface)

### ระบบยืนยันยอด (Payroll Lock)
- 🔐 admin "ยืนยันยอด" รายเดือน · เริ่ม grace period 7 วัน
- 🔒 หลัง 7 วัน → เดือนนั้นถูกล็อกถาวร (ลา/ยอด/เบิก แก้ไม่ได้แม้ admin)
- ⚠️ UI สะท้อน rules ตรงกัน — กดปุ่มลบใบลาเดือนที่ปิดรอบ = ปุ่มเป็นไอคอนกุญแจ disabled

### LINE Bot
- 📩 **คำสั่ง:** `ทดสอบแจ้งเตือน` · `คำสั่ง` · `ไอดีกลุ่ม` · `ไอดีฉัน` · `เชื่อมพนักงาน`
- 📰 **สรุปประจำวัน 07:30** — Google Calendar + คนหยุด + เคล็ดลับ Claude API
- 🔔 แจ้งเตือนเบิกเงิน (approved/rejected) เข้า LINE 1:1

---

## 🔐 Authentication Flow

```
กดปุ่ม LINE Login → redirect ไป LINE
  → callback กลับ + code
  → Cloud Function lineAuth แลก code → LINE profile
  → เช็ค ADMIN_LINE_USER_ID → ให้ admin claim ถ้าตรง
  → เช็ค employee.lineUserId → สร้าง Firebase custom token
  → signInWithCustomToken → เข้าระบบ
```

### Admin Setup (LINE)
1. Add LINE bot เป็นเพื่อน
2. ส่ง `ไอดีฉัน` ใน 1:1 chat → bot ส่ง LINE user ID กลับ
3. ใส่ user ID ลง `/config/secrets` ที่ field `ADMIN_LINE_USER_ID`
4. Login ผ่านปุ่ม "Login ด้วย LINE" — ระบบใส่ admin claim ให้อัตโนมัติ

Employee LINE — admin ใช้คำสั่ง `เชื่อมพนักงาน` ใน LINE webhook (ดู `functions/src/line/commands/setupEmployee.ts`)

---

## 📚 Documentation

| ไฟล์ | คำอธิบาย |
|---|---|
| [README.md](./README.md) | คู่มือหลัก (ไฟล์นี้) |
| [CLAUDE.md](./CLAUDE.md) | คู่มือ codebase สำหรับ AI assistant + business rules |
| [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) | ตั้งค่า Firebase ตั้งแต่ศูนย์ |
| [docs/reference.md](./docs/reference.md) | สารบัญ reference + สถาปัตยกรรมกองกลาง |
| [docs/reference/business-rules.md](./docs/reference/business-rules.md) | สูตรเงินเดือน · กองกลาง · วันลา · ปฏิทินเปิด-ปิด |
| [docs/reference/firebase-collections.md](./docs/reference/firebase-collections.md) | Firestore schema + security rules |
| [docs/reference/line-integration.md](./docs/reference/line-integration.md) | LINE Bot commands · webhook · auth |
| [docs/reference/ui-components.md](./docs/reference/ui-components.md) | Component tree + shared components |
| [firestore.rules](./firestore.rules) | Security rules (มี mirror ของ payroll lock + monthLocked) |

---

## ⚙️ Environment Variables

### Frontend (Vite — baked in build time)
```env
VITE_LINE_LOGIN_CHANNEL_ID=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIRESTORE_DATABASE_ID=petchmukda-bot
```

Production deploy ผ่าน GitHub Actions อ่านจาก GitHub Secrets (ดู `.github/workflows/deploy.yml`)

### Cloud Functions (runtime — Firestore doc)

`/config/secrets`:
```env
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
ADMIN_LINE_USER_ID=U...
LINE_LOGIN_CHANNEL_ID=...
LINE_LOGIN_CHANNEL_SECRET=...
ANTHROPIC_API_KEY=...   # สำหรับ daily summary tip
```

Client Firestore rules deny ทุก `/config/*` ยกเว้น `notifications` (admin only) + `storeCalendar` (read = signed-in, write = admin)

---

## 🚢 Deployment

ทุกอย่าง auto deploy ผ่าน GitHub Actions เมื่อ push เข้า `main`:
- **Hosting** (`deploy-hosting`)
- **Functions** (`deploy-functions`) — รัน `check-duty-sync` ก่อน build (กัน algorithm client/server diverge)
- **Firestore Rules** (`deploy-firestore-rules`)
- **Storage Rules** (`deploy-storage-rules`)

ผู้พัฒนาทำงานผ่าน Claude Code on the web — ไม่มี local clone

URL: https://petchmukda-bot.web.app

---

## 🧪 Local Development

```bash
npm run dev               # Vite + Firebase Emulators (auto)
npm run emulators         # Emulators เฉยๆ
npm run typecheck         # tsc + duty-sync check
npm run check             # Biome lint + format
```

Emulator detect ผ่าน hostname (`localhost` / `127.0.0.1`) — ไม่ต้องตั้ง env

---

## 🛡 Rotation Algorithm Sync Check

`src/utils/dutyUtils.ts` (client) และ `functions/src/duty/dutyUtils.ts` (server) มีอัลกอริทึมเลือก primary ที่ต้องเหมือนกันเป๊ะ — ถ้า drift → forecast ฝั่ง admin ไม่ตรงกับ snapshot จริง

`scripts/check-duty-sync.mjs` เทียบ function body 5 ตัวหลังตัด comment/whitespace:
- `hashDutyId` · `pickPrimary` · `assignPrimaries` · `isSunday` · `applicableDuties`

รันใน `npm run typecheck` + workflow `deploy-functions` ก่อน build · diverge = CI แดง

---

## 📈 Limits (Firebase Free Tier)

| Resource | Limit | สถานะ |
|---|---|---|
| Firestore reads | 50,000/day | ใช้ snapshot pattern · ปกติ < 5k/day |
| Firestore writes | 20,000/day | ปกติ < 500/day |
| Document size | 1 MB max | image resize ก่อน upload |
| Cloud Functions | 2M invocations/month | ใช้ < 10k/month |

ร้านขนาดพนักงาน < 50 คน — Free tier ยืนยาวมาก

---

## 🎯 Roadmap

- [x] Firebase real-time sync
- [x] LINE Login + Admin custom claim
- [x] Cloud Functions (advance notify · daily summary · duty recompute)
- [x] Pool commission system (single source of truth)
- [x] Duty rotation (A+B+C: stable hash · period cache · auto-anchor)
- [x] Coverage duty (แทนคนลา + เงินตอบแทน)
- [x] Store calendar (วันเปิด-ปิดร้าน + override)
- [x] Rich text "หน้าที่หลัก" ของตำแหน่ง (sanitize on-write)
- [x] Payroll lock (7-day grace · rules mirror)
- [ ] PWA / offline mode
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] i18n (อังกฤษ)
