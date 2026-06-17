# Reference Docs — สารบัญ

เอกสารอ้างอิงเชิงลึกของ Petchmukda EM System แยกตามหัวข้อ
อ่าน `CLAUDE.md` ที่ root ก่อนเพื่อภาพรวม แล้วค่อยเจาะหัวข้อที่นี่

| เอกสาร | อ่านเมื่อ |
|---|---|
| [`reference/business-rules.md`](reference/business-rules.md) | จะแก้สูตรเงินเดือน / กองกลาง / วันลา / โบนัส / **เงินกู้ผ่อนคืน** / **หักกองกลาง** / **กฎปิดรอบ 7 วัน** |
| [`reference/firebase-collections.md`](reference/firebase-collections.md) | จะแตะ Firestore schema, security rules, subscription scope |
| [`reference/line-integration.md`](reference/line-integration.md) | จะแก้ LINE Bot webhook, command, หรือ auth flow |
| [`reference/ui-components.md`](reference/ui-components.md) | จะหา component, shared layout, หรือ modal pattern |
| **ด้านล่างในไฟล์นี้** | จะแตะระบบ **กองกลาง (Pool)** + **leaves snapshot pattern** (privacy, terminology, data flow) |

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

ปัญหา: salary doc มี field อ่อนไหว (`note`, `customDeductions`,
`socialSecurity`, `slipUrl` ฯลฯ) — เปิดให้พนักงานอ่านของเพื่อนทุกคนไม่ได้
แต่การคำนวณกองกลางต้องรู้ **pieces + roleId + poolExclusion + วันลา** ของเพื่อนทั้งกลุ่ม

วิธีแก้: แยก field ที่ไม่อ่อนไหวออกมาเป็น collection ใหม่ `poolSnapshots/{ym}`
(1 doc/เดือน, map `empId → { pieces, roleId, poolExclusion, totalLeaveDays }`)

| | salaries | poolSnapshots |
|---|---|---|
| field | เต็มใบ (มี sensitive) | เฉพาะที่ใช้คำนวณกองกลาง |
| เขียน | `updateSalary` (admin) | `updateSalary` mirror ทุกครั้ง + `backfillPoolSnapshots()` ตอน "ยืนยันยอด" |
| อ่าน (rules) | **admin หรือเจ้าของเท่านั้น** | signed-in ทุกคน |
| collectionGroup `months` | admin เท่านั้น (พนักงานไม่ใช้) | — |

**สถานะปัจจุบัน = phase 2 (ล็อกแล้ว):**
- `useSalariesForScope` — admin subscribe ทุกคน (collectionGroup) · พนักงาน subscribe เฉพาะของตัวเอง (`subscribeEmployeeSalaries(employeeId)`)
- `firestore.rules` ล็อก salaries `read: isAdmin() || isEmployeeOwner(employeeId)` · collectionGroup `months` `read: isAdmin()`
- พนักงานอ่าน peer pieces/roleId/poolExclusion/leaveDays จาก `poolSnapshots/{ym}` — merge เข้า `salaryData` ใน `useFirebaseAppData` ทำให้ `computePoolSharesForGroup` ทำงานต่อโดยไม่ต้องเปลี่ยน

ไฟล์ที่เกี่ยวข้อง: `src/firebase/poolSnapshots.ts`,
`src/firebase/hooks/useFirestore.ts` (`useSalariesForScope`, `usePoolSnapshots`),
`src/data/useFirebaseAppData.ts` (`updateSalary` mirror + `salaryData` merge)

### Recovery — ถ้าพบเดือนเก่าที่ poolSnapshots ยังไม่ครบ

หลัง phase 2 ถ้าเดือนใดมี admin ยังไม่เคยกด "ยืนยันยอด" → poolSnapshots เดือนนั้นว่าง
→ พนักงานเห็นส่วนแบ่ง 100% (เพี้ยน) แก้: admin เปิด `/admin/payroll` → เลือกเดือน
→ กด "ยืนยันยอด" หรือ "ยืนยันยอดใหม่" — `backfillPoolSnapshots()` จะเขียน snapshot
ของพนักงานทุกคนในกลุ่มกองกลางของเดือนนั้นทันที

---

## Privacy: leaves (snapshot ชื่อในใบลา)

ปัญหาเดียวกับ pool — `/leaves` เปิดให้ทุกคน signed-in อ่านได้
(ปฏิทินทีม + กันลาทับวัน) แต่ `/employees` ปิดให้พนักงานอ่านเฉพาะของตัวเอง
→ พนักงาน A เห็นใบลาของ B ได้ แต่ไม่เห็น employee record ของ B
ดังนั้น **ไม่รู้ชื่อ/ชื่อเล่น B จากที่ไหน**

วิธีแก้: ใบลาเก็บ `employeeName + employeeNickname` เป็น **snapshot non-sensitive** ตอน
ยื่นลา → A อ่านชื่อ B จาก snapshot ใน leave doc ได้โดยไม่ต้องเปิดสิทธิ์อ่าน
employee record (pattern เดียวกับ `poolSnapshots` แต่ฝังในตัว doc เลย — ไม่ต้องแยก collection)

### Render: live > snapshot

ทุกที่ที่โชว์ชื่อในใบลา ใช้ลำดับเดียวกัน (ดูใน `TeamCalendar.tsx`, `LeaveListPanel.tsx`):

```ts
const livePeer = employeeDirectory.find((e) => e.id === lv.employeeId);
const displayName =
  livePeer?.nickname ||         // live (admin/owner เห็น directory)
  lv.employeeNickname ||         // snapshot (peer ที่อ่าน directory ไม่ได้)
  livePeer?.name ||
  lv.employeeName;
```

| ใบลาของ | ผู้ดู | source ของชื่อ |
|---|---|---|
| ตัวเอง | พนักงานเจ้าของ | live (directory[0] = ตัวเอง) |
| Peer B | พนักงาน A (ไม่ใช่ admin) | snapshot ใน leave doc (rules ปิด directory ของ B) |
| ใครก็ตาม | admin | live (admin subscribe ทุกคน) |

### ผลข้างเคียง: snapshot ไม่ auto-update

ใบลาเก่าๆ snapshot ค้างกับค่าตอนยื่น (เช่นยื่นตอนยังไม่มี nickname → `employeeNickname: null`)
หลัง admin set nickname หรือ rename ชื่อจริง → ใบลาเก่ายังเก็บค่าเดิมใน Firestore
แต่ **live > snapshot** ใน render ทำให้ admin/เจ้าของเห็นค่าใหม่ทันที (ไม่ต้องลบ-ยื่นใหม่)
· peer เห็นค่าเก่าจนกว่า B ยื่นใบลาใหม่ (acceptable — ไม่กระทบ business logic)

### กรองใบลาของตัวเอง — ใช้ employeeId เสมอ

`useLeaveForm.myLeaves` filter ด้วย `lv.employeeId === authUid` (ไม่ใช่ employeeName)
→ ทนต่อชื่อโดน rename · sync กับ `LeaveListPanel` ฝั่ง admin ที่ใช้ pattern เดียวกัน
