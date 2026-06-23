#!/bin/bash
# SessionStart hook — Petchmukda EM System
# 1) (web only) ติดตั้ง dependencies ให้ test/typecheck/biome รันได้ใน session ใหม่
# 2) ฉีด context สั่งให้อ่านเอกสาร .md สำคัญก่อนเริ่มงาน
set -euo pipefail

# ── 1) install deps (เฉพาะ remote/web · idempotent · log ไป stderr ไม่ให้ปน stdout)
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  echo "[session-start] npm install…" 1>&2
  npm install --no-audit --no-fund 1>&2 2>&1 || echo "[session-start] npm install failed (continuing)" 1>&2
fi

# ── 2) onboarding context — อ่าน docs ก่อนเริ่ม (stdout = additionalContext)
read -r -d '' CTX << 'CONTEXT' || true
ก่อนเริ่มงานในโปรเจกต์นี้ (Petchmukda EM System) ให้อ่านเอกสารเหล่านี้ก่อนเสมอ:
- CLAUDE.md — ภาพรวมระบบ + conventions (โหลดอัตโนมัติแล้ว)
- docs/reference.md — สารบัญ + สถาปัตยกรรมกองกลาง (Pool) + privacy
- docs/reference/business-rules.md — สูตรเงินเดือน/กองกลาง/วันลา/กฎปิดรอบ 7 วัน + auto re-settle เดือน grace
- docs/reference/testing.md — invariants (เงินไม่เพี้ยน) + idempotency · อ่านก่อนแก้ logic ใน src/utils/
- docs/reference/troubleshooting.md + glossary.md — runbook + คำศัพท์ไทย↔code
- docs/reference/firebase-collections.md / line-integration.md / ui-components.md — ตามงานที่ทำ
- docs/reference/knowledge-content.md — อ่านก่อนแก้/เพิ่มเนื้อหา "ความรู้ต่างๆ" (src/content/knowledge/)
กฎสำคัญ: เป็นระบบเงินเดือนจริง — เมื่อแก้ logic ใน src/utils/ ต้องเพิ่ม/อัปเดตเทสต์ แล้วรัน
"npm run typecheck && npm test && npx biome check" ให้ผ่านก่อน push เสมอ
CONTEXT

node -e 'const fs=require("fs");const ctx=fs.readFileSync(0,"utf8");process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:ctx}}))' <<< "$CTX"
