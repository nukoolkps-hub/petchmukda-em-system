# LINE Integration

## LINE Channels ที่ใช้

| Channel | ประเภท | ใช้ทำอะไร |
|---|---|---|
| Petchmukda Login | LINE Login | Login เข้าเว็บ |
| Zoe Lin (Bot) | Messaging API | Webhook + แจ้งเตือน |

## LINE Bot Commands

| Command | Scope | Description |
|---|---|---|
| `ไอดีฉัน` | แชทส่วนตัว | ดู LINE User ID ของตัวเอง |
| `ไอดีกลุ่ม` | กลุ่ม | ดู Group ID ของกลุ่ม |
| `คำสั่ง` | แชทส่วนตัว (admin) | แสดงคำสั่งทั้งหมด |
| `@บอท ไอดี @ผู้ใช้` | กลุ่ม (admin) | ดู LINE User ID ของคนที่แท็ก |
| `@บอท เชื่อมพนักงาน @พนักงาน` | กลุ่ม (admin) | ผูก LINE กับพนักงาน |
| `@บอท เชื่อมพนักงาน @พนักงาน ชื่อ` | กลุ่ม (admin) | ผูก LINE กับชื่อที่ระบุ |

Source: `functions/src/line/commands/`

## Command Architecture

```
functions/src/line/
├── webhook.ts              ← HTTPS endpoint, verify signature
├── core/
│   ├── types.ts            ← LineCommand interface, parse result types
│   ├── dispatcher.ts       ← Match text → command → handle
│   ├── reply.ts            ← Reply/push helpers
│   ├── message.ts          ← Mention parsing utilities
│   └── admin.ts            ← Admin authorization check
└── commands/
    ├── myId.ts             ← ไอดีฉัน
    ├── groupId.ts          ← ไอดีกลุ่ม
    ├── id.ts               ← ไอดี @ผู้ใช้
    ├── help.ts             ← คำสั่ง
    └── setupEmployee.ts    ← เชื่อมพนักงาน
```

### Adding a New Command

1. สร้างไฟล์ใน `functions/src/line/commands/`
2. Implement `LineCommand<TPayload>` interface: `name`, `parse()`, `handle()`
3. Register ใน `functions/src/line/core/dispatcher.ts`
4. Deploy: `firebase deploy --only functions`

## Cloud Functions

| Function | Trigger | Description |
|---|---|---|
| `lineWebhook` | HTTPS | รับ webhook จาก LINE |
| `lineAuth` | Callable | LINE Login → Firebase custom token |
| `devAuth` | Callable | Dev login (emulator only) |
| `setAdmin` | Callable | ตั้ง admin claim |
| `bootstrapAdmin` | Callable | Bootstrap admin คนแรก |
| `seedLineConfigFromEnv` | Callable | Seed LINE config (emulator only) |
| `notifyAdvanceRequest` | Callable | แจ้ง admin คำขอเบิกเงิน |
| `processAdvanceNotifications` | Scheduled (every minute) | ส่ง LINE notification approve/reject |
| `onLeaveCreated` | Firestore trigger | อัพเดท leave stats |
| `onAdvanceCreated` | Firestore trigger | แจ้ง admin advance ใหม่ |
| `monthlyPayrollSummary` | Scheduled (28th, 23:00) | สรุปเงินเดือนรายเดือน |
| `cleanupOldAdvances` | Scheduled (1st, 02:00) | ลบ advances เก่า > 6 เดือน |

## LINE Login Flow (Detail)

```
1. Frontend: startLineLogin() → redirect to LINE authorize URL
   - client_id = LINE_LOGIN_CHANNEL_ID
   - redirect_uri = https://petchmukda-bot.web.app/callback
   - scope = profile openid

2. LINE redirects back: /callback?code=xxx&state=yyy

3. AuthContext detects ?code= → calls completeLineLogin()
   - Calls Cloud Function lineAuth({ code, redirectUri })

4. lineAuth Cloud Function:
   - Exchange code → LINE access_token
   - Get LINE profile (userId, displayName)
   - Check ADMIN_LINE_USER_ID → set admin claim if match
   - Check employees collection → verify provisioned
   - Create Firebase custom token

5. Frontend: signInWithCustomToken(customToken) → signed in
```

## Webhook URL

```
https://petchmukda-bot.web.app/webhook
```

Routed via Firebase Hosting rewrite → Cloud Function `lineWebhook` (asia-southeast1)
