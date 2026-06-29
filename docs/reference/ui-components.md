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
    │   ├── PositionRateCard (เงินเดือนพื้นฐาน + อัตราค่าคอม · LIVE badge)
    │   ├── DutyTodayCard (หน้าที่วันนี้)
    │   ├── Quota card (โควต้า weekday · countWeekdayLeaves)
    │   ├── Leave type mini stats (chip "ลากิจ/ลาป่วย เดือนนี้" — นับ "วัน" ที่ร้านเปิด แยกตามประเภท · ตัดวันร้านปิด · ไม่เกี่ยวกับเงิน)
    │   └── TeamCalendar (monthly view — ใบลาทุกคน)
    ├── RequestTab
    │   ├── Leave type selection
    │   ├── CalendarPicker (start/end)
    │   └── Leave history (เลื่อนรายเดือน ‹/› · default เดือนปัจจุบัน · badge "อาทิตย์ ×1.5" บนใบลาที่คร่อมอาทิตย์เปิด)
    ├── SalaryView
    │   ├── MonthChevronNav (เลื่อน ‹/› + แตะ label เปิด picker เลือกเดือน/ปี)
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
| PositionRateCard | `home/PositionRateCard.tsx` | การ์ดตำแหน่ง + เงินเดือนพื้นฐาน + อัตราค่าคอม (ปัจจุบัน · LIVE) — หน้าแรก |
| BaseModal | `shared/BaseModal.tsx` | Modal dialog with backdrop blur |
| **calendarTheme** | `shared/calendarTheme.ts` | **Single source ของ "theme ปฏิทินทั้งระบบ"** — token ที่ใช้ร่วมกันโดย CalendarPicker · TeamCalendar · MonthChevronNav · ThaiMonthPicker (ดู "Calendar theme" ด้านล่าง) |
| CalendarPicker | `shared/CalendarPicker.tsx` | Date picker (Thai month) — ใช้ token จาก `calendarTheme` |
| MonthChevronNav | `shared/MonthChevronNav.tsx` | ตัวเลือกเดือน ‹/› + popover · `months` = list เดือนที่เลือกได้ (caller ส่ง **เฉพาะเดือนที่มีข้อมูล**) |
| ThaiMonthPicker | `shared/ThaiMonthPicker.tsx` | Dropdown เลือกเดือน (พ.ศ.) · ใช้ตั้ง anchor (range ‑monthsBack..+monthsAhead · ไม่ filter ข้อมูล) |
| Diamond | `shared/Diamond.tsx` | Diamond SVG icon (brand element) |
| ErrorBoundary | `shared/ErrorBoundary.tsx` | React error boundary with fallback UI |
| GoldDivider | `shared/GoldDivider.tsx` | Decorative divider with diamond center |
| MosaicPattern | `shared/MosaicPattern.tsx` | SVG mosaic decoration (sidebar/header) |
| Layout | `shared/Layout.tsx` | Section/Card/Box utility components |
| MoneyInput | `shared/MoneyInput.tsx` | ช่องกรอกเงิน — ใส่ comma ทันทีตอนพิมพ์ (1,234,567) + คง cursor + รองรับ decimal/ติดลบ · drop-in แทน `<input inputMode="decimal">` · emit raw string (ไม่มี comma) · helper `formatTypedNumber`/`caretPosFromDigits` ใน `utils/format.ts` (shared กับ Calculator) · **คืน caret เฉพาะตอน field ถูก focus จริง** (`el === document.activeElement`) — กัน cursor เด้งผิดที่เมื่อ re-render จากเหตุอื่น (Calculator guard เดียวกัน) · **ใช้กับช่องจำนวนเงินทั้งระบบ:** EmployeeEditModal · AnnualRaiseSection · SalaryAdminEdit · AdvanceRequestModal · EmployeeLoansPanel · SalaryView (cert) · DutyEditModal · ช่องนับชิ้น/config คงเป็น raw integer (ไม่ใช้ comma) |
| ThemedSelect | `shared/ThemedSelect.tsx` | **dropdown ที่ใช้แทน native `<select>` ทุกที่** — popover ใช้ฟอนต์ Prompt + theme (selected = gold-pale/maroon) แทน OS-native list · API: `value`/`onChange(value)`/`options:{value,label,disabled?}[]`/`placeholder`/`disabled`/`className`/`maxHeightPx` · flip-up + scroll อัตโนมัติเมื่อ space ไม่พอ |
| BankPicker | `shared/BankPicker.tsx` | dropdown เลือกธนาคาร (โลโก้ + ชื่อ) — custom (native `<option>` รับแต่ text) |

