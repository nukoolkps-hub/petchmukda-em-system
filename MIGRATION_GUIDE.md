# 🔄 Migration Guide — เชื่อม App.jsx กับ Firebase

หลังตั้งค่า Firebase แล้ว ขั้นตอนเชื่อม `App.jsx` กับ Firestore

---

## ⚠️ ก่อนเริ่ม

อ่าน `FIREBASE_SETUP.md` ให้เสร็จก่อน — โดยเฉพาะข้อ 1-6
- ✅ Firebase project พร้อม
- ✅ Firestore database สร้างแล้ว
- ✅ `.env.local` ใส่ค่าครบ
- ✅ Security rules publish
- ✅ Seed data รันแล้ว

---

## 📝 จุดที่ต้องแก้ใน `App.jsx`

### Before (in-memory)

```jsx
import {
  ALL_LEAVES_INIT, EMP_DIR_INIT, SALARY_INIT,
  ROLES_INIT, ADVANCE_REQUESTS_INIT,
} from "./seedData";

export default function LeaveApp(){
  const [allLeaves, setAllLeaves] = useState(ALL_LEAVES_INIT);
  const [empDir, setEmpDir] = useState(EMP_DIR_INIT);
  const [salaryData, setSalaryData] = useState(SALARY_INIT);
  const [advanceRequests, setAdvanceRequests] = useState(ADVANCE_REQUESTS_INIT);
  const [roles, setRoles] = useState(ROLES_INIT);
  // ...
}
```

### After (Firebase)

```jsx
import {
  useEmployees, useLeaves, useSalaries,
  useAdvances, useRoles, usePayrollConfirms,
} from "./firebase/hooks/useFirestore";
import * as employeesAPI  from "./firebase/employees";
import * as leavesAPI     from "./firebase/leaves";
import * as salariesAPI   from "./firebase/salaries";
import * as advancesAPI   from "./firebase/advances";
import * as rolesAPI      from "./firebase/roles";
import * as payrollAPI    from "./firebase/payrollConfirms";

export default function LeaveApp(){
  // Real-time data from Firestore
  const { data: empDir,           loading: l1 } = useEmployees();
  const { data: allLeaves,        loading: l2 } = useLeaves();
  const { data: salaryData,       loading: l3 } = useSalaries();
  const { data: advanceRequests,  loading: l4 } = useAdvances();
  const { data: roles,            loading: l5 } = useRoles();
  const { data: payrollConfirms,  loading: l6 } = usePayrollConfirms();

  const loading = l1 || l2 || l3 || l4 || l5 || l6;

  // Show loading spinner ระหว่างโหลด
  if(loading) return <LoadingScreen/>;

  // ... rest of component
}
```

---

## 🔄 แทนที่ State Updates

### Add Leave (Before)
```jsx
function submitLeave(leave){
  setAllLeaves(prev => [...prev, { id: Date.now(), ...leave }]);
}
```

### Add Leave (After)
```jsx
async function submitLeave(leave){
  await leavesAPI.addLeave(leave);
  // ❌ ไม่ต้อง setAllLeaves เพราะ useLeaves() subscribe real-time
}
```

### Update Salary (Before)
```jsx
function updateSalary(empId, ym, fields){
  setSalaryData(prev => ({
    ...prev,
    [empId]: {
      ...(prev[empId]||{}),
      [ym]: { ...(prev[empId]?.[ym]||{}), ...fields },
    },
  }));
}
```

### Update Salary (After)
```jsx
async function updateSalary(empId, ym, fields){
  await salariesAPI.updateSalary(empId, ym, fields);
}
```

### Approve Advance (Before)
```jsx
function approveAdvance(id, slipImg){
  setAdvanceRequests(prev => prev.map(r =>
    r.id === id
      ? { ...r, status:"approved", approvedAt: new Date().toISOString(), slipImg }
      : r
  ));
}
```

### Approve Advance (After)
```jsx
async function approveAdvance(id, slipImg){
  await advancesAPI.approveAdvance(id, slipImg);
}
```

---

## 🧑‍💼 เพิ่ม Login Flow

### 1. สร้าง LoginScreen component

```jsx
// src/components/LoginScreen.jsx
import { useState } from "react";
import { signInWithGoogle } from "../firebase/auth";

export default function LoginScreen(){
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle(){
    setLoading(true); setError("");
    try {
      await signInWithGoogle();
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div /* ... */>
      <button onClick={handleGoogle} disabled={loading}>
        {loading ? "กำลังเข้า..." : "เข้าสู่ระบบด้วย Google"}
      </button>
      {error && <div>{error}</div>}
    </div>
  );
}
```

### 2. ใน App.jsx — Wrap ด้วย useAuth

