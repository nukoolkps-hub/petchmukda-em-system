/* ─── QuizPanel — แบบทดสอบความรู้พื้นฐาน (admin section) ──────────────
   router บางๆ 3 โหมด: รายการ → ทำข้อสอบ → ตรวจ

   **ชุดที่ทำค้างไว้จะถูกหยิบกลับมาต่อเสมอ** — ไม่สร้างชุดใหม่ทับ ไม่งั้น
   กดเริ่มซ้ำ/เผลอรีเฟรช = ได้เวลาใหม่ 100 นาทีฟรี · ชุดที่หมดเวลาแล้วแต่
   ยังไม่ได้ส่ง (ปิดแท็บหนีไป) ก็นับว่าจบ ไม่ให้ทำต่อ

   **ผู้สอบพิมพ์ชื่อเองก่อนเริ่ม** — ใช้จริงคือ ADMIN เปิดเครื่องให้พนักงานทำ
   `uid` จึงเป็นของ ADMIN ไม่ใช่ของคนทำ · ชื่อที่พิมพ์คือสิ่งที่โชว์ในประวัติ
   และหน้าตรวจ ส่วน `employeeId` มาจาก `resolveExamineeId` (จับคู่ตรงตัว ·
   ชนกันหลายคนคืนค่าว่าง ไม่เดา)                                          */

import {
  ClipboardCheck as IconClipboardCheck,
  Clock as IconClock,
  FileText as IconFileText,
  Play as IconPlay,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  isKnownQuizId,
  resolveActiveQuiz,
  resolveQuizSet,
} from "../../content/quiz";
import type { QuizSet } from "../../content/quiz/basicExam";
import { useAuth } from "../../contexts/AuthContext";
import { useGoldPrice } from "../../firebase/hooks/useFirestore";
import {
  startQuizAttempt,
  subscribeAllQuizAttempts,
} from "../../firebase/quizAttempts";
import {
  subscribeActiveQuizId,
  subscribeQuizSets,
} from "../../firebase/quizSets";
import type { Employee } from "../../types";
import { fmtThaiDateTime } from "../../utils/dateUtils";
import {
  isExpired,
  isInProgress,
  type QuizAttempt,
  resolveExamineeId,
  scoreAttempt,
} from "../../utils/quizAttempt";
import QuizReview from "./QuizReview";
import QuizRunner from "./QuizRunner";

interface Props {
  employeeDirectory?: Employee[];
  showToast?: (msg: string) => void;
}

