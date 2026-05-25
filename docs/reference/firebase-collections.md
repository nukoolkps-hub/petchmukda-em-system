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
| baseSalary | number | เงินเดือนพื้นฐาน (override) |
| singleRatePieces | number | ชิ้นเดี่ยว |
| normalSalePieces | number | ชิ้นขายปกติ |
| specialSalePieces | number | ชิ้นขายพิเศษ |
| buyPieces | number | ชิ้นซื้อ |
| invitePieces | number | ชิ้นชวน |
| transferPieces | number | ชิ้นโอน |
| lateDeduction | number | หักสาย |
| socialSecurity | number | ประกันสังคม |
| note | string | หมายเหตุ |

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
| employees | admin / owner | admin (full), owner (profile fields only) |
| leaves | admin / owner | admin (all), owner (create/delete) |
| salaries | admin / owner | admin only |
| advances | admin / owner | owner (create), admin (update/delete) |
| roles | all signed-in | admin only |
| payrollConfirms | admin | admin |
| config | blocked | blocked (Functions use Admin SDK) |

## Storage Rules

| Path | Read | Write |
|---|---|---|
| avatars/{employeeId}/ | all signed-in | admin / owner (image < 8MB) |
| advanceSlips/{advanceId}/ | admin / owner | admin only (image < 8MB) |