> **กฎ: ห้ามใช้ native `<select>` ใน UI** — popover ของ native ใช้ system font + ไม่เข้า theme (เห็นชัดบน mobile) · ใช้ `ThemedSelect` เสมอ (ตัวเลือกเดือนใช้ `MonthChevronNav`/`ThaiMonthPicker` · ธนาคารใช้ `BankPicker`)

### Calendar theme (ปฏิทินทั้งระบบ — `shared/calendarTheme.ts`)

ทุก "ปฏิทิน + ตัวเลือกเดือน" ใช้ **token ชุดเดียวกัน** จาก `calendarTheme.ts` (maroon + gold brand) —
แก้สี/สไตล์ปฏิทินที่ไฟล์นี้ที่เดียว สะท้อนทุกที่ · ครอบ: `CalendarPicker` · `TeamCalendar` ·
`MonthChevronNav` · `ThaiMonthPicker`

| Token | ใช้กับ |
|---|---|
| `CAL_NAV_BTN` | ปุ่มลูกศรเลื่อนเดือน ‹ › (รวม `disabled`) |
| `CAL_TITLE` | หัวข้อเดือน/ปี (maroon) |
| `calWeekdayClass(isSaturday)` | weekday header · เสาร์หรี่สี (`text-txt-soft/50`) |
| `CAL_OPTION_SELECTED` / `CAL_OPTION_IDLE` | ปุ่มเดือนใน dropdown — **selected = maroon ทึบ + ตัวขาว** (contrast ดีสุด) |
| `CAL_TODAY_BG/BORDER/TEXT` | วันนี้ (เทาอ่อน) |
| `CAL_SELECTED_DAY_BG/BORDER/TEXT/SHADOW` | **วัน (day cell) ที่เลือก = ทอง soft** (goldPale bg + gold border + gold text) |

**กฎสี:** วันที่เลือกในปฏิทินกริด = ทอง soft · เดือนที่เลือกใน dropdown = maroon · วันนี้ = เทา
— เพิ่มปฏิทิน/ตัวเลือกวันที่ใหม่ ให้ดึง token จาก `calendarTheme` (อย่า hardcode สีซ้ำ)

**ตัวเลือกเดือน — โชว์เฉพาะเดือนที่มีข้อมูล:** caller ของ `MonthChevronNav` ส่ง `months` =
เดือนที่มีข้อมูลจริง (สลิป/ใบลา) ∪ เดือนที่กำลังดู เท่านั้น · **ไม่ยัดเดือนปัจจุบันที่ว่าง** →
ลูกศร/popover เลื่อนไปเจอหน้าว่างไม่ได้ · `SalaryView`/`PayrollSummaryPanel` อิง `salaryData` keys
(มีสลิป) · `LeaveListPanel`/`LeaveSummaryPanel` อิงเดือนที่มีใบลา · admin creation surfaces
(`SalaryAdminEdit`, `StoreCalendarPanel`, `ThaiMonthPicker` ใน DutyEditModal) ยังโชว์เดือน
ปัจจุบัน/อนาคตได้ (ต้องสร้างข้อมูลใหม่)

## Modals

