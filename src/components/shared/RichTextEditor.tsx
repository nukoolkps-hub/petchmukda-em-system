/* ─── RichTextEditor — toolbar + contentEditable เล็กๆ ───────────────
   มินิ rich text editor สำหรับฟิลด์ที่ admin พิมพ์เนื้อหาให้พนักงานอ่าน
   (เช่น "หน้าที่หลัก" ของตำแหน่ง) · รองรับ:
     • ขนาดตัวอักษร (เล็ก/ปกติ/ใหญ่)
     • ตัวหนา (Bold)
     • รายการ (• bullet list)
     • ย่อหน้าเข้า/ออก (indent / outdent)
   เก็บค่าเป็น HTML string · sanitize ตอน render ในฝั่งผู้อ่าน        */

import {
  Bold as IconBold,
  IndentIncrease as IconIndent,
  List as IconList,
  IndentDecrease as IconOutdent,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClass?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeightClass = "min-h-[110px]",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // sync external value → DOM เฉพาะเมื่อต่างจริงๆ — กัน cursor reset
  // ระหว่างพิมพ์ (เพราะ onInput → onChange → parent setState → re-render)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    const el = ref.current;
    if (el) onChange(el.innerHTML);
    el?.focus();
  }

  /** bullet button: insertUnorderedList แล้วติด class rt-bullet บน
   *  ul ที่เพิ่งสร้าง — CSS ใช้ class นี้แยก "bullet ที่ตั้งใจใส่"
   *  (โชว์จุด) ออกจาก ul ที่ contentEditable สร้างเองตอน indent
   *  (ไม่โชว์จุด) */
  function execBullet() {
    document.execCommand("insertUnorderedList");
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode || null;
    while (node && node !== ref.current) {
      if (node.nodeType === 1) {
        const tag = (node as Element).tagName;
        if (tag === "UL" || tag === "OL") {
          (node as Element).classList.add("rt-bullet");
          break;
        }
      }
      node = node.parentNode;
    }
    const el = ref.current;
    if (el) onChange(el.innerHTML);
    el?.focus();
  }

  return (
    <div className="rounded-[9px] border border-bdr bg-white overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-1 px-1.5 py-1.5 border-b border-bdr bg-cream/60 flex-wrap">
        <div className="flex items-center rounded-md overflow-hidden border border-bdr">
          <ToolbarButton onClick={() => exec("fontSize", "2")} label="เล็ก">
            <span className="text-[11px] font-semibold">A</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("fontSize", "3")} label="ปกติ">
            <span className="text-[13px] font-semibold">A</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("fontSize", "5")} label="ใหญ่">
            <span className="text-[16px] font-semibold">A</span>
          </ToolbarButton>
        </div>
        <ToolbarButton onClick={() => exec("bold")} label="ตัวหนา">
          <IconBold size={14} strokeWidth={2.4} />
        </ToolbarButton>
        <ToolbarButton onClick={execBullet} label="รายการ">
          <IconList size={14} strokeWidth={2.4} />
        </ToolbarButton>
        <div className="flex items-center rounded-md overflow-hidden border border-bdr">
          <ToolbarButton onClick={() => exec("outdent")} label="ลดย่อหน้า">
            <IconOutdent size={14} strokeWidth={2.4} />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("indent")} label="เพิ่มย่อหน้า">
            <IconIndent size={14} strokeWidth={2.4} />
          </ToolbarButton>
        </div>
      </div>

      {/* editor surface */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        className={`rich-text rich-text-editor px-3 py-2 text-sm outline-none font-[inherit] text-txt ${minHeightClass}`}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // ใช้ onMouseDown + preventDefault — กัน focus หลุดจาก contentEditable
      // (ถ้าหลุด selection หายและ execCommand จะใส่ที่อื่นแทน)
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={label}
      className="w-7 h-7 inline-flex items-center justify-center text-txt-mid hover:bg-cream cursor-pointer transition-colors"
    >
      {children}
    </button>
  );
}
