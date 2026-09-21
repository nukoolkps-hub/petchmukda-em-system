/* ─── ตั้งค่าข้อสอบ — admin แก้โจทย์/เวลา/เกณฑ์เองได้ ──────────────────
   ร่าง → เผยแพร่ → ล็อกถาวร · ดู `src/firebase/quizSets.ts` ว่าทำไม

   **ชุดที่เผยแพร่แล้วแก้ไม่ได้** ทั้งใน UI และ `firestore.rules` — ใบที่สอบ
   ไปแล้วอ้าง `attempt.quizId` มาที่ชุดนี้ ถ้ายังแก้ได้ ผลสอบเก่าจะเปลี่ยน
   ย้อนหลังแบบเงียบๆ · จะแก้ให้กด "ทำสำเนาเป็นชุดใหม่"                     */

import {
  ArrowDown as IconArrowDown,
  ArrowUp as IconArrowUp,
  CheckCircle2 as IconCheckCircle,
  ClipboardCheck as IconClipboardCheck,
  Copy as IconCopy,
  Lock as IconLock,
  Plus as IconPlus,
  Save as IconSave,
  Send as IconSend,
  Trash2 as IconTrash,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BUILT_IN_QUIZ } from "../../content/quiz";
import type { QuizQuestion, QuizSet } from "../../content/quiz/basicExam";
import { useAuth } from "../../contexts/AuthContext";
import {
  createQuizDraft,
  deleteQuizDraft,
  publishQuizSet,
  saveQuizDraft,
  setActiveQuizId,
  subscribeActiveQuizId,
  subscribeQuizSets,
} from "../../firebase/quizSets";
import { fmtThaiDateTime } from "../../utils/dateUtils";
import {
  duplicateAsDraft,
  type EditableQuizSet,
  makeQuizSetId,
  moveQuestion,
  nextQuestionId,
  nextQuizTitle,
  validateQuizSet,
} from "../../utils/quizSetEdit";

interface Props {
  showToast?: (msg: string) => void;
}

type Draft = Pick<
  QuizSet,
  | "id"
  | "title"
  | "durationMinutes"
  | "passPercent"
  | "rules"
  | "main"
  | "general"
>;

