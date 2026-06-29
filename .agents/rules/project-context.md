---
trigger: always_on
---

- Using npm
- Production (ใช้งานจริง) — ต้อง backward compatible เสมอ: ห้าม breaking changes ที่ทำข้อมูลเก่าพัง/คำนวณเพี้ยน (migrate-on-read + เก็บ legacy field · ดู CLAUDE.md → Conventions)
- Read CLAUDE.md for project overview, architecture, and conventions
- Detailed references in docs/reference/
- Named Firestore database: petchmukda-bot (not default)
- Cloud Functions region: asia-southeast1
- Thai language in UI, English in code
- Biome for linting/formatting (not ESLint/Prettier)
