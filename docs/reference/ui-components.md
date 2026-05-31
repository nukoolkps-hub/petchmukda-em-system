# UI Components

## Layout

- Mobile: max 430px, bottom nav, mobile header
- Desktop: sidebar 260px + content area (>= 768px)
- Color theme: Maroon (#7B1C1C) + Gold (#C9973A) + Cream (#FDF8F0)
- Font (web): Prompt (Thai) — โหลดจาก Google Fonts (อยู่ใน `font-src` ของ CSP)
- Font (PDF): Sarabun — self-host ที่ `public/fonts/Sarabun-{Regular,Bold}.ttf`

## Icons

ใช้ **`lucide-react`** อันเดียวทั้งระบบ — import แบบ `{ Name as IconName }`:

```tsx
import { CalendarDays as IconCalendar, Check as IconCheck } from "lucide-react";

<IconCalendar size={16} strokeWidth={2.4} />
```

หมายเหตุ Lucide ↔ Tabler:
- `strokeWidth={N}` (Lucide) ≠ `stroke={N}` (Tabler) — Lucide ใช้ `stroke` สำหรับ **สี**
- ใน SVG element จริงๆ (`<circle>`, `<path>`) `stroke="..."` ยังเป็นสีตามมาตรฐาน

ห้ามใช้ emoji ปฏิทิน (`📅`/`📆`/`🗓️`) — iOS render เลข "17" ติดกลาง glyph ทำให้สับสน → ใช้ `<CalendarDays />` แทน

## Component Tree

```
Layout
├── Sidebar (desktop)
│   ├── Brand + Diamond icon
│   ├── Profile card
│   ├── Nav items
│   └── Logout button
├── MobileHeader + BottomNav (mobile)
│   ├── Diamond + brand name
│   ├── Profile avatar
│   └── Tab navigation
└── Routes
    ├── HomeTab
    │   ├── LeaveTypeCard (quota display)
    │   └── TeamCalendar (monthly view)
    ├── RequestTab
    │   ├── Leave type selection
    │   ├── CalendarPicker (start/end)
    │   └── Leave history list
    ├── SalaryView
    │   ├── Earnings breakdown
    │   ├── Deductions breakdown
    │   ├── Pool share info
    │   └── PDF print/download
    └── AdminPanel
        ├── Monthly/yearly leave summary
        ├── Leave list + delete
        ├── SalaryAdminEdit (per employee)
        ├── AdminAdvancePanel (approve/reject)
        ├── PayrollSummaryPanel (confirm payroll)
        └── RolesAdminPanel (CRUD roles)
```

## Shared Components

| Component | File | Description |
|---|---|---|
| AvatarCircle | `shared/AvatarCircle.tsx` | Avatar renderer (text/emoji/image) |
| BaseModal | `shared/BaseModal.tsx` | Modal dialog with backdrop blur |
| CalendarPicker | `shared/CalendarPicker.tsx` | Date picker with Thai month names |
| Diamond | `shared/Diamond.tsx` | Diamond SVG icon (brand element) |
| ErrorBoundary | `shared/ErrorBoundary.tsx` | React error boundary with fallback UI |
| GoldDivider | `shared/GoldDivider.tsx` | Decorative divider with diamond center |
| MosaicPattern | `shared/MosaicPattern.tsx` | SVG mosaic decoration (sidebar/header) |
| Layout | `shared/Layout.tsx` | Section/Card/Box utility components |

## Modals

| Modal | Description |
|---|---|
| ProfileSetupModal | แก้ไข avatar + bank info |
| AdvanceRequestModal | ฟอร์มเบิกเงินล่วงหน้า |
| AdvanceHistoryModal | ประวัติเบิกเงิน |
| ConfirmModal | ยืนยันลบรายการลา |
| ManualModal | คู่มือใช้งาน (กฎลา + กฎ commission) |

## Custom Hooks

| Hook | File | Description |
|---|---|---|
| useLeaveForm | `hooks/useLeaveForm.ts` | Leave request form state + validation |
| useProfile | `hooks/useProfile.ts` | Profile state from auth + employee data |
| useLineNotifications | `hooks/useLineNotifications.ts` | LINE notification for advances |
| useAuth | `firebase/hooks/useAuth.ts` | Firebase auth state listener |
| useFirestore | `firebase/hooks/useFirestore.ts` | Firestore real-time subscription hooks |

## Print / PDF

| File | Description |
|---|---|
| `print/printSalarySlip.ts` | สลิป — HTML print (popup) + `generateSalarySlipBlob()` สำหรับ freeze |
| `print/printSalaryCertificate.ts` | ใบรับรองเงินเดือน — HTML print + PDF blob |
| `print/pdfBuilders/salarySlipPDF.ts` | pdfmake docDef ของสลิป (ใช้ตอน freeze ขึ้น Storage) |
| `print/pdfBuilders/salaryCertificatePDF.ts` | pdfmake docDef ของใบรับรอง |
| `utils/pdfFonts.ts` | Lazy-load Sarabun TTF จาก `/fonts/` → register ผ่าน `pdfMake.addVirtualFileSystem()` + `setFonts()` (pdfmake 0.3.x API) |

### Important: pdfmake 0.3.x API

```ts
pdfMake.addVirtualFileSystem({ "Sarabun-Regular.ttf": base64, ... });
pdfMake.setFonts({ Sarabun: { normal: "Sarabun-Regular.ttf", ... } });
```

อย่าใช้ `pdfMake.vfs = {}` แบบ 0.1.x — ไม่มีผล ( internal property จริงคือ `virtualfs`)

### Why self-host font

CSP มี `connect-src 'self' ...` (ไม่อนุญาต CDN ภายนอก) — ถ้าโหลด TTF จาก `cdn.jsdelivr.net` จะโดน block `"Refused to connect"`. Self-host ที่ `public/fonts/` เป็น same-origin → CSP ผ่าน, ไม่พึ่ง CDN

### Slip Freeze Flow (ตอน admin "ยืนยันยอด")

1. `backfillPoolSnapshots()` — write snapshot ลง salary doc ของทุกคน (ไม่ขึ้นกับการสร้าง PDF)
2. `freezeAllSlips()` — per employee: สร้าง PDF blob → upload `salarySlips/{empId}/{YYYY-MM}.pdf` → save `{slipUrl, slipFrozenAt}` ลง salary doc
3. ถ้า PDF/Storage fail → ขึ้น toast บอก error จริง แต่ snapshot จากขั้น 1 ถูกเขียนแล้ว