export default function QuizSettingsPanel({ showToast }: Props) {
  const { user } = useAuth();
  const [sets, setSets] = useState<EditableQuizSet[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => subscribeQuizSets(setSets), []);
  useEffect(() => subscribeActiveQuizId(setActiveId), []);

  const who = user?.displayName || user?.uid || "admin";
  const problems = useMemo(
    () => (draft ? validateQuizSet(draft) : []),
    [draft],
  );

  function openDraft(set: EditableQuizSet) {
    setEditingId(set.id);
    setDraft({
      id: set.id,
      title: set.title,
      durationMinutes: set.durationMinutes,
      passPercent: set.passPercent,
      rules: [...set.rules],
      main: set.main.map((q) => ({ ...q })),
      general: set.general.map((q) => ({ ...q })),
    });
  }

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      showToast?.(label);
    } catch (err) {
      showToast?.(err instanceof Error ? `ไม่สำเร็จ: ${err.message}` : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  /** ทำสำเนาเป็นร่างใหม่ — ใช้ทั้งกับชุดที่เผยแพร่แล้วและชุดที่ฝังมากับโค้ด
   *
   *  ชื่อใหม่เป็น `ชื่อฐาน v<ถัดไป>` ไม่ใช่ต่อท้าย "(สำเนา)" ไปเรื่อยๆ
   *  (ทำสำเนาจากสำเนาแล้วชื่อจะยาวขึ้นทุกครั้งจนอ่านไม่ออก) */
  async function duplicate(source: QuizSet) {
    const now = Date.now();
    const title = nextQuizTitle(
      source.title,
      sets.map((s) => s.title),
    );
    const copy = duplicateAsDraft(source, makeQuizSetId(title, now), title);
    await run("สร้างร่างใหม่แล้ว", async () => {
      await createQuizDraft(copy, who);
      openDraft({
        ...copy,
        status: "draft",
        createdAt: now,
        createdBy: who,
      });
    });
  }

  function patch(next: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...next } : d));
  }

  function editQuestion(group: "main" | "general", idx: number, text: string) {
    setDraft((d) => {
      if (!d) return d;
      const items = [...d[group]];
      items[idx] = { ...items[idx], text };
      return { ...d, [group]: items };
    });
  }

  function addQuestion(group: "main" | "general") {
    setDraft((d) => {
      if (!d) return d;
      const prefix = group === "main" ? "m" : "g";
      // ไล่ id จากเลขสูงสุดที่เคยใช้ ไม่ใช่จำนวนข้อ (ดู nextQuestionId)
      const id = nextQuestionId(d[group], prefix);
      return { ...d, [group]: [...d[group], { id, text: "" }] };
    });
  }

  function removeQuestion(group: "main" | "general", idx: number) {
    setDraft((d) =>
      d ? { ...d, [group]: d[group].filter((_, i) => i !== idx) } : d,
    );
  }

  function shift(group: "main" | "general", idx: number, by: number) {
    setDraft((d) =>
      d ? { ...d, [group]: moveQuestion(d[group], idx, idx + by) } : d,
    );
  }

  /* ══════════ โหมดแก้ร่าง ══════════ */
  if (draft && editingId) {
    const editing = sets.find((s) => s.id === editingId);
    return (
      <div className="font-sans">
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setEditingId(null);
          }}
          className="mb-3 text-sm font-bold text-maroon font-[inherit] cursor-pointer"
        >
          ← กลับไปรายการชุดข้อสอบ
        </button>

        <div className="rounded-[12px] border border-bdr bg-white p-3.5 mb-3">
          <label className="block mb-3">
            <span className="block text-sm font-bold text-txt mb-1.5">
              ชื่อชุดข้อสอบ
            </span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-cream/40 text-base text-txt font-[inherit] outline-none focus:border-maroon"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-sm font-bold text-txt mb-1.5">
                เวลาทำข้อสอบ (นาที)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.durationMinutes || ""}
                onChange={(e) =>
                  patch({ durationMinutes: Number(e.target.value) || 0 })
                }
                className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-cream/40 text-base text-txt font-[inherit] outline-none focus:border-maroon"
              />
            </label>
            <label className="flex-1">
              <span className="block text-sm font-bold text-txt mb-1.5">
                เกณฑ์ผ่าน (%)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.passPercent || ""}
                onChange={(e) =>
                  patch({ passPercent: Number(e.target.value) || 0 })
                }
                className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-cream/40 text-base text-txt font-[inherit] outline-none focus:border-maroon"
              />
            </label>
          </div>

          <div className="text-xs text-txt-soft mt-2">
            เกณฑ์ผ่านนับจาก <b>ข้อสอบหลัก</b> เท่านั้น · ความรู้รอบตัวให้ตอบแต่ไม่นับ
          </div>
        </div>

        {/* ── กติกาที่โชว์ก่อนเริ่มสอบ ── */}
        <div className="rounded-[12px] border border-bdr bg-white p-3.5 mb-3">
          <div className="text-sm font-bold text-txt mb-1.5">
            กติกาที่โชว์ก่อนเริ่มสอบ (บรรทัดละข้อ)
          </div>
          <textarea
            value={draft.rules.join("\n")}
            onChange={(e) =>
              patch({
                rules: e.target.value.split("\n").filter((r) => r.trim()),
              })
            }
            rows={5}
            className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-cream/40 text-sm text-txt font-[inherit] outline-none focus:border-maroon resize-y"
          />
        </div>

        {(["main", "general"] as const).map((group) => (
          <div key={group} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-extrabold text-maroon">
                {group === "main"
                  ? `ข้อสอบหลัก (${draft.main.length} ข้อ · นับคะแนน)`
                  : `ความรู้รอบตัว (${draft.general.length} ข้อ · ไม่นับ)`}
              </div>
              <button
                type="button"
                onClick={() => addQuestion(group)}
                className="px-3 py-1.5 rounded-[8px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer inline-flex items-center gap-1"
              >
                <IconPlus size={15} strokeWidth={2.6} />
                เพิ่มข้อ
              </button>
            </div>

            {draft[group].map((q, i) => (
              <div
                key={q.id}
                className="rounded-[10px] border border-bdr bg-white p-3 mb-2"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-maroon text-white text-xs font-extrabold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-xs text-txt-soft font-[Prompt,monospace]">
                    {q.id}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => shift(group, i, -1)}
                      disabled={i === 0}
                      className="p-1.5 rounded-[7px] border border-bdr bg-white cursor-pointer disabled:opacity-30"
                    >
                      <IconArrowUp size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => shift(group, i, 1)}
                      disabled={i === draft[group].length - 1}
                      className="p-1.5 rounded-[7px] border border-bdr bg-white cursor-pointer disabled:opacity-30"
                    >
                      <IconArrowDown size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(group, i)}
                      className="p-1.5 rounded-[7px] border border-bdr bg-white text-red cursor-pointer"
                    >
                      <IconTrash size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
                <textarea
                  value={q.text}
                  onChange={(e) => editQuestion(group, i, e.target.value)}
                  rows={3}
                  placeholder="พิมพ์โจทย์"
                  className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-cream/40 text-base text-txt leading-relaxed font-[inherit] outline-none focus:border-maroon resize-y"
                />
              </div>
            ))}
          </div>
        ))}

        {problems.length > 0 && (
          <div className="rounded-[10px] bg-[#FDECEA] border border-[#C0392B50] p-3 mb-3">
            <div className="text-sm font-bold text-red mb-1">
              ต้องแก้ก่อนเผยแพร่
            </div>
            <ul className="text-sm text-txt-mid space-y-0.5">
              {problems.map((p) => (
                <li key={`${p.field}-${p.message}`}>• {p.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void run("บันทึกร่างแล้ว", () => saveQuizDraft(draft))}
            disabled={busy}
            className="flex-1 py-3 rounded-[10px] border border-bdr bg-white text-base font-bold text-txt font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
          >
            <IconSave size={17} strokeWidth={2.4} />
            บันทึกร่าง
          </button>
          <button
            type="button"
            onClick={() =>
              void run("เผยแพร่แล้ว — ชุดนี้ใช้สอบได้ทันที", async () => {
                await saveQuizDraft(draft);
                await publishQuizSet(draft.id, who);
                setDraft(null);
                setEditingId(null);
              })
            }
            disabled={busy || problems.length > 0 || !editing}
            className="flex-1 py-3 rounded-[10px] bg-maroon text-white text-base font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
          >
            <IconSend size={17} strokeWidth={2.4} />
            เผยแพร่ + ใช้งาน
          </button>
        </div>
        <div className="text-xs text-txt-soft mt-2 text-center">
          เผยแพร่แล้ว<b>แก้ไม่ได้อีก</b> — ใบที่สอบด้วยชุดนี้ต้องอ่านโจทย์เดิมได้ตลอดไป
        </div>
      </div>
    );
  }

  /* ══════════ โหมดรายการ ══════════ */
  const published = sets.filter((s) => s.status === "published");
  const drafts = sets.filter((s) => s.status === "draft");
  const activeSet = sets.find((s) => s.id === activeId);

  return (
    <div className="font-sans">
      <div className="rounded-[12px] border-[1.5px] border-[#C9973A50] bg-gold-pale/60 p-3.5 mb-4">
        <div className="text-lg font-extrabold text-maroon mb-1.5 flex items-center gap-1.5">
          <IconClipboardCheck size={20} strokeWidth={2.4} />
          ตั้งค่าข้อสอบ
        </div>
        <p className="text-sm text-txt-mid leading-relaxed">
          แก้ร่างได้อิสระ · <b>เผยแพร่แล้วล็อกถาวร</b> เพราะใบที่สอบด้วยชุดนั้นต้อง
          อ่านโจทย์และเกณฑ์เดิมได้ตลอดไป — จะแก้ให้กด "ทำสำเนาเป็นชุดใหม่"
        </p>
        <div className="mt-2.5 text-sm text-txt">
          ใช้สอบอยู่ตอนนี้:{" "}
          <b className="text-maroon">
            {activeSet?.title ?? `${BUILT_IN_QUIZ.title} (ชุดตั้งต้นในระบบ)`}
          </b>
        </div>
      </div>

      {/* ── ร่าง ── */}
      {drafts.length > 0 && (
        <>
          <div className="text-base font-extrabold text-maroon mb-2">
            ร่าง ({drafts.length})
          </div>
          {drafts.map((s) => (
            <div
              key={s.id}
              className="rounded-[10px] border border-amber/40 bg-amber-lt/30 p-3 mb-2"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-base font-bold text-txt">{s.title}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-lt text-amber font-bold">
                  ร่าง
                </span>
              </div>
              <div className="text-sm text-txt-soft mb-2.5">
                {s.main.length} ข้อหลัก · {s.general.length} ความรู้รอบตัว ·{" "}
                {s.durationMinutes} นาที · เกณฑ์ {s.passPercent}%
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openDraft(s)}
                  className="flex-1 py-2 rounded-[8px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer"
                >
                  แก้ไขร่าง
                </button>
                {confirmDelete === s.id ? (
                  <button
                    type="button"
                    onClick={() =>
                      void run("ลบร่างแล้ว", async () => {
                        await deleteQuizDraft(s.id);
                        setConfirmDelete(null);
                      })
                    }
                    className="px-3 py-2 rounded-[8px] bg-red text-white text-sm font-bold font-[inherit] cursor-pointer"
                  >
                    ยืนยันลบ
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(s.id)}
                    className="px-3 py-2 rounded-[8px] border border-bdr bg-white text-sm font-bold text-red font-[inherit] cursor-pointer"
                  >
                    ลบ
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── เผยแพร่แล้ว ── */}
      <div className="text-base font-extrabold text-maroon mb-2 mt-4">
        เผยแพร่แล้ว ({published.length})
      </div>

      {published.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-bdr bg-cream/60 p-3.5 mb-2">
          <div className="text-sm text-txt-mid leading-relaxed mb-2.5">
            ยังไม่มีชุดใน Firestore — ตอนนี้ใช้ชุดตั้งต้นที่ฝังมากับระบบ (
            <b>{BUILT_IN_QUIZ.title}</b> · {BUILT_IN_QUIZ.main.length} ข้อหลัก)
          </div>
          <button
            type="button"
            onClick={() => void duplicate(BUILT_IN_QUIZ)}
            disabled={busy}
            className="w-full py-2.5 rounded-[9px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
          >
            <IconCopy size={16} strokeWidth={2.4} />
            คัดลอกชุดตั้งต้นมาเป็นร่างเพื่อแก้
          </button>
        </div>
      )}

      {published.map((s) => (
        <div
          key={s.id}
          className={`rounded-[10px] border bg-white p-3 mb-2 ${
            s.id === activeId ? "border-maroon" : "border-bdr"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-base font-bold text-txt">{s.title}</span>
            {s.id === activeId ? (
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-green-lt/70 text-green font-bold inline-flex items-center gap-1">
                <IconCheckCircle size={12} strokeWidth={2.6} />
                ใช้สอบอยู่
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-cream-dk text-txt-soft font-bold inline-flex items-center gap-1">
                <IconLock size={12} strokeWidth={2.6} />
                เก่า
              </span>
            )}
          </div>
          <div className="text-sm text-txt-soft mb-2.5">
            {s.main.length} ข้อหลัก · {s.general.length} ความรู้รอบตัว ·{" "}
            {s.durationMinutes} นาที · เกณฑ์ {s.passPercent}%
            {s.publishedAt ? ` · เผยแพร่ ${fmtThaiDateTime(s.publishedAt)}` : ""}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void duplicate(s)}
              disabled={busy}
              className="flex-1 py-2 rounded-[8px] border border-bdr bg-white text-sm font-bold text-txt font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              <IconCopy size={15} strokeWidth={2.4} />
              ทำสำเนาเป็นชุดใหม่
            </button>
            {s.id !== activeId && (
              <button
                type="button"
                onClick={() =>
                  void run("เปลี่ยนชุดที่ใช้สอบแล้ว", () => setActiveQuizId(s.id, who))
                }
                disabled={busy}
                className="px-3 py-2 rounded-[8px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60"
              >
                ใช้ชุดนี้
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