| Modal | Description |
|---|---|
| ProfileSetupModal | แก้ไข avatar + bank info |
| AdvanceRequestModal | ฟอร์มเบิกเงินล่วงหน้า |
| AdvanceHistoryModal | ประวัติเบิกเงิน |
| ConfirmModal | ยืนยันลบรายการลา |
| ManualModal | คู่มือใช้งาน (กฎลา + กฎ commission) |
| PoolFlowModal | แผนผังเงินเดือน (📊) — flow การแบ่งค่าคอมกองกลาง · **per-item** (PR #512) · loop ทุก kind=pool item รวม custom |
| PoolAdjustmentModal | รายการยกเว้นค่าคอม · 2 variants (pool + piece) · **per-item routing** (PR #506) |

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
| `print/printSalarySlip.ts` | สลิป — HTML print (popup) + `generateSalarySlipBlob()` สำหรับ freeze · รองรับ `hiddenEarnIds`/`hiddenDedIds` filter (modal "บางส่วน") |
| `print/printSalaryCertificate.ts` | ใบรับรองเงินเดือน — HTML print + PDF blob · รองรับ `salaryOverride` (clamp ห้ามเกิน effective base) |
| `print/pdfBuilders/salarySlipPDF.ts` | pdfmake docDef ของสลิป (ใช้ตอน freeze ขึ้น Storage) · รองรับ hidden filter เหมือนกัน |
| `print/pdfBuilders/salaryCertificatePDF.ts` | pdfmake docDef ของใบรับรอง · รองรับ `salaryOverride` |
| `utils/slipRows.ts` | **Single source** ของรายการบนสลิป (id + label + sublabel + value) · ใช้ทั้ง print HTML/PDF + slip print modal · `buildSlipRowsCatalog()` + `applyHiddenFilter()` |
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

## Knowledge view (`/knowledge` · `KnowledgeView.tsx`)

หน้ารวมเนื้อหา reference + เครื่องคิดเลขที่อิงราคาทองวันนี้ · ใช้ทั้งฝั่ง admin (sidebar) และ employee (bottom nav · Icon: Brain 🧠)

### โครงสร้าง

```
KnowledgeView
├── header (Brain icon + "ความรู้ต่างๆ")
├── GoldPriceHeader (live · subscribe /config/goldPrice)
│   └── admin: ปุ่ม refresh (triggerFetchGoldPriceNow)
├── search box (filter section.title)
└── sections (accordion · session-remember openId)
    └── KnowledgeBlockView (dispatch by block.type)
```

### Block types (`src/content/knowledge/types.ts`)

| Block | Purpose | Live? |
|---|---|---|
| `h3` / `p` / `list` / `image` / `callout` / `steps` | static content | — |
| `table` | static table (`colWidths` + `colAlign` + optional `note`) | — |
| `formula` | สูตรกรอบทอง (`MathText` wrap operators) | — |
| `example` | ตัวอย่าง 3 ส่วน: title + given + steps | — |
| `live-example` | เหมือน example แต่ `compute(gold)` ตามราคาวันนี้ | ✓ |
| `calculator` | input form + live output · มี flag: `goldPriceDefault`, `buyPriceDefault`, `disabledWhen`, `options` (dropdown) | ✓ |
| `change-price-table` | ตารางค่าเปลี่ยน นน. เท่ากัน (ปัด 50) | ✓ |
| `sell-price-96-table` | ราคาขาย 96.5% เริ่มต้นวันนี้ + 2 บาท | ✓ |
| `buy-price-96-table` | ราคารับซื้อ 96.5% (3 column: หัก 5/6/7%) | ✓ |
| `secret` | dot mask + reveal/copy | — |

### Calculator field — special flags

```ts
interface CalcField {
  id: string;
  label: string;
  defaultValue?: number;       // fallback ก่อน live โหลด
  suffix?: string;             // "฿" / "ก." / "%"
  options?: { value, label }[];// → render เป็น <select>
  goldPriceDefault?: boolean;  // sync `gold.pricePerBaht` live (จนกว่า user แก้)
  buyPriceDefault?: boolean;   // sync `gold.buyPrice` live
  disabledWhen?: (values) => boolean; // disable conditional (เช่น %จริง ตอน "ทั่วไป")
}
```

### Typography ใน Knowledge

- **Default:** Prompt (ผ่าน CSS var · CLAUDE.md → Conventions)
- **MathText** — wrap +/−/×/÷/= ใน `font-mono 1.3em font-black text-maroon tracking-wider` · apply ใน `formula` + `example`/`live-example` step calc + `table` cells (กัน "MD-03" / range "0.05 ก. – 10 บ." โดน wrap ผิดด้วย regex `[+−×÷=]` no ASCII `-`)
- **Section title font** = text-sm bold (consistent)

### Live data flow

```
Cloud Function fetchGoldPriceScheduled (15 min)
  → /config/goldPrice (Firestore)
    → useGoldPrice() (frontend hook · onSnapshot)
      ├── GoldPriceHeader (รับซื้อ/ขาย)
      ├── ChangePriceTable / SellPrice96Table / BuyPrice96Table
      ├── Calculator (goldPriceDefault → input ค่าเริ่มต้น)
      └── LiveExample (compute(gold))
```

### Section examples (เนื้อหา 20+ sections ใน `src/content/knowledge/index.ts`)

มาตรฐานน้ำหนัก · ค่าแรง เริ่มต้น · ราคาขาย (99.99/96.5/นาก/เงิน) · การอ่านป้ายสินค้า · ค่าเปลี่ยน นน. เท่ากัน เริ่มต้น · ค่าเปลี่ยน เพิ่มขึ้น-ลดลง · ส่วนลด · รับซื้อ (96.5/90/นาก/เงิน) · ค่าบล็อก · จำนำ · แต้มสะสม · แยกชิ้น · ผ่อน CC · รูดบัตร · VAT · เครื่องตรวจ % · AEON
