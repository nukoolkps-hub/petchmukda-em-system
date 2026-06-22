# Troubleshooting — runbook

อาการที่เจอบ่อย + วิธีแก้ · เรียงจาก "เงิน/ตัวเลข" → "ระบบรอบข้าง" ·
แต่ละข้อบอก **อาการ → สาเหตุ → วิธีแก้** + ไฟล์/ฟังก์ชันที่เกี่ยว

> หลักการกว้างๆ: ตัวเลขบนจอ **recompute สด** เกือบทุกหน้า (ผ่าน
> `computePoolSharesForGroup` + `calculateSalary`) ส่วน "ยอดทางการ" ที่ freeze อยู่ใน
> `payrollConfirms`/salary denorm · ถ้าจอกับยอดทางการไม่ตรง = ข้อมูลเปลี่ยนหลังยืนยัน

## เงิน / กองกลาง

### พนักงานเห็นส่วนแบ่งกองกลาง 100% (หรือค่าคอมเพี้ยนสูงเกิน)
- **สาเหตุ:** เดือนนั้น admin ยังไม่เคยกด "ยืนยันยอด" → `poolSnapshots/{ym}` ว่าง →
  พนักงาน discover เพื่อนในกลุ่มไม่ได้ → คิดเหมือนมีตัวเองคนเดียว
- **แก้:** admin เปิด `/admin/payroll` → เลือกเดือนนั้น → กด **"ยืนยันยอด"** หรือ
  **"ยืนยันยอดใหม่"** → `backfillPoolSnapshots()` เขียน snapshot ทุกคนในกลุ่มทันที
- ดู `docs/reference.md` → "Recovery — poolSnapshots"

### แบนเนอร์ "ยอดเปลี่ยน" เด้งในเดือนที่ยืนยันแล้ว
- **สาเหตุ:** ข้อมูลของเดือนนั้นเปลี่ยนหลังยืนยัน (`breakdownSig` ไม่ตรง)
- **ปกติ (grace):** การแก้ใน grace จะ **re-settle + re-stamp อัตโนมัติ** แล้ว
  (`syncConfirmedMonth`) → แบนเนอร์ไม่ควรเด้ง · ถ้าเด้ง = มีเดือน "ปลายน้ำ" ที่กระทบจาก
  auto-carry แต่ไม่ได้ถูก re-settle → กด **"ยืนยันยอดใหม่"** ในเดือนที่เด้ง
- **เดือน locked:** แก้ไม่ได้แล้ว — แบนเนอร์เป็นแค่ข้อมูล (ยอด freeze ถาวร)

### แก้ค่าคอม/ลา/เบิก ในเดือนที่ยืนยันแล้ว แต่ตัวเลขไม่อัปเดต
- **เช็ค 1:** เดือนนั้น **ปิดรอบถาวรหรือยัง** (พ้น 7 วันจากยืนยันครั้งแรก)? ถ้าใช่
  จะแก้ไม่ได้ (ตั้งใจ) — UI throw "ปิดรอบแล้ว"
- **เช็ค 2:** เป็น admin ไหม — auto re-settle ทำเฉพาะ admin (`syncConfirmedMonth`
  guard `isAdmin`)
- **เช็ค 3 (วันลา):** ถ้าแก้ใบลาแล้ว "การหักกองกลางจากวันลา" ไม่ขยับ → ดูว่า
  `restampLeaveSnapshot` ทำงาน (pool อ่าน `totalLeaveDays` จาก snapshot ไม่ใช่ live)

### เงินสุทธิติดลบ — เกิดอะไรขึ้น
- **ปกติ:** net < 0 เดือน X → admin ยืนยันยอด → ระบบสร้าง advance ในเดือน X+1
  (`autoCarryFromMonth=X`, status approved) → หักคืนเดือนถัดไป + บล็อกพนักงานเบิกใหม่
