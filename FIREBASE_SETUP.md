# 🔥 Firebase Setup Guide — ระบบพนักงานห้างเพชรทองมุกดา

คู่มือการตั้งค่า Firebase สำหรับโปรเจกต์นี้ ตั้งแต่ศูนย์

---

## 📋 Checklist

- [ ] สร้าง Firebase Project
- [ ] เปิดใช้ Firestore Database
- [ ] เปิดใช้ Authentication (Google + Email/Password)
- [ ] คัดลอก Config → `.env.local`
- [ ] วาง Security Rules
- [ ] รัน Migration Script
- [ ] เชื่อม `App.jsx` กับ Firebase hooks

---

## 1️⃣ สร้าง Firebase Project

1. ไปที่ https://console.firebase.google.com
2. คลิก **"Add project"** → ตั้งชื่อ (เช่น `muktha-employee-system`)
3. ปิด Google Analytics (ถ้าไม่ต้องใช้)
4. รอจนสร้างเสร็จ

## 2️⃣ เปิดใช้ Firestore

1. ใน Firebase Console → **Build > Firestore Database**
2. คลิก **"Create database"**
3. ตั้ง **Database ID** เป็น **`petchmukda-bot`**
4. เลือก **"Start in production mode"**
5. เลือก location: **`asia-southeast1`** (สิงคโปร์ — เร็วที่สุดสำหรับไทย)

## 3️⃣ เปิดใช้ Authentication

1. **Build > Authentication > Get started**
2. **Sign-in method tab:**
   - **Google** → Enable → ใส่ project support email → Save
   - **Email/Password** → Enable → Save (สำหรับ admin)
3. (Optional) เพิ่ม **Authorized domains** ถ้า deploy ที่อื่น

## 4️⃣ ดึง Firebase Config

1. **Project Settings (⚙️) > General > Your apps**
2. คลิก **"</>"** เพื่อสร้าง Web app
3. ตั้งชื่อ (เช่น `muktha-web`)
4. คัดลอก `firebaseConfig` object
5. สร้างไฟล์ `.env.local` ในโปรเจกต์ root:

```bash
cp .env.example .env.local
```

แล้วใส่ค่าจริง:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=muktha-xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=muktha-xxx
VITE_FIREBASE_STORAGE_BUCKET=muktha-xxx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc...
VITE_FIRESTORE_DATABASE_ID=petchmukda-bot
```

## 5️⃣ ติดตั้ง Security Rules

1. Firebase Console → **Firestore > Rules tab**
2. คัดลอกเนื้อหาจากไฟล์ `firestore.rules` มาวาง
3. คลิก **"Publish"**

## 6️⃣ รัน Migration Script (Seed Data)

> ⚠️ **ทำครั้งเดียวเท่านั้น** — ถ้ารันซ้ำจะ overwrite ข้อมูลเดิม

**วิธีที่ 1: ใน Browser Console**

หลัง app load แล้ว:
```js
// เปิด DevTools console (F12)
import('/src/firebase/seed.js').then(m => m.runSeed());
```

**วิธีที่ 2: เพิ่มปุ่มชั่วคราวใน Admin Panel**

```jsx
import { runSeed } from "./firebase/seed";

<button onClick={async () => {
  if(confirm("Seed data ลง Firestore?")) {
    await runSeed();
    alert("✅ Seeded!");
  }
}}>🌱 Seed</button>
```

## 7️⃣ เชื่อม App.jsx กับ Firebase

ดูตัวอย่างที่ `MIGRATION_GUIDE.md`

---

## 🗂 Schema (Firestore Collections)

```
employees/{employeeId}
├─ name, role, roleId, avatar, avatarType, avatarImageUrl
├─ bank, bankAccountNumber, lineUserId
├─ baseSalary, singlePieceRate*
└─ poolExclusion, salaryDisabled

leaves/{leaveId}                    ← auto ID
├─ employeeId, employeeName, type, start, end
└─ days, reason, submitted

salaries/{employeeId}/months/{yearMonth}        ← nested
├─ baseSalary, singleRatePieces, normalSalePieces, lateDeduction
└─ socialSecurity, note

advances/{advanceId}                ← auto ID
├─ employeeId, employeeName, amount, reason
├─ month, status: pending|approved|rejected
└─ submittedAt, approvedAt, slipImageDataUrl (base64)

roles/{roleId}
├─ name, poolGroup, icon

payrollConfirms/{ym_empId}          ← e.g. "2026-04_e1"
└─ confirmed: boolean
```

---

## 🔐 Authentication Flow

### Google Sign-in (พร้อมใช้)
```jsx
import { signInWithGoogle } from "./firebase/auth";

<button onClick={async () => {
  try {
    await signInWithGoogle();
  } catch(err) {
    alert(err.message);
  }
}}>เข้าสู่ระบบด้วย Google</button>
```

### LINE Login (ต้องมี backend)

**Frontend:**
```jsx
import { signInWithLineToken } from "./firebase/auth";

// 1. Redirect to LINE Login
window.location.href = `https://access.line.me/oauth2/v2.1/authorize?...`;

// 2. ในหน้า callback — ส่ง code ไป backend
const res = await fetch("/api/line-auth", {
  method: "POST",
  body: JSON.stringify({ code }),
});
const { customToken } = await res.json();

// 3. Sign in ด้วย custom token
await signInWithLineToken(customToken);
```

**Backend** (เพิ่มใน `backend-server.js`):
```js
// ต้องติดตั้ง: firebase-admin
import { getAuth } from "firebase-admin/auth";

app.post("/api/line-auth", async (request, res) => {
  const { code } = request.body;

  // 1. Verify LINE code → ได้ access token
  const lineToken = await verifyLineCode(code);

  // 2. ดึง LINE profile
  const profile = await getLineProfile(lineToken);

  // 3. สร้าง Firebase Custom Token
  const customToken = await getAuth().createCustomToken(profile.userId);
  res.json({ customToken });
});
```

---

## 🚦 Phase Migration Plan

| Phase | งาน | สถานะ |
|---|---|---|
| 1 | Firebase config + adapter layer | ✅ พร้อม |
| 2 | React hooks (`useEmployees`, ฯลฯ) | ✅ พร้อม |
| 3 | Migration script (seed) | ✅ พร้อม |
| 4 | Security rules | ✅ พร้อม |
| 5 | เชื่อม `App.jsx` ใช้ hooks แทน in-memory | ⏳ TODO |
| 6 | LINE Login backend integration | ⏳ TODO |
| 7 | Image upload (avatar/slip) เป็น base64 | ⏳ TODO |

---

## 💡 Tips

- **ใช้ Firestore Emulator** ในการทดสอบเพื่อไม่กิน quota:
  ```bash
  npm install -g firebase-tools
  firebase init emulators
  firebase emulators:start
  ```
- **ตรวจ quota:** Firebase Console → Usage tab
- **Free tier limits:** 50K reads, 20K writes, 1GB storage/day
- **Backup:** ตั้ง scheduled export → Cloud Storage
- **Real-time แค่ที่จำเป็น** — `getDocs()` (one-time) ถ้าไม่ต้องการ real-time

---

## ❓ Troubleshooting

### "Missing or insufficient permissions"
→ ตรวจ Security Rules ว่า publish แล้วยัง

### "Failed to get document because the client is offline"
→ ปกติเมื่อ refresh ตอน initial load — Firebase จะ retry ให้

### "Quota exceeded"
→ ลด `subscribe*` ที่ไม่จำเป็น → ใช้ one-time `get*` แทน

### LINE Login "auth/invalid-custom-token"
→ Custom token ที่ backend สร้างต้องมี `audience` ตรง project
