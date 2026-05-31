# Reference Docs — สารบัญ

เอกสารอ้างอิงเชิงลึกของ Petchmukda EM System แยกตามหัวข้อ
อ่าน `CLAUDE.md` ที่ root ก่อนเพื่อภาพรวม แล้วค่อยเจาะหัวข้อที่นี่

| เอกสาร | อ่านเมื่อ |
|---|---|
| [`reference/business-rules.md`](reference/business-rules.md) | จะแก้สูตรเงินเดือน / กองกลาง / วันลา / โบนัส |
| [`reference/firebase-collections.md`](reference/firebase-collections.md) | จะแตะ Firestore schema, security rules, subscription scope |
| [`reference/line-integration.md`](reference/line-integration.md) | จะแก้ LINE Bot webhook, command, หรือ auth flow |
| [`reference/ui-components.md`](reference/ui-components.md) | จะหา component, shared layout, หรือ modal pattern |
| **ด้านล่างในไฟล์นี้** | จะแตะระบบ **กองกลาง (Pool)** — terminology, data flow, privacy |

---

## กองกลาง (Pool) — terminology

> **UI ภาษาไทยใช้คำว่า "กองกลาง" · code ใช้คำว่า `pool`**

"กองกลาง" คือกองชิ้นค่าคอมที่พนักงานในตำแหน่งเดียวกัน (มี `poolGroup` ตรงกัน)
เอามารวมกันแล้วแบ่งตามผลงาน − วันลา ไม่ใช่ต่างคนต่างได้ตามชิ้นของตัวเอง

ตอนเปลี่ยน/เพิ่มข้อความ UI ให้ใช้ "กองกลาง" — **ห้ามแตะ identifier ในโค้ด**
(`poolGroup`, `poolExclusion`, `computePoolSharesForGroup`, `poolSnapshots`,
`PoolFlowModal` ฯลฯ) ตามหลัก "ภาษาไทยใน UI, อังกฤษใน code"

---

## Single source of truth — สูตรกองกลาง

ทุกหน้าที่โชว์ค่าคอมต้องผ่าน util ตัวเดียวกัน เพื่อให้ตัวเลขตรงกันเสมอ:

```
computePoolSharesForGroup()  (src/utils/salaryUtils.ts)
   ↓ ใช้โดย
   ├── SalaryView           (/salary — พนักงาน)
   ├── PayrollSummaryPanel   (/admin/payroll — จ่ายเงิน)
   ├── SalaryAdminEdit       (/admin/salary — แก้ค่าคอม)
   └── PoolFlowModal         (ปุ่ม 📊 แผนผังเงินเดือน — admin + พนักงาน)
```

**กฎเหล็ก:** ถ้าจะคำนวณค่าคอม/ส่วนแบ่งกองกลางที่ไหนก็ตาม **ห้ามเขียนสูตรซ้ำ** —
เรียก `computePoolSharesForGroup` แล้วอ่านผลออกมา ไม่งั้นหน้าต่าง ๆ จะโชว์เลขไม่ตรงกัน

input ที่ต้องป้อนเหมือนกันทุกหน้า: `groupEmployeeIds`, `salaryData`, `allLeaves`,
`yearMonth`, `employeeDirectory` — ถ้าหน้าใดป้อน input ต่าง (เช่นสมาชิกกลุ่มไม่ครบ)
เลขจะเพี้ยน ดู "วิธีหา groupEmployeeIds" ด้านล่าง

### วิธีหา groupEmployeeIds (ต่างกัน admin vs พนักงาน)

- **admin** มี `employeeDirectory` ครบทุกคน → filter ด้วย `role.poolGroup === group`
- **พนักงาน** มี `employeeDirectory` แค่ตัวเอง (rules) → ต้อง discover เพื่อนจาก
  `salaryData[peerId][month].roleId` ที่ map ไป `poolGroup` เดียวกัน + รวมตัวเองเสมอ

ทั้งสองวิธีให้ "ชุดคนที่มีสิทธิ์" ชุดเดียวกัน เพราะคนที่ไม่มี salary doc / ชิ้น 0
จะถูกตัดด้วยเกณฑ์ 80% อยู่แล้ว (ดู `computeShares` ใน salaryUtils)

---

## Privacy: salaries vs poolSnapshots (phase 1 / phase 2)

ปัญหา: salary doc มี field อ่อนไหว (`note`, `customDeductions`, `lateDeduction`,
`socialSecurity`, `slipUrl` ฯลฯ) — เปิดให้พนักงานอ่านของเพื่อนทุกคนไม่ได้
แต่การคำนวณกองกลางต้องรู้ **pieces + roleId + poolExclusion + วันลา** ของเพื่อนทั้งกลุ่ม

วิธีแก้: แยก field ที่ไม่อ่อนไหวออกมาเป็น collection ใหม่ `poolSnapshots/{ym}`
(1 doc/เดือน, map `empId → { pieces, roleId, poolExclusion, totalLeaveDays }`)

| | salaries | poolSnapshots |
|---|---|---|
| field | เต็มใบ (มี sensitive) | เฉพาะที่ใช้คำนวณกองกลาง |
| เขียน | `updateSalary` (admin) | `updateSalary` mirror ทุกครั้ง + `backfillPoolSnapshots()` ตอน "ยืนยันยอด" |
| อ่าน (rules) | **phase 1:** signed-in ทุกคน · **phase 2:** admin/เจ้าของเท่านั้น | signed-in ทุกคน |

**สถานะปัจจุบัน = phase 1:**
- `useSalariesForScope` ให้ทั้ง admin และพนักงาน subscribe ทุกคน (collectionGroup)
  → กองกลางคำนวณถูกทุกเดือน ไม่ต้องรอ backfill (ตัวเลขไม่มีทางเพี้ยน)
- `firestore.rules` ยังเปิด salaries อ่านได้ทุก signed-in เป็น safety net
- poolSnapshots ถูกเขียน/subscribe ขนานไว้ (verify + เตรียม phase 2)

**phase 2 (ทำเมื่อ backfill ครบทุกเดือน + verify ว่า `/salary` โชว์ % ถูก):**
1. `firestore.rules` → salaries `allow read: if isAdmin() || isEmployeeOwner()`
   + collectionGroup `months` → `allow read: if isAdmin()`
2. `useSalariesForScope` employee branch → `subscribeEmployeeSalaries(employeeId)`
3. พนักงานอ่าน peer data จาก poolSnapshots แทน (merge ใน `useFirebaseAppData`
   มีอยู่แล้ว — รอแค่สลับ subscription + ล็อก rules)

> ลำดับสำคัญ: ต้องสลับ subscription **พร้อม** ล็อก rules ใน commit เดียว ไม่งั้น
> เดือนที่ยังไม่ backfill จะหา peer ไม่เจอ → พนักงานเห็นส่วนแบ่ง 100% (เพี้ยน)

ไฟล์ที่เกี่ยวข้อง: `src/firebase/poolSnapshots.ts`,
`src/firebase/hooks/useFirestore.ts` (`useSalariesForScope`, `usePoolSnapshots`),
`src/data/useFirebaseAppData.ts` (`updateSalary` mirror + `salaryData` merge)
