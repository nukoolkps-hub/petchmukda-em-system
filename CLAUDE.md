# CLAUDE.md

> คู่มือสั้นสำหรับ Claude — เปิดอ่านครบใน 30 วินาที
> รายละเอียดเชิงลึกอยู่ใน `README.md`, `FIREBASE_SETUP.md`, `MIGRATION_GUIDE.md`

---

## 🛠 Tech Stack

React 18 + Vite · Firebase (Firestore + Auth) · Express backend · LINE Bot

---

## 📜 Project Rules

- ห้ามแก้ database schema ถ้าไม่ได้สั่ง
- ใช้ **inline styles** ตามเดิม (ไม่ใช้ Tailwind)
- ก่อนแก้โค้ด → สรุปไฟล์ที่จะเปลี่ยนก่อน
- แก้เฉพาะ scope ที่ผู้ใช้สั่ง
- หลังแก้ → สรุปเฉพาะไฟล์ที่แก้และเหตุผล

## 🔄 Workflow

```
1. Explore   → grep/tail/sed (silent)
2. Plan      → แสดงแผน → รอคำสั่ง "ทำตามแผนนี้"
3. Implement → แก้เฉพาะไฟล์ในแผน
4. Commit    → verify เฉพาะที่แตะ + zip
```

**Exception:** งาน obvious (เปลี่ยนค่า config, fix typo) → ทำเลย ไม่ต้อง plan

## 🎯 5 หลักการสำคัญ

1. **Scope เล็ก** — งานละ 1-3 ไฟล์
2. **อ่านน้อย** — grep ก่อน view, view ระบุ range
3. **Clear บ่อย** — จบงานแนะนำ user ให้ clear
4. **Compact** — ตอบสั้น ไม่ verbose
5. **CLAUDE.md** — กฎทั้งหมดในไฟล์นี้

---

## 🐛 Just-in-Time Debugging

- Error ยาว → user ส่งเฉพาะส่วนสำคัญ 20-40 บรรทัด
- รัน command ด้วย `tail -n 80`, `head -n 50`, `grep`, `wc -l` ก่อน

```bash
# ❌ ห้าม
npm test
cat src/App.jsx

# ✅ ใช้แทน
npm test 2>&1 | tail -n 80
grep -n "submitLeave" src/App.jsx
sed -n '120,140p' src/App.jsx
wc -l src/App.jsx
```

---

## 🎨 Style Conventions

**Palette** — อ่านจาก `src/constants.js`:
```js
C.maroon  #7B1C1C   C.gold     #C9973A   C.cream   #FDF8F0
C.text    #2D1A0E   C.textMid  #7A5C3A   C.border  #E8D5B0
```

**Inline styles** ทั้งหมด — ตัวอย่าง:
```jsx
<button style={{padding:"10px 16px",borderRadius:10,
  background:C.maroon,color:C.white,fontWeight:700}}>
```

**Font** — Prompt (Google Fonts) โหลดผ่าน `FONT_LINK` ใน `App.jsx`

**Numbers** — ใช้ `TH_NUMBER(n)` จาก `utils/format.js`

**Business Rules** — ใช้ค่าจาก `constants.js → BUSINESS_RULES`:
- `DAYS_PER_MONTH: 30`
- `WEEKDAY_LEAVE_QUOTA: 2`
- `SUNDAY_LEAVE_MULTIPLIER: 1.5`
- `POOL_THRESHOLD: 0.80`
- `BASE_SALARY_THRESHOLD: 0.50`
- `ADVANCE_LIMIT_PERCENT: 0.50`

---

## 📁 File Structure

```
src/
├── App.jsx                  ← Main, ใช้ useAppData()
├── constants.js             ← C palette + BUSINESS_RULES
├── seedData.js              ← *_INIT
│
├── data/                    ← Data abstraction (in-memory ↔ Firebase)
├── firebase/                ← Firestore CRUD + auth + hooks
├── utils/                   ← date, format, leave, salary, validators, pdfFonts
│
├── components/
│   ├── shared/              ← Avatar, Diamond, GoldDivider, ErrorBoundary, ...
│   ├── modals/              ← ProfileSetup, PIN, Confirm, Advance, Manual
│   ├── home/                ← TeamCalendar, LeaveTypeCard
│   ├── admin/               ← AdminPanel, Payroll, Roles, Advance
│   └── salary/              ← SalaryView, SalaryAdminEdit
│
└── print/
    ├── printSalarySlip.js              ← window.print + PDF download
    ├── printSalaryCertificate.js
    └── pdfBuilders/                    ← pdfmake doc definitions
```

**Modes ของ App:**
- `VITE_USE_FIREBASE=false` → in-memory (demo)
- `VITE_USE_FIREBASE=true`  → Firestore real-time

---

## 📦 Output Conventions

**Zip filename:** `em-system-YYYY-MM-DD-HHMM.zip`

**Verify หลังแก้:**
```bash
node --check <file.js>          # syntax
grep -c "<symbol>" <files>      # ใช้ครบไหม
# import path check (ระบุเฉพาะไฟล์ที่แก้)
```

---

## ⚠️ Things NOT to Do

- ❌ อย่าแก้ไฟล์นอก plan (แม้เห็นว่าควรปรับ)
- ❌ อย่ารัน test/syntax check ทุกไฟล์
- ❌ อย่าใช้ Tailwind class — โปรเจกต์นี้ใช้ inline styles
- ❌ อย่าเปลี่ยน Firestore collection names / schema
- ❌ อย่า view ไฟล์เต็มถ้าไม่จำเป็น
- ❌ อย่าใส่ verbose summary ที่ยาวเกินงานจริง
