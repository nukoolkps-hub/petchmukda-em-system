# Petchmukda EM System

ระบบจัดการพนักงานห้างเพชรทองมุกดา — การลา, เงินเดือน, ค่าคอม Pool, เบิกเงินล่วงหน้า, LINE Bot

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- **Backend:** Firebase Cloud Functions (Node.js 22, TypeScript)
- **Database:** Firestore (named database: `petchmukda-bot`)
- **Auth:** Firebase Auth (LINE Login + Dev mode)
- **Storage:** Firebase Storage
- **Linting:** Biome
- **PDF:** pdfmake (Thai font: Sarabun)
- **Routing:** react-router-dom v7 (HashRouter)

## Commands

```bash
npm run dev          # Frontend + Firebase Emulators
npm run build        # Production build (output: dist/)
npm run typecheck    # TypeScript check
npm run check        # Biome lint + format

# Functions
cd functions && npm run build    # Build Cloud Functions
firebase deploy --only functions # Deploy Functions
firebase deploy --only hosting   # Deploy Hosting
```

## Architecture

```
main.tsx → AuthProvider → AuthGate → App.tsx (LeaveApp)
                                       ├── /home     → HomeTab (leave quota, team calendar)
                                       ├── /request  → RequestTab (leave form)
                                       ├── /salary   → SalaryView (employee salary view)
                                       └── /admin    → AdminPanel (admin-only)
```

### Data Flow

```
useAppData() → useFirebaseAppData() → Firestore real-time (onSnapshot)
                                       ├── employees
                                       ├── leaves
                                       ├── salaries/{employeeId}/months/{YYYY-MM}
                                       ├── advances
                                       ├── roles
                                       └── payrollConfirms
```

- Admin เห็นทุก document
- Employee เห็นเฉพาะของตัวเอง (filter by `lineUserId == auth.uid`)

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
| `src/types/index.ts` | Domain types ทั้งหมด |
| `src/constants.ts` | Colors, business rules, validation patterns |
| `src/data/useFirebaseAppData.ts` | Firestore real-time subscriptions + CRUD |
| `src/utils/salaryUtils.ts` | สูตรเงินเดือน + Pool commission |
| `src/utils/leaveUtils.ts` | นับวันลา, คำนวณ over-quota |
| `src/firebase/auth.ts` | LINE Login + auth helpers |
| `src/contexts/AuthContext.tsx` | Auth state provider |
| `functions/src/index.ts` | Cloud Functions barrel exports |
| `functions/src/line/` | LINE Bot webhook + commands |
| `firestore.rules` | Firestore security rules |
| `storage.rules` | Storage security rules |

## Business Rules (Summary)

| Rule | Value |
|---|---|
| โควต้าวันลา/เดือน (weekday) | 2 วัน |
| ตัวคูณวันอาทิตย์ | 1.5x |
| เกณฑ์เข้า Pool | >= 80% ของ top |
| เกณฑ์ได้เงินเดือนพื้นฐาน | >= 50% ของ top (poolExclusion=both) |
| เพดานเบิกล่วงหน้า | 50% ของ baseSalary |
| โบนัสมาครบ 0 วันลา | 500 บาท |
| โบนัสมาครบ 1 วันลา | 300 บาท |

สูตรเต็ม → `docs/reference/business-rules.md`

## Conventions

- ภาษาไทยใน UI, ภาษาอังกฤษใน code
- Named Firestore database: `petchmukda-bot` (ไม่ใช่ default)
- Cloud Functions region: `asia-southeast1`
- Emulator detect จาก hostname (`localhost` / `127.0.0.1`)
- Color theme: Maroon (#7B1C1C) + Gold (#C9973A) + Cream (#FDF8F0)
- Mobile-first layout (max 430px) + Desktop sidebar (>= 768px)
- Breaking changes acceptable (pre-production)

## Deployment

- **Hosting:** GitHub Actions auto deploy on push to `main`
- **Functions:** Manual `firebase deploy --only functions`
- **LINE config:** Firestore `config/secrets` document
- **URL:** https://petchmukda-bot.web.app

## Reference Docs

- `docs/reference/business-rules.md` — สูตรเงินเดือน, Pool, วันลา
- `docs/reference/firebase-collections.md` — Firestore schema + security rules
- `docs/reference/line-integration.md` — LINE Bot commands, webhook, auth
- `docs/reference/ui-components.md` — Component tree + shared components
