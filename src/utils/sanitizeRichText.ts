/* ─── HTML sanitizer (whitelist) — สำหรับ rich text content ที่ admin
   พิมพ์ใน RolesAdminPanel · ปลอดภัยต่อ XSS แม้ภายหลัง admin (หรือ DB
   write โดยตรง) ใส่ tag/attribute แปลกๆ                                     */

const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "P",
  "BR",
  "DIV",
  "SPAN",
  "UL",
  "OL",
  "LI",
  "FONT", // execCommand("fontSize") สร้าง <font size="N">
  "BLOCKQUOTE", // execCommand("indent") นอก list สร้าง <blockquote>
]);

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  FONT: new Set(["size"]),
};

function cleanElement(el: Element) {
  const tag = el.tagName;
  const allowedAttrs = ALLOWED_ATTRS_BY_TAG[tag] || new Set<string>();
  for (const attr of Array.from(el.attributes)) {
    if (!allowedAttrs.has(attr.name)) el.removeAttribute(attr.name);
  }
}

function walk(node: Node) {
  const toRemove: Node[] = [];
  const toUnwrap: Element[] = [];
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      toRemove.push(child);
      continue;
    }
    const el = child as Element;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      toUnwrap.push(el);
      continue;
    }
    cleanElement(el);
    walk(el);
  }
  for (const n of toRemove) n.parentNode?.removeChild(n);
  for (const el of toUnwrap) {
    walk(el);
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }
}

/** ลบ tag/attribute ที่ไม่อยู่ใน whitelist · ใช้ผ่าน DOMParser ใน
 *  client เท่านั้น (ฝั่ง render บน browser) */
export function sanitizeRichText(html: string): string {
  if (!html || typeof document === "undefined") return html || "";
  const tmpl = document.createElement("template");
  tmpl.innerHTML = html;
  walk(tmpl.content);
  return tmpl.innerHTML;
}

/** เช็คคร่าวๆ ว่า value เป็น HTML หรือ plain text — ใช้ตัดสินว่าจะ
 *  render ผ่าน dangerouslySetInnerHTML หรือใช้ whitespace-pre-wrap */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** ดึงเฉพาะ text จริง (ตัด tag ทิ้ง) — ใช้เช็คว่า rich text "ว่างจริง"
 *  หรือไม่ (contentEditable เคลียร์แล้วมักเหลือ <br>/<div><br></div>) */
export function richTextToPlainText(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const tmpl = document.createElement("template");
  tmpl.innerHTML = html;
  return tmpl.content.textContent || "";
}

/** rich text ที่ไม่มี text จริง (มีแต่ tag ว่าง / ช่องว่าง / &nbsp;)
 *  → ถือว่า "ว่าง" · ใช้ทั้งฝั่ง save (เก็บเป็น null) และฝั่ง render */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  return richTextToPlainText(html || "").trim() === "";
}
