# Knowledge content — "ความรู้ต่างๆ" (`/knowledge`)

สารบัญ + context ของเนื้อหา "ความรู้ต่างๆ" — **อ่านไฟล์นี้ก่อนแก้ knowledge content**
เพื่อรู้ว่าแต่ละ section อยู่ตรงไหน ใช้ block อะไร พึ่งราคา live ไหม และต้องระวังอะไร

- **เนื้อหา (source of truth):** `src/content/knowledge/index.ts` (hardcode · 29 sections · ~1,950 บรรทัด)
- **block types:** `src/content/knowledge/types.ts`
- **render:** `KnowledgeView.tsx` (accordion + search) → `KnowledgeBlock.tsx` (dispatch ตาม `block.type`)
- **สถาปัตยกรรม component เต็ม:** ดู [`ui-components.md`](ui-components.md) → "Knowledge view" (ไฟล์นี้ไม่ duplicate)

> **ทำไมเป็น `.ts` ไม่ใช่ `.md` (และแปลงเป็น markdown runtime ไม่ได้):**
> หลาย block เป็น **live/interactive** — `calculator` (กรอกเลขคำนวณสด), `live-example`
> (อิงราคาทองวันนี้), `*-96-table` / `change-price-table` (subscribe `goldPrice`),
> `labor-cost-table` / `block-cost-table` / `loyalty-points-redeem-table` (admin แก้ inline +
> sync Firestore) · Markdown เป็นข้อความนิ่ง ทำสิ่งเหล่านี้ไม่ได้ → เนื้อหาต้องอยู่เป็น
> typed block objects ใน `.ts` · ไฟล์ `.md` นี้คือ "สารบัญ/context" สำหรับ dev ไม่ใช่ตัว runtime

## โครงสร้าง section

```ts
type KnowledgeSection = {
  id: string;        // slug · ใช้ใน search/anchor · อย่าซ้ำ
  title: string;     // หัวข้อ (ไทย) · search box filter จาก title
  Icon: LucideIcon;  // lucide-react เท่านั้น (ห้าม emoji)
  blocks: Block[];   // เนื้อหา render ตามลำดับ
};
```

## Block types (ครบทุกตัวที่ `KnowledgeBlock.tsx` render)

| กลุ่ม | block types | live? |
|---|---|---|
| **Static** | `h3` · `p` · `list` · `table` · `formula` · `example` · `image` · `callout` · `steps` | ไม่ |
| **Live (subscribe `goldPrice`)** | `change-price-table` · `sell-price-96-table` · `buy-price-96-table` · `live-example` · `calculator` (`goldPriceDefault`/`buyPriceDefault`/`silver*Default`) | ใช่ |
| **Admin-editable live (sync Firestore `/config/*`)** | `labor-cost-table` · `block-cost-table` · `loyalty-points-redeem-table` | ใช่ |
| **Helper compute** | `pawn-interest-card` (ดอกเบี้ยจำนำ) · `free-exchange-helper` (เปลี่ยนฟรี) · `date-diff-helper` (นับวัน) | ใช่ |
| **Special** | `secret` (PIN/รหัส dot mask) | ไม่ |

> เพิ่ม block type ใหม่ = ต้องแก้ 2 ที่: union ใน `types.ts` + `case` ใน `KnowledgeBlock.tsx`
> (ถ้า live ต้องผูก hook `useGoldPrice`/`useLaborCost`/ฯลฯ ใน component ของ block นั้น)

## สารบัญ 29 sections (จัดกลุ่ม)

`live?` = มี block ที่คำนวณสด/subscribe ราคา · `tone` = วัสดุ (ว่าง = ทอง/maroon default) · `line` = บรรทัดเริ่มใน `index.ts`

### น้ำหนัก · ค่าแรง · ค่าบล็อก
| id | title | blocks | live? | tone | line |
|---|---|---|---|---|---|
| `weights` | มาตรฐานน้ำหนัก (สคบ.) | h3, table, calculator | ✓ | silver | 48 |
| `labor-cost` | ค่าแรง เริ่มต้น (ทอง 96.5%) | p, **labor-cost-table**, h3, table, callout | ✓ (admin) | — | 131 |
| `block-cost` | ค่าบล็อก (ทองคำแท่ง / เงินแท่ง) | p, **block-cost-table** | ✓ (admin) | — | 1079 |

### ราคาขาย
| id | title | blocks | live? | tone | line |
|---|---|---|---|---|---|
| `sell-price-9999` | การคำนวณราคาขาย (ทอง 99.99%) | formula, live-example, calculator | ✓ | — | 163 |
| `sell-price-965` | การคำนวณราคาขาย (ทอง 96.5%) | h3, table, **sell-price-96-table**, calculator | ✓ | — | 265 |
| `sell-price-90` | การคำนวณราคาขาย (ทอง 90) | formula, calculator | ✓ | — | 341 |
| `sell-price-nak` | การคำนวณราคาขาย (นาก) | formula, calculator | ✓ | nak | 389 |
| `sell-price-silver` | การคำนวณราคาขาย (เงิน) | formula, calculator | ✓ | silver | 446 |
| `price-tag` | การอ่านป้ายสินค้า | p, image | — | — | 495 |

