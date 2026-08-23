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
| `processAdvanceNotifications` | Scheduled (every minute) | ส่ง LINE notification approve/reject (+ รูปสลิป) |
| `processLoanNotifications` | Scheduled (every minute) | แจ้งพนักงานเมื่อ admin สร้างเงินกู้ใหม่ (+ รูปสลิป) |
| `onLeaveCreated` | Firestore trigger | อัพเดท leave stats |
| `onAdvanceCreated` | Firestore trigger | แจ้ง admin advance ใหม่ |
| `monthlyPayrollSummary` | Scheduled (28th, 23:00) | สรุปเงินเดือนรายเดือน |
| `cleanupOldAdvances` | Scheduled (1st, 02:00) | ลบ advances เก่า > 6 เดือน |
| `backupFirestoreScheduled` | Scheduled (Sun 03:00) | สำรอง Firestore → GitHub (ดู "สำรองข้อมูล + ล้างข้อมูล") |
| `triggerFirestoreBackupNow` | Callable (admin) | สำรอง Firestore → GitHub แบบ manual |
| `wipeTestData` | Callable (admin) | ล้างข้อมูลทั้งระบบ (start-fresh · confirm `"ล้างข้อมูล"`) |
| `wipeEmployeeData` | Callable (admin) | ล้างข้อมูลพนักงานรายคน (confirm `"ล้างข้อมูล"`) |

## Notification toggles (`config/notifications`)

Admin เปิด/ปิด notification รายประเภทผ่าน `/admin?section=line-notifications`
· เก็บใน `config/notifications` doc · default semantic: missing field /
`true` = enabled (backward compat) · เฉพาะ `=== false` ที่ถือว่า disabled

| Field | Default | ผล |
|---|---|---|
| `dailySummaryEnabled` | true | สรุปประจำวัน 07:30 push เข้ากลุ่มที่ตั้งไว้ใน `dailySummaryGroups` (เสาร์ปกติข้าม) |
| `advanceRequestEnabled` | true | แจ้ง ADMIN เมื่อพนักงานยื่นเบิก (+ clipboard เลขบัญชี) |
| `advanceApprovalEnabled` | true | แจ้งพนักงานเมื่อ approve/reject (+ รูปสลิป) |
| `loanCreatedEnabled` | true | แจ้งพนักงานเมื่อ admin สร้างเงินกู้ใหม่ (+ รูปสลิป) |
| `dailySummaryGroups` | (ไม่มี) | **array กลุ่มปลายทางของสรุปเช้า** — ADMIN ตั้งเองในหน้าเดียวกัน (ดูหัวข้อถัดไป) |

### กลุ่มปลายทางของสรุปเช้า (`dailySummaryGroups`)

เดิม hardcode ที่ `DAILY_SUMMARY_GROUPS` (`functions/src/dailySummary/config.ts`) —
เปลี่ยนกลุ่มทีต้องแก้โค้ด + deploy · ตอนนี้ ADMIN เพิ่ม/ลบ/ตั้งค่าเองได้ที่
`/admin → LINE BOT → การแจ้งเตือน → "กลุ่มที่รับสรุปเช้า"`

```ts
{ lineTargetId: "C…"   // C=กลุ่ม · R=ห้อง · U=1:1 + hex 32 ตัว (คีย์หลัก ห้ามซ้ำ)
  name: "we r mukda"   // ชื่อไว้จำ (โชว์ใน UI + log)
  calendarId?: string  // Google Calendar ของ "ภารกิจวันนี้" · ว่าง = ไม่ดึงปฏิทิน
  includeLeaves?: boolean      // รวม "พนักงานหยุดวันนี้"
  sendAiTip?: boolean          // "เคล็ดลับมืออาชีพ" (Claude API)
  sendScheduledImage?: boolean // แนบรูปที่ตั้งวันไว้ (dailySummaryImages)
}
```

**ลำดับที่ server ใช้** (`resolveDailySummaryGroups` · `dailySummary/groups.ts`):
1. field เป็น array → ใช้ค่านั้น (**array ว่าง = ตั้งใจไม่ส่ง**)
2. ไม่มี field เลย → ใช้ `DAILY_SUMMARY_GROUPS` เดิม **แล้ว seed ลง Firestore ให้
   ครั้งเดียว** → รอบถัดไป ADMIN เห็นกลุ่มจริงในหน้า UI แล้วแก้ต่อได้
3. อ่าน Firestore ไม่ได้ → fallback ค่าเดิมในโค้ด (ไม่เงียบหาย)

**ค่าที่ไม่ถูกต้องถูกตัดทิ้งทั้ง 2 ฝั่ง** — ID ผิดรูปแบบ / ซ้ำ (ไม่งั้นกลุ่มเดียวได้ 2 ข้อความ) ·
UI: `normalizeDailySummaryGroups` (`src/utils/dailySummaryGroups.ts` · มีเทสต์) ·
server: `fromStored` ใน `groups.ts` · ⚠️ regex ต้องตรงกัน 2 ฝั่ง

**หา Group ID:** เชิญบอทเข้ากลุ่ม → พิมพ์ `ไอดีกลุ่ม` ในกลุ่มนั้น

### เมื่อ LINE ส่งไม่สำเร็จ — ห้ามเงียบ

LINE เป็นช่องที่อาจล้มได้ (token หมดอายุ/config ผิด) — ต้องแจ้งให้คนรู้ ไม่ใช่กลืน error:

- **คำขอเบิกใหม่ (`notifyAdvanceRequest`):** frontend `await` ผลการส่ง (เลิก
  fire-and-forget) → ถ้าส่งไม่สำเร็จ **พนักงาน**เห็น toast ตามจริง · ฝั่ง server ถ้า
  `pushLineMessage` แจ้ง admin ล้มเหลว เขียนธง `lineNotifyFailed` ลง advance doc →
  **admin** เห็น badge "LINE แจ้งเตือนแอดมินไม่สำเร็จ" ใน AdminAdvancePanel (เพราะ
  LINE คือช่องที่พัง แจ้งทาง LINE ไม่ได้) · แยก `{skipped}`/`{ok}` (admin ปิด toggle/
  ไม่มี config) ออกจาก fail จริง — ไม่ถือเป็น error
- หลักการ: ผลการส่ง LINE ที่ fail ต้อง surface ขึ้น UI เสมอ (toast หรือ badge)

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
