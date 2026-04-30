# 💎 ระบบพนักงานห้างเพชรทองมุกดา

ระบบจัดการพนักงานครบวงจร — การลา · เงินเดือน · ค่าคอม Pool · เบิกเงินล่วงหน้า · หนังสือรับรอง · LINE Bot

> ⚡ **Production-ready** — Firebase + LINE Login + Cloud Functions + Custom Admin Claims

---

## 🚀 Quick Start

### Mode 1: Demo (in-memory) — เริ่มได้ทันที

```bash
npm install
npm run dev
```

เปิด `http://localhost:5173` — ใช้ PIN `111111` เข้า admin

### Mode 2: Production (Firebase)

```bash
# 1. ตั้ง Firebase (ดู FIREBASE_SETUP.md)
cp .env.example .env.local
# ใส่ Firebase config + ตั้ง VITE_USE_FIREBASE=true

# 2. ติดตั้ง + รัน
npm install
npm run dev

# 3. Seed data ครั้งแรก (browser console)
import('/src/firebase/seed.js').then(m => m.runSeed())
```

---

## 📂 โครงสร้างโปรเจกต์

```
muktha/
├── src/
│   ├── App.jsx                    ← Main app (data-mode aware)
│   ├── constants.js               ← C palette, BUSINESS_RULES
│   ├── seedData.js                ← Initial demo data
│   │
│   ├── data/                      ← 🆕 Data abstraction
│   │   ├── useAppData.js          ← Auto-pick: in-memory or Firebase
│   │   ├── useInMemoryAppData.js  ← Demo mode
│   │   └── useFirebaseAppData.js  ← Production mode
│   │
│   ├── firebase/                  ← 🆕 Firebase integration
│   │   ├── config.js
│   │   ├── auth.js                ← Google + LINE + Email
│   │   ├── admin.js               ← Admin operations
│   │   ├── employees.js           ← CRUD
│   │   ├── leaves.js
│   │   ├── salaries.js
│   │   ├── advances.js
│   │   ├── roles.js
│   │   ├── payrollConfirms.js
│   │   ├── seed.js                ← Migration script
│   │   └── hooks/
│   │       ├── useAuth.js         ← w/ admin custom claim
│   │       └── useFirestore.js    ← Real-time hooks
│   │
│   ├── utils/
│   │   ├── dateUtils.js
│   │   ├── format.js
│   │   ├── leaveUtils.js
│   │   ├── salaryUtils.js
│   │   ├── validators.js          ← 🆕 Input validation
│   │   └── imageUtils.js          ← 🆕 Resize/compress
│   │
│   ├── components/
│   │   ├── shared/                (Avatar, Diamond, ErrorBoundary, ...)
│   │   ├── modals/
│   │   ├── home/
│   │   ├── admin/
│   │   └── salary/
│   │
│   └── print/                     (printSalarySlip, printSalaryCertificate)
│
├── backend/                       ← 🆕 Express + LINE Login + Firebase Admin
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── functions/                     ← 🆕 Firebase Cloud Functions
│   ├── index.js
│   └── package.json
│
├── firebase.json                  ← 🆕 Firebase project config
├── firestore.rules                ← 🆕 Security rules
├── firestore.indexes.json         ← 🆕 Indexes
├── .env.example                   ← 🆕 Frontend env template
│
├── README.md
├── FIREBASE_SETUP.md              ← 🔥 Firebase setup guide
└── MIGRATION_GUIDE.md             ← 🔄 Migration guide
```

---

## 🎯 Features

### Core
- 📅 ระบบลา — ลากิจ/ลาป่วย พร้อมโควต้า
- 💰 เงินเดือน — คำนวณตามชิ้น × rate + Pool
- 🤝 Pool ค่าคอม — สูตร Excel (Base/30 × N-1)
- 💸 เบิกล่วงหน้า — สูงสุด 50% ของฐาน
- 🖨 พิมพ์เอกสาร — สลิป + หนังสือรับรอง
- 💬 LINE Bot — แจ้งเตือน + Flex Message

### 🆕 Production Features
- 🔥 **Firestore real-time** — sync ข้อมูลข้ามเครื่องทันที
- 🔐 **Multi-auth** — Google / LINE / Email
- 👑 **Custom Claims** — Admin role ผ่าน Firebase
- ☁️ **Cloud Functions** — auto-tasks
- 🖼 **Image processing** — resize ก่อน upload (Firestore 1MB limit safe)
- ✅ **Validation** — bank account, LINE ID, numbers
- 🛡 **ErrorBoundary** — fail gracefully
- 🎯 **useMemo** — perf optimization