### ค่าเปลี่ยน
| id | title | blocks | live? | tone | line |
|---|---|---|---|---|---|
| `change-price` | ค่าเปลี่ยน นน. เท่ากัน เริ่มต้น (ทอง 96.5%) | p, **change-price-table** | ✓ | — | 514 |
| `exchange` | ค่าเปลี่ยน เพิ่มขึ้น-ลดลง (ทอง 96.5%) | h3, formula, live-example, callout, p | ✓ | — | 528 |
| `free-exchange` | การเปลี่ยนฟรี | callout, list, **free-exchange-helper** | ✓ | — | 1393 |

### รับซื้อ
| id | title | blocks | live? | tone | line |
|---|---|---|---|---|---|
| `buy-price-9999` | การคำนวณราคารับซื้อ (ทอง 99.99%) | table, calculator | ✓ | — | 682 |
| `buy-price-965` | การคำนวณราคารับซื้อ (ทอง 96.5%) | callout, h3, table, **buy-price-96-table**, calculator | ✓ | — | 747 |
| `buy-price-90` | การคำนวณราคารับซื้อ (ทอง 90) | table, calculator | ✓ | — | 828 |
| `buy-price-nak` | การคำนวณราคารับซื้อ (นาก) | table, live-example, calculator | ✓ | nak | 897 |
| `buy-price-silver` | การคำนวณราคารับซื้อ (เงิน) | callout, h3, table, calculator | ✓ | silver | 1000 |

### จำนำ
| id | title | blocks | live? | tone | line |
|---|---|---|---|---|---|
| `pawn-price` | การคำนวณราคาจำนำ | table, live-example | ✓ | nak, silver | 1095 |
| `pawn-interest` | การคำนวณดอกเบี้ยจำนำ | list, example, **pawn-interest-card** | ✓ | — | 1273 |

### โปรโมชัน · บัตร · อื่นๆ
| id | title | blocks | live? | tone | line |
|---|---|---|---|---|---|
| `discounts` | ส่วนลด | h3, list, callout | — | nak, silver | 617 |
| `points` | แต้มสะสม | h3, table, callout, **loyalty-points-redeem-table** | ✓ (admin) | — | 1307 |
| `split` | แยกชิ้นจากใบแชร์ | table, example, callout | — | — | 1351 |
| `installment` | ผ่อนสินค้าด้วยบัตรเครดิต | h3, list, example, calculator | ✓ | — | 1416 |
| `cash-out` | รูดบัตรเปลี่ยนเป็นเงินสด | callout, example, calculator | ✓ | — | 1501 |
| `vat` | ภาษี VAT ทองรูปพรรณ 96.5% | h3, list, live-example, calculator | ✓ | — | 1544 |
| `aeon` | ผ่อน AEON ผ่าน Website i-Dealer | h3, p, **secret**, callout, image, steps, list | — | — | 1867 |

### เครื่องตรวจ % โลหะ
| id | title | blocks | live? | tone | line |
|---|---|---|---|---|---|
| `calibrate-machine` | เครื่องตรวจ % โลหะ — การ Calibrate | callout, image, steps, h3 | — | — | 1661 |
| `measure-machine` | เครื่องตรวจ % โลหะ — การตรวจ % | steps, h3, image | — | — | 1746 |
| `measure-machine-print` | เครื่องตรวจ % โลหะ — การพิมพ์ Report | steps, h3, image | — | — | 1807 |

## วิธีแก้/เพิ่มเนื้อหา

1. **แก้ข้อความ/สูตร/ตาราง:** หา section ด้วย `id`/`line` ในตารางบน → แก้ใน `index.ts` ตรงๆ
   (commit-driven · ไม่มี admin UI สำหรับเนื้อหา ยกเว้น 3 ตาราง admin-editable)
2. **เพิ่ม section ใหม่:** เพิ่ม object `{ id, title, Icon, blocks }` ลง array ใน `index.ts`
   - `Icon` = `lucide-react` เท่านั้น (ห้าม emoji เป็น icon)
   - `id` ต้องไม่ซ้ำ (ใช้ใน search/anchor)
3. **Tone (วัสดุ) — ต้อง tag ให้ตรง** (scope: เฉพาะ knowledge · ส่วนอื่นของระบบคง maroon):
   - ทอง (96.5%/99.99%) → ไม่ใส่ (default `maroon`)
   - เงิน → `tone="silver"` (h3 text-only: `silver-text`)
   - นาก → `tone="nak"` (h3 text-only: `nak-text`)
   - **เพิ่ม example/calculator/table ใน section เงิน/นาก = อย่าลืม tag tone** (อย่าทิ้ง default maroon)
4. **MathText (เครื่องหมายคำนวณ):** ทุกที่ที่มี `+ − × ÷ =` ต้อง wrap `<MathText>` (font-mono)
   - operator regex **ไม่จับ ASCII `-`** (กันชน "MD-03" / "0.05 ก. - 10 บ.") · ถ้าต้องลบใน formula ใช้ U+2212 `−`
   - `**bold**` ใน MathText → extrabold maroon
5. **Live block:** ถ้าเพิ่ม block ที่ต้องใช้ราคาสด → ผูก hook ใน component ของ block นั้น
   (`useGoldPrice` · `useLaborCost`/`useBlockCost`/`useLoyaltyPoints` สำหรับ admin-editable)

## ดูเพิ่ม

- [`ui-components.md`](ui-components.md) → "Knowledge view" — component tree + render detail
- [`business-rules.md`](business-rules.md) → "ราคาทอง/เงิน + สูตรในความรู้ต่างๆ" — สูตร + source chain ราคาทอง
- `CLAUDE.md` → "Knowledge" + "Metal tones" + "Typography กฎทอง" — convention เต็ม
