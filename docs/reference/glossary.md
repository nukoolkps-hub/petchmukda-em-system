# Glossary — คำศัพท์ไทย (UI) ↔ code identifier

หลักของระบบ: **ภาษาไทยใน UI · อังกฤษใน code** (CLAUDE.md → Conventions) ·
ตารางนี้ช่วย map คำที่ผู้ใช้/แอดมินพูด → ชื่อใน code เวลาแก้/หาไฟล์

> กฎเหล็ก: **ห้ามเปลี่ยน identifier ในโค้ดเป็นไทย** (เช่น `poolGroup` ไม่เปลี่ยนเป็น
> `กองกลางGroup`) — เปลี่ยนเฉพาะข้อความ UI

## เงินเดือน / ค่าคอม / กองกลาง

| ไทย (UI) | code | ความหมายสั้น |
|---|---|---|
| กองกลาง | `pool` (`poolGroup`, `computePoolSharesForGroup`, `poolSnapshots`) | กองชิ้นค่าคอมที่คนตำแหน่งเดียวกันรวมแล้วแบ่งตามผลงาน − วันลา |
| รายการกองกลาง | `PoolItem` (`poolItems`, `kind: "pool"\|"personal"`) | รายการขายต่อตำแหน่ง · pool=เข้ากองกลาง · personal=ส่วนตัว |
| ปิดสิทธิ์กองกลาง | `poolExclusion` (`null\|"all"\|string[]`) | ตัดคนนี้ออกจากการแบ่งกองกลาง (บางรายการ/ทั้งหมด) |
| หักกองกลาง | `poolAdjustment` (`setPoolAdjustment`, `PoolAdjustmentModal`) | admin หักชิ้น/ยอด ออกจากกองกลางก่อนแบ่ง |
| ค่าคอมต่อชิ้น | `pieceRate` / `poolItemRates` / `singlePieceRate` | เรทค่าคอมต่อชิ้น |
| จำนวนชิ้น | `poolItemPieces` / `piecePieces` | นับชิ้นต่อ item ต่อเดือน (snapshot) |
| เงินเดือนพื้นฐาน | `baseSalary` · `getEffectiveBaseSalary` (รวมขึ้นเงินเดือน) | ฐานเงินเดือน · `dailyRate = baseSalary/30` |
| ขึ้นเงินเดือนประจำปี | `annualRaiseAmount` + `annualRaises[year]` | บวกอัตโนมัติทุก 1 ม.ค. ที่ครบปี + override ต่อปี |
| โบนัสแห่งความขยัน | `attendanceBonus` (`bonusDays`) | 0 ลา→2×dailyRate · 1→1× · ≥2→0 |
| รายการประจำเดือน | `recurringItems` (`type: "income"\|"deduction"`) | ค่าเดินทาง/เบี้ยขยัน/ค่าชุด/ค่าอาหาร — บวก/หักทุกสลิป |
| รายรับ/รายการหักพิเศษ | `customEarnings` / `customDeductions` | รายการครั้งเดียวต่อเดือน |
| เงินสุทธิ | `netSalary` (= `earnings − deductions`) | |
| สลิปเงินเดือน | `slipRows.ts` (single source HTML/PDF/modal) | |
| หนังสือรับรองเงินเดือน | salary certificate (`certCounters`) | พนักงานพิมพ์เองใน /salary |

## รอบเงินเดือน / การยืนยัน

| ไทย (UI) | code | ความหมายสั้น |
|---|---|---|
| ยืนยันยอด | `payrollConfirms` (`confirmedAt`, `setPayrollConfirm`) | admin ปิดยอดเดือน → freeze สลิป + เขียน poolSnapshots |
| ปิดรอบ (ถาวร) | `lock` (`isMonthLocked`, `payrollLock.ts`, `lockAtMs`) | 7 วันหลังยืนยันครั้งแรก → แก้ไม่ได้ |
| ช่วงแก้ได้ (grace) | grace period (`firstConfirmedAt` → +7 วัน) | ยืนยันแล้วแต่ยังไม่ปิดรอบ → ยังแก้ได้ + auto re-settle |
| auto re-settle | `syncConfirmedMonth` (settle ทุกแถว + re-stamp + changeLog) | คำนวณใหม่ทั้งเดือนเมื่อแก้ใน grace |
| ประวัติการแก้ | `payrollConfirms[ym].changeLog` (`appendPayrollChangeLog`) | log การแก้หลังยืนยัน |
| snapshot (ค่าแช่แข็ง) | `buildRateFieldsSnapshot` · `totalLeaveDays` ใน salary doc | freeze เรท/วันลา ต่อเดือน |
| ยกยอดติดลบ | auto-carry (`autoCarryFromMonth`, `syncAutoCarryAdvance`) | net<0 → สร้าง advance เดือนถัดไป |

## เบิก / กู้

| ไทย (UI) | code | ความหมายสั้น |
|---|---|---|
| เบิกเงินล่วงหน้า | `advance` (`advances`, `AdvanceRequestModal`) | เบิกก่อน · หักในเดือนที่เบิก · 1 ครั้ง/เดือน |
| เพดานเบิก | advance limit (`getEffectiveBaseSalary` × %) | <3y=50% … 6y+=100% |
| เงินกู้ผ่อนคืน | `employeeLoans` (`principal`, `monthlyDeduction`, `repayments`) | admin สร้าง · หักอัตโนมัติทุกเดือน · 1 active/คน |

## วันลา / ปฏิทิน / หน้าที่

| ไทย (UI) | code | ความหมายสั้น |
|---|---|---|
| วันลา | `leaves` (`LeaveEntry`) · `leaveUtils.ts` | |
| โควต้าวันลา | weekday quota (2 วัน/เดือน) · `getOverQuotaDays` | |
| เกินโควต้า | over-quota (`overQuotaDeduction`) | ลาเกิน 2 วัน → หัก × dailyRate |
| ปฏิทินเปิด-ปิดร้าน | `storeCalendar` (`/config/storeCalendar`) | เสาร์เปิดพิเศษ/อาทิตย์ปิด/จ่ายเพิ่มเสาร์ |
| จ่ายเพิ่มเสาร์พิเศษ | `paidExtraSaturdays` → `saturdayExtraPayEarnings` | ทำงานเสาร์เปิดพิเศษ → +1 วันในสลิป |
| หน้าที่ประจำ | `duties` + `dutyAssignments` · `applicableDuties` | rotation รายสัปดาห์/เดือน · `coveragePay` จ่ายแทน |
| ปิดสิทธิ์เงินเดือน | `salaryDisabled` | ปิดทั้งหมดของเงินเดือน (ฝึกงาน/part-time/ลาออก) |

## ความรู้ต่างๆ (knowledge)

| ไทย (UI) | code | ความหมายสั้น |
|---|---|---|
| ความรู้ต่างๆ | `/knowledge` · `KnowledgeView` · `src/content/knowledge/` | reference + เครื่องคิดเลข |
| ราคาทอง 96.5% | `goldPrice` (`/config/goldPrice`, `useGoldPrice`) | ดึงอัตโนมัติทุก 15 นาที |
| ค่าเปลี่ยน นน. เท่ากัน | `changePriceUtils.ts` (`CHANGE_PRICE_WEIGHTS`) | |
| ทอง / เงิน / นาก | tone `maroon` / `silver` / `nak` (rose-gold) | สีเฉพาะใน knowledge content |
