# UI Components

## Layout

- Mobile: max 430px, bottom nav, mobile header
- Desktop: sidebar 260px + content area (>= 768px)
- Color theme: Maroon (#7B1C1C) + Gold (#C9973A) + Cream (#FDF8F0)
- Font: Prompt (Thai)

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
| `print/printSalarySlip.ts` | Salary slip (HTML print + PDF) |
| `print/printSalaryCertificate.ts` | Salary certificate (HTML print + PDF) |
| `print/pdfBuilders/salarySlipPDF.ts` | pdfmake document definition for slip |
| `print/pdfBuilders/salaryCertificatePDF.ts` | pdfmake document definition for certificate |