---

## 🔐 Authentication Flow

### Google Sign-in
```jsx
import { signInWithGoogle } from "./firebase/auth";
await signInWithGoogle();
```

### LINE Login (ต้องมี backend)
```jsx
import { startLineLogin, completeLineLogin } from "./firebase/auth";

// Login page
<button onClick={() => startLineLogin({
  channelId: import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID,
  redirectUri: window.location.origin + "/auth/callback",
})}>เข้าสู่ระบบด้วย LINE</button>

// Callback page (/auth/callback)
useEffect(() => {
  completeLineLogin(import.meta.env.VITE_BACKEND_URL).catch(alert);
}, []);
```

### PIN (เดิม) — ใน demo mode
ใส่ PIN `111111` → เข้า Admin

---

## 🛠 Admin Promotion (Firebase mode)

### ผ่าน UI
Admin Panel → Manage Users → Set Admin

### ผ่าน backend API
```bash
curl -X POST http://localhost:3000/api/set-admin \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"uid": "USER_UID", "isAdmin": true}'
```

### ผ่าน Firebase Functions shell
```bash
firebase functions:shell
> require("firebase-admin").auth().setCustomUserClaims("USER_UID", { admin: true })
```

---

## 📚 Documentation

| ไฟล์ | คำอธิบาย |
|---|---|
| [README.md](./README.md) | **คู่มือหลัก** (ไฟล์นี้) |
| [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) | 🔥 ตั้งค่า Firebase ตั้งแต่ศูนย์ |
| [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) | 🔄 Migration details |
| [firestore.rules](./firestore.rules) | 🛡 Security rules |
| [backend/.env.example](./backend/.env.example) | 💬 Backend env |
| [functions/index.js](./functions/index.js) | ☁️ Cloud Functions |

---

## ⚙️ Environment Variables

### Frontend (`.env.local`)
```env
VITE_USE_FIREBASE=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_LINE_LOGIN_CHANNEL_ID=...
VITE_BACKEND_URL=https://your-backend.railway.app
```

### Backend (`backend/.env`)
```env
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
ADMIN_LINE_USER_ID=U...

LINE_LOGIN_CHANNEL_ID=...
LINE_LOGIN_CHANNEL_SECRET=...

FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json

PUBLIC_BASE_URL=https://your-backend.railway.app
PORT=3000
NODE_ENV=production
```

---

## 🚢 Deployment

### Frontend
| Platform | Command |
|---|---|
| **Vercel** | `vercel deploy` |
| **Netlify** | drag-drop หรือ Git |
| **Firebase Hosting** | `firebase deploy --only hosting` |
| **Cloudflare Pages** | Git integration |

### Backend
| Platform | Notes |
|---|---|
| **Railway** | ⭐ ดีที่สุด — รองรับ static files + .env |
| **Render** | Free 750hr/เดือน |
| **Fly.io** | Performance ดี + เอเชีย |

### Cloud Functions
```bash
firebase deploy --only functions
```

---

## 🧪 Testing

```bash
npm run dev                              # Frontend
cd backend && npm install && npm run dev # Backend
firebase emulators:start                 # Firebase Emulators
```

---

## 📈 Limits (Firebase Free Tier)

| Resource | Limit |
|---|---|
| Firestore reads | 50,000/day |
| Firestore writes | 20,000/day |
| Firestore storage | 1 GB |
| Auth users | unlimited |
| Cloud Functions | 2M invocations/month |
| Document size | 1 MB max (รวม base64 image) |

> 💡 สำหรับร้านเล็ก (พนักงาน < 50 คน) free tier เพียงพอ

---

## 🎯 Roadmap

- [x] ✅ Refactor monolith → 30+ modular files
- [x] ✅ Magic numbers → `BUSINESS_RULES`
- [x] ✅ ErrorBoundary
- [x] ✅ useMemo optimization
- [x] ✅ Input validation
- [x] ✅ Firebase integration layer
- [x] ✅ Image resize utility
- [x] ✅ LINE Login backend
- [x] ✅ Admin Custom Claims
- [x] ✅ Cloud Functions
- [ ] ⏳ TypeScript migration
- [ ] ⏳ Unit tests (Vitest)
- [ ] ⏳ E2E tests (Playwright)
- [ ] ⏳ PWA support (offline mode)
- [ ] ⏳ i18n