```jsx
import useAuth from "./firebase/hooks/useAuth";
import LoginScreen from "./components/LoginScreen";

export default function LeaveApp(){
  const { user, employee, loading } = useAuth();

  if(loading) return <LoadingScreen/>;
  if(!user) return <LoginScreen/>;

  // employee = ข้อมูลจาก /employees collection ที่ผูกกับ user คนนี้
  // ใช้แทน profile state เดิม
  // ... rest
}
```

---

## 🖼️ Image Upload (base64)

```jsx
// แปลงรูปเป็น base64
function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ตัวอย่าง: อัพโหลดสลิปการโอน
async function handleSlipUpload(advanceId, file){
  // ⚠️ ตรวจขนาด — Firestore document max 1MB
  if(file.size > 800 * 1024){
    alert("ขนาดไฟล์ใหญ่เกินไป (เกิน 800KB) — กรุณา resize ก่อน");
    return;
  }

  const base64 = await fileToBase64(file);
  await advancesAPI.approveAdvance(advanceId, base64);
}
```

> 💡 **Tip:** สำหรับ avatar รูปเล็กพอแล้ว แต่สลิปการโอน อาจต้อง resize ก่อนเพื่อให้ไม่เกิน 800KB

---

## 🚦 Step-by-step Migration

แนะนำให้ทำ **ทีละ collection** เพื่อ debug ง่าย:

### Step 1: Roles (ง่ายสุด)
- เปลี่ยน `useState(ROLES_INIT)` → `useRoles()`
- เปลี่ยน `setRoles` → `await rolesAPI.upsertRole(...)`
- ทดสอบ: เพิ่ม/ลบตำแหน่งใน Admin → ตรวจ Firestore

### Step 2: Employees
- เปลี่ยน `useState(EMP_DIR_INIT)` → `useEmployees()`
- update onUpdateRole → `employeesAPI.updateEmployee()`

### Step 3: Leaves
- `useState(ALL_LEAVES_INIT)` → `useLeaves()`
- submitLeave → `leavesAPI.addLeave()`
- onDelete → `leavesAPI.deleteLeave()`

### Step 4: Salaries (ระวัง: object format)
- `useState(SALARY_INIT)` → `useSalaries()`
- setSalaryData(...) → `salariesAPI.updateSalary()`
- ⚠️ Note: useSalaries() คืน object `{empId: {ym: data}}` เหมือน format เดิม

### Step 5: Advances
- `useState(ADVANCE_REQUESTS_INIT)` → `useAdvances()`
- submitAdvanceRequest → `advancesAPI.submitAdvance()`
- approve/reject → `advancesAPI.approveAdvance/rejectAdvance()`

### Step 6: PayrollConfirms
- ใช้ `usePayrollConfirms()` + `payrollAPI.setPayrollConfirm()`

### Step 7: เพิ่ม Login flow

---

## 🐛 Common Issues

### "Cannot read property 'forEach' of undefined"
→ ลืม guard ตอน loading: `if(loading) return null;`

### Real-time updates ไม่มา
→ ตรวจ Security Rules ว่า user มีสิทธิ์อ่าน collection นี้

### "FirebaseError: Missing or insufficient permissions"
→ ดู Firebase Console > Firestore > Rules → ตรวจ rules

### Performance ช้าหลัง refactor
→ Wrap การคำนวณใน `useMemo` (อยู่แล้วในไฟล์ที่ refactor ไป)
→ ใช้ one-time `getAll*` แทน `subscribe*` สำหรับ data ที่ไม่ต้อง real-time

---

## 🎯 Final Architecture

```
┌──────────────────────────────────────────────┐
│              User (Browser)                  │
└──────────────────┬───────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐      ┌────────────────┐
│  Google Auth │      │  LINE Login    │
└──────┬───────┘      │  (via backend) │
       │              └────────┬───────┘
       │                       │
       └───────────┬───────────┘
                   ▼
       ┌─────────────────────┐
       │   Firebase Auth     │
       │  (current user)     │
       └──────────┬──────────┘
                  │
                  ▼
       ┌─────────────────────────────┐
       │      Firestore DB           │
       │  ─────────────────────────  │
       │  • employees/               │
       │  • leaves/                  │
       │  • salaries/{id}/months/    │
       │  • advances/                │
       │  • roles/                   │
       │  • payrollConfirms/         │
       └──────────┬──────────────────┘
                  │ real-time
                  ▼
       ┌─────────────────────┐
       │   React Hooks       │
       │  useEmployees()     │
       │  useLeaves()        │
       │  useSalaries()      │
       │  useAdvances()      │
       │  ...                │
       └──────────┬──────────┘
                  ▼
            ┌──────────┐
            │  App UI  │
            └──────────┘
```
