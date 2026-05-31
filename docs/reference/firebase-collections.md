# Firebase Collections & Security Rules

Database ID: `petchmukda-bot` (named database, ไม่ใช่ default)

## Collections

### employees

| Field | Type | Description |
|---|---|---|
| name | string | ชื่อพนักงาน |
| avatar | string | ตัวอักษร/emoji สำหรับ avatar |
| avatarType | "text" / "emoji" / "image" | ประเภท avatar |
| avatarImageUrl | string / null | URL รูป avatar |
| role | string | ชื่อตำแหน่ง |
| roleId | string | ID ของ role document |
| bank | string | ชื่อธนาคาร |
| bankAccountNumber | string | เลขบัญชี |
| lineUserId | string | LINE User ID (ใช้เป็น auth uid) |
| baseSalary | number | เงินเดือนพื้นฐาน |
| singlePieceRate | number | rate ชิ้นเดี่ยว |
| normalSalePieceRate | number | rate ขายปกติ |
| specialSalePieceRate | number | rate ขายพิเศษ |
| buyPieceRate | number | rate ซื้อ |
| invitePieceRate | number | rate ชวน |
| transferPieceRate | number | rate โอน |
| salaryDisabled | boolean | ซ่อน tab เงินเดือน |
| poolExclusion | "sell" / "buy" / "both" / null | ยกเว้น pool |
| socialSecurity | number | ประกันสังคมรายเดือน (snapshot ลง salary doc ตอนคำนวณ) |
| startWorkMonth | string (YYYY-MM) | วันที่เริ่มงาน — ใช้ในหนังสือรับรองเงินเดือน |
| prefix | "นาย" / "นาง" / "นางสาว" | คำนำหน้าชื่อ — ใช้ในหนังสือรับรอง |

### leaves

| Field | Type | Description |
|---|---|---|
| employeeId | string | ref → employees |
| employeeName | string | ชื่อพนักงาน |
| type | "personal" / "sick" | ประเภทลา |
| start | string (YYYY-MM-DD) | วันเริ่มลา |
| end | string (YYYY-MM-DD) | วันสิ้นสุดลา |
| days | number | จำนวนวัน |
| reason | string | เหตุผล |
| createdAt | number (timestamp) | เวลาสร้าง |

### salaries/{employeeId}/months/{YYYY-MM}

| Field | Type | Description |
|---|---|---|
| singleRatePieces | number | ชิ้นเดี่ยว (ตำแหน่งที่ไม่แยก sell/buy) |
| normalSalePieces | number | ชิ้นขายปกติ |
| specialSalePieces | number | ชิ้นขายพิเศษ (ใครขายใครได้) |
| buyPieces | number | ชิ้นรับซื้อ |
| invitePieces | number | ชิ้นเชิญสมัครบัตร |
| transferPieces | number | ชิ้นย้ายข้อมูลบัตร |
| lateDeduction | number | หักมาสาย/ขาดงาน |
| socialSecurity | number | ประกันสังคม |
| customEarnings | `{label,amount}[]` | รายรับที่ admin เพิ่มเอง |
| customDeductions | `{label,amount}[]` | รายหักที่ admin เพิ่มเอง |
| note | string | หมายเหตุ |
| **Snapshot fields** | | *เขียนอัตโนมัติตอน save salary — ใช้คำนวณ Pool ฝั่ง employee* |
| roleId | string | snapshot ของ `employees.roleId` ตอน save |
| poolExclusion | string\|null | snapshot ของ `employees.poolExclusion` ตอน save |
| totalLeaveDays | number | `weekdayLeaves + sundayLeaves` ของเดือนนั้น |
| **Slip freeze fields** | | *เขียนตอน "ยืนยันยอด" → freeze PDF ลง Storage* |
| slipUrl | string | URL ของสลิป PDF ใน Storage |
| slipFrozenAt | string (ISO) | เวลา freeze สลิป |
| updatedAt | number | timestamp ล่าสุด |

หมายเหตุ: `baseSalary` ไม่อยู่ใน salary doc — เก็บใน `employees.baseSalary` (ป้องกัน leak ผ่าน salaries ที่อ่านได้ทุกคน)

### advances

| Field | Type | Description |
|---|---|---|
| employeeId | string | ref → employees |
| employeeName | string | ชื่อพนักงาน |
| amount | number | จำนวนเงิน |
| reason | string | เหตุผล |
| month | string (YYYY-MM) | เดือนที่เบิก |
| status | "pending" / "approved" / "rejected" | สถานะ |
| submittedAt | string (ISO) | เวลาส่งคำขอ |
| approvedAt | string (ISO) | เวลาอนุมัติ |
| rejectedAt | string (ISO) | เวลาปฏิเสธ |
| rejectionReason | string | เหตุผลปฏิเสธ |
| slipImageUrl | string | URL สลิปโอนเงิน |
| lineNotificationStatus | string | สถานะ LINE notification |

### roles

| Field | Type | Description |
|---|---|---|
| name | string | ชื่อตำแหน่ง |
| poolGroup | string / null | กลุ่ม pool commission |
| icon | string | emoji icon |

### payrollConfirms/{YYYY-MM}

| Field | Type | Description |
|---|---|---|
| confirmedAt | string (ISO) | เวลายืนยัน |
| totalAmount | number | ยอดรวม |
| employeeCount | number | จำนวนพนักงาน |

### config/secrets (Cloud Functions only)

| Field | Description |
|---|---|
| ADMIN_LINE_USER_ID | LINE User ID ของ admin |
| LINE_LOGIN_CHANNEL_ID | LINE Login Channel ID |
| LINE_LOGIN_CHANNEL_SECRET | LINE Login Channel Secret |
| LINE_CHANNEL_ACCESS_TOKEN | Messaging API Access Token |
| LINE_CHANNEL_SECRET | Messaging API Channel Secret |

## Security Rules Summary

| Collection | Read | Write |
|---|---|---|
| employees | admin / owner | admin (full), owner (profile + bank fields only) |
| leaves | admin / owner | owner (create), owner (delete future-only), admin (update/delete any) |
| salaries (+ collectionGroup `months`) | **all signed-in** | admin only |
| advances | admin / owner | owner (create), admin (update/delete) |
| roles | all signed-in | admin only |
| payrollConfirms | all signed-in | admin only |
| certCounters/{พ.ศ.} | all signed-in | all signed-in (count ต้อง +1 เท่านั้น) |
| config/* | blocked | blocked (Functions ใช้ Admin SDK) |

**เหตุที่ salaries / payrollConfirms อ่านได้โดย all signed-in:**
- พนักงานต้องใช้ pieces ของเพื่อนในการคำนวณ Pool (ดู Pool snapshot)
- พนักงานต้องรู้ว่า admin "ยืนยันยอด" แล้วหรือยัง (ปลดล็อกการพิมพ์สลิป)
- `baseSalary` และข้อมูลส่วนตัวอื่นยังอยู่ใน `employees` ที่ถูกปิดสิทธิ์ไว้

## Storage Rules

| Path | Read | Write |
|---|---|---|
| avatars/{employeeId}/ | all signed-in | admin / owner (image < 8MB) |
| advanceSlips/{advanceId}/ | admin / owner | admin only (image < 8MB) |
| salarySlips/{employeeId}/{YYYY-MM}.pdf | admin / owner | admin only (PDF < 8MB) — freeze ตอนยืนยันยอด |