- ถ้า net กลับเป็นบวกหลังแก้ → carry ถูกลบอัตโนมัติ (`syncAutoCarryAdvance`)
- พนักงานเบิกใหม่ไม่ได้ → admin กด **"อนุญาตให้ยื่นเบิกใหม่"** (`allowReapply`)

### แก้ปฏิทินร้านแล้ว throw "อยู่ในเดือนที่ปิดรอบแล้ว"
- **สาเหตุ:** วันที่แก้ตกอยู่ในเดือนที่ปิดรอบถาวร (ปฏิทินเป็น config กลาง · ถ้าแก้
  เดือน locked จอจะคิดสดแต่ net freeze ไม่ขยับ → เพี้ยน) → บล็อกโดยตั้งใจ
- **แก้:** ทำได้เฉพาะเดือนที่ยังไม่ปิดรอบ · ถ้าจำเป็นจริงต้องแก้เดือน locked = ออกแบบไม่ให้ทำ

## ราคาทอง / เงิน (ความรู้ต่างๆ)

### ราคาทองไม่อัปเดต / กล่องแดงใน admin
- **เช็ค:** `/config/goldPrice.lastFetchError` + `lastFetchErrorAt` — บอก source ที่ fail
- **Manual:** กดปุ่ม refresh ใน `GoldPriceHeader` → `triggerFetchGoldPriceNow` (admin)
- **Source chain:** mukdagold (primary) → HSH (fallback) · ถ้าทั้งคู่ fail = เขียน error
  ไม่เขียนราคา · Cloud Function `fetchGoldPriceScheduled` รันทุก 15 นาที
- **Sanity:** ทอง 10,000–200,000 ฿/บาท · เงิน 10–200 ฿/กรัม (นอกช่วง = reject)

## หน้าที่ประจำ (duty)

### หน้าที่ขึ้นผิด / โผล่วันที่ร้านปิด
- **สาเหตุ:** ปฏิทินเปลี่ยนแต่ assignment ยังไม่ recompute
- **แก้:** เกิด auto เมื่อแก้ duty/calendar (`triggerRecomputeDutyAssignments`) ·
  server filter ด้วย `applicableDuties` (storeCalendar) ก่อน assign
- client/server logic ต้อง sync — ถ้าแก้ `dutyUtils.ts` ต้องผ่าน `scripts/check-duty-sync.mjs`

## LINE Bot / Daily Summary

### บอทไม่ส่งข้อความ / daily summary ไม่มา
- **เช็ค config:** Firestore `config/secrets` มี `LINE_CHANNEL_ACCESS_TOKEN`,
  `ADMIN_LINE_USER_ID`, `ANTHROPIC_API_KEY`
- **Daily summary setup (ครั้งเดียวต่อ project):** share Google Calendars 3 ใบ
  ให้ service account + enable Calendar API (ดู CLAUDE.md → Daily Summary)
- **Manual test:** พิมพ์ `ทดสอบแจ้งเตือน` ใน LINE 1:1 → บอท push ตัวอย่างให้ admin

### พนักงาน login ไม่ได้
- **สาเหตุ:** `employee.lineUserId` ไม่ตรงกับ LINE profile ที่ login
- **แก้:** admin set `lineUserId` ใน profile พนักงานให้ตรง (ดู Auth Flow ใน CLAUDE.md)

## Deploy

### deploy job fail (เช่น storage-rules 503)
- **สาเหตุ:** Google API ขัดข้องชั่วคราว (ไม่ใช่บั๊กโค้ด) — เจอเป็นครั้งคราวกับ
  `deploy-storage-rules`
- **แก้:** re-run job นั้นใน GitHub Actions · ถ้า `test` job fail = typecheck/เทสต์พังจริง
  → แก้โค้ดก่อน (deploy ทั้งหมด `needs: test`)

### แก้แล้วไม่ขึ้น production
- deploy เกิดเฉพาะ push เข้า `main` (auto) · เช็คว่า merge เข้า main แล้ว + job เขียว ·
  URL: https://petchmukda-bot.web.app