export default function QuizPanel({ employeeDirectory, showToast }: Props) {
  const { user } = useAuth();
  // `DEFAULT_GOLD_PRICE` เป็นค่า placeholder (50,000) ไม่ใช่ราคาจริง —
  // ถ้าเผลอ snapshot ตอนยังโหลดไม่เสร็จ ข้อสอบทั้งใบจะอ้างอิงราคาปลอม
  // โดยไม่มีอะไรฟ้อง → กันไว้ที่ปุ่มเริ่ม (`priceReady`)
  const { data: gold, loading: goldLoading } = useGoldPrice();
  const priceReady =
    !goldLoading && gold.updatedAt > 0 && gold.pricePerBaht > 0;
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => subscribeAllQuizAttempts(setAttempts), []);

  // ชุดข้อสอบที่ admin แก้ผ่านหน้า "ตั้งค่าข้อสอบ" — ทับชุดที่ฝังมากับโค้ด
  // (ยังโหลดไม่มา/Firestore ล่ม → ใช้ชุดที่ฝังมา ไม่ใช่จอว่าง)
  const [remoteSets, setRemoteSets] = useState<Record<string, QuizSet>>({});
  const [activeQuizId, setActiveQuizId] = useState("");
  useEffect(
    () =>
      subscribeQuizSets((list) =>
        setRemoteSets(
          Object.fromEntries(
            list
              .filter((q) => q.status === "published")
              .map((q) => [q.id, q as QuizSet]),
          ),
        ),
      ),
    [],
  );
  useEffect(() => subscribeActiveQuizId(setActiveQuizId), []);

  /** ชุดที่จะใช้เมื่อกดเริ่มสอบตอนนี้ */
  const currentQuiz = useMemo(
    () => resolveActiveQuiz(remoteSets, activeQuizId),
    [remoteSets, activeQuizId],
  );
  /** ชุดของใบนั้นๆ — ใบเก่าต้องอ่านชุดของตัวเอง ไม่ใช่ชุดที่ใช้อยู่ตอนนี้ */
  const quizOf = useMemo(
    () => (quizId: string) => resolveQuizSet(quizId, remoteSets, activeQuizId),
    [remoteSets, activeQuizId],
  );

  const uid = user?.uid ?? "";
  const me = useMemo(
    () => (employeeDirectory ?? []).find((e) => e.lineUserId === uid) ?? null,
    [employeeDirectory, uid],
  );
  const myName = me?.nickname || me?.name || user?.displayName || "ADMIN";

  // ชื่อผู้สอบ — **เริ่มว่างเสมอ ไม่เติมชื่อคนที่ login ให้**
  // เครื่องเดียวใช้สอบหลายคน (ADMIN เปิดให้พนักงานทำ) ถ้าเติมชื่อไว้ให้
  // คนกดเริ่มโดยไม่ทันแก้ = ผลสอบไปติดชื่อผิดคน ซึ่งเงียบสนิทจนถึงตอนตรวจ
  const [examineeName, setExamineeName] = useState("");
  const trimmedName = examineeName.trim();

  // ชุดของเราที่ยังทำอยู่จริง (ยังไม่ส่ง · ยังไม่ยกเลิก · ยังไม่หมดเวลา)
  const inProgress = useMemo(
    () =>
      attempts.find((a) => a.uid === uid && isInProgress(a, Date.now())) ??
      null,
    [attempts, uid],
  );

  const running = attempts.find((a) => a.id === runningId) ?? null;
  const reviewing = attempts.find((a) => a.id === reviewId) ?? null;

  async function handleStart() {
    if (starting) return;
    // มีชุดค้างอยู่ → ทำต่อ ไม่สร้างใหม่ (กันกดเริ่มซ้ำได้เวลาเพิ่ม)
    if (inProgress) {
      setRunningId(inProgress.id);
      return;
    }
    setStarting(true);
    try {
      const id = await startQuizAttempt(
        currentQuiz,
        uid,
        resolveExamineeId(trimmedName, employeeDirectory ?? []),
        trimmedName,
        // ตรึงราคาไว้ตรงนี้ — ตรวจย้อนหลังต้องคิดจากราคา "วันที่สอบ"
        {
          goldSellPerBaht: gold.pricePerBaht,
          goldBuyPerBaht: gold.buyPrice,
          silverSellPerGram: gold.silverSellPerGram,
          silverBuyPerGram: gold.silverBuyPerGram,
          changeRates: gold.changeRates ?? {},
          changeRatesForPrice: gold.changeRatesForPrice,
          capturedAt: Date.now(),
          priceUpdatedAt: gold.updatedAt,
        },
      );
      setRunningId(id);
    } catch (err) {
      showToast?.(
        err instanceof Error ? `เริ่มไม่สำเร็จ: ${err.message}` : "เริ่มไม่สำเร็จ",
      );
    } finally {
      setStarting(false);
    }
  }

  if (running) {
    return (
      <QuizRunner
        // ชุดที่ใบนี้เริ่มไว้ ไม่ใช่ชุดปัจจุบัน — ถ้ามีการออกชุดใหม่ระหว่างที่
        // ใครทำค้างอยู่ โจทย์ต้องไม่เปลี่ยนกลางคัน
        quiz={quizOf(running.quizId)}
        attempt={running}
        onFinished={() => {
          setRunningId(null);
          setReviewId(running.id);
        }}
        showToast={showToast}
      />
    );
  }

  if (reviewing) {
    return (
      <QuizReview
        quiz={quizOf(reviewing.quizId)}
        quizKnown={isKnownQuizId(reviewing.quizId, remoteSets)}
        attempt={reviewing}
        gradedBy={myName}
        onBack={() => setReviewId(null)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="font-sans">
      {/* ── กติกา + ปุ่มเริ่ม ── */}
      <div className="rounded-[12px] border-[1.5px] border-[#C9973A50] bg-gold-pale/60 p-3.5 mb-4">
        <div className="text-base font-extrabold text-maroon mb-2 flex items-center gap-1.5">
          <IconClipboardCheck size={18} strokeWidth={2.4} />
          {currentQuiz.title}
        </div>
        <ul className="mb-3 space-y-1">
          {currentQuiz.rules.map((rule) => (
            <li
              key={rule}
              className="text-xs text-txt-mid leading-relaxed flex items-start gap-1.5"
            >
              <span className="shrink-0 mt-[7px] w-1 h-1 rounded-full bg-maroon" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        {inProgress ? (
          <div className="mb-3 px-3 py-2.5 rounded-[8px] bg-amber-lt/70 border border-amber/40 text-xs text-txt font-semibold flex items-start gap-1.5">
            <IconClock
              size={14}
              strokeWidth={2.4}
              className="text-amber shrink-0 mt-0.5"
            />
            <span>
              มีชุดของ <b>{inProgress.employeeName || "(ไม่ทราบชื่อ)"}</b> ทำค้างไว้ —
              กดเพื่อทำต่อ (เวลาเดินต่อจากเดิม ไม่ได้เริ่มใหม่) · ถ้าจะให้คนอื่นทำ ต้องส่งชุดนี้ก่อน
            </span>
          </div>
        ) : (
          /* ชื่อที่พิมพ์ตรงนี้คือชื่อที่จะโชว์ในประวัติ + หน้าตรวจ
             ต้องกรอกก่อนถึงจะกดเริ่มได้ — ไม่งั้นได้ใบที่ไม่รู้ว่าของใคร */
          <label className="block mb-3">
            <span className="block text-xs font-bold text-txt mb-1.5">
              ชื่อผู้ทำข้อสอบ
            </span>
            <input
              type="text"
              value={examineeName}
              onChange={(e) => setExamineeName(e.target.value)}
              placeholder="พิมพ์ชื่อ-ชื่อเล่นของผู้ทำข้อสอบ"
              className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-white text-sm text-txt font-[inherit] outline-none focus:border-maroon transition-colors"
            />
          </label>
        )}

        {!inProgress && !priceReady && (
          <div className="mb-2.5 px-3 py-2 rounded-[8px] bg-[#FDECEA] border border-[#C0392B50] text-xs text-red font-semibold">
            ยังโหลดราคาทองไม่สำเร็จ — เริ่มสอบตอนนี้ไม่ได้ เพราะทุกข้อต้องอ้างอิงราคา ณ วันที่สอบ
            (ถ้าค้างนาน เช็กหน้า "ความรู้ต่างๆ" ว่าราคาขึ้นไหม)
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={
            starting || !uid || (!inProgress && (!trimmedName || !priceReady))
          }
          className="w-full py-3 rounded-[12px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
        >
          <IconPlay size={16} strokeWidth={2.6} />
          {starting ? "กำลังเริ่ม…" : inProgress ? "ทำข้อสอบต่อ" : "เริ่มทำข้อสอบ"}
        </button>
      </div>

      {/* ── ประวัติการทำข้อสอบ ── */}
      <div className="text-sm font-extrabold text-maroon mb-2 flex items-center gap-1.5">
        <IconFileText size={16} strokeWidth={2.4} />
        ประวัติการทำข้อสอบ
      </div>

      {attempts.length === 0 ? (
        <div className="text-center text-xs text-txt-soft py-6 px-4 bg-cream/60 rounded-[10px] border border-dashed border-bdr">
          ยังไม่มีใครทำข้อสอบ
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {attempts.map((a) => {
            // ตรวจ/คิด % ด้วยชุดของใบนั้นเอง — ออกชุดใหม่แล้วใบเก่าต้องไม่
            // กลายเป็น "ตรวจไม่ครบ" เพราะจำนวนข้อเปลี่ยน
            const score = scoreAttempt(a, quizOf(a.quizId));
            const cancelled = !!a.cancelledAt;
            const done = !cancelled && !isInProgress(a, Date.now());
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setReviewId(a.id)}
                className="text-left rounded-[10px] border border-bdr bg-white p-3 cursor-pointer hover:border-maroon/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-txt">
                    {a.employeeName || "(ไม่ทราบชื่อ)"}
                  </span>
                  {cancelled ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-cream-dk text-txt-soft font-bold">
                      ยกเลิกแล้ว
                    </span>
                  ) : !done ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-lt text-amber font-bold">
                      กำลังทำ
                    </span>
                  ) : score.passed === null ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-cream-dk text-txt-soft font-bold">
                      รอตรวจ
                    </span>
                  ) : (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-lg font-bold ${
                        score.passed
                          ? "bg-green-lt/70 text-green"
                          : "bg-[#FDECEA] text-red"
                      }`}
                    >
                      {score.percent}% · {score.passed ? "ผ่าน" : "ไม่ผ่าน"}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-txt-soft mt-0.5">
                  {fmtThaiDateTime(a.startedAt)}
                  {a.autoSubmitted && " · หมดเวลา"}
                  {!a.submittedAt && !cancelled && isExpired(a, Date.now())
                    ? " · หมดเวลา (ไม่ได้ส่ง)"
                    : ""}
                  {done && score.graded > 0 && score.passed === null
                    ? ` · ตรวจไป ${score.graded}/${score.total}`
                    : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
