/* ─── เอกสารอ้างอิงที่ส่งให้ AI ตรวจข้อสอบ ─────────────────────────────
   พังเงียบ: ถ้าราคาที่ตรึงไว้หลุดออกจากเอกสาร AI จะไปคิดจากราคาที่มันเดาเอง
   แล้วเสนอ "ไม่ผ่าน" ให้คำตอบที่ถูก — ดูจากหน้าจอไม่ออกเลยว่าเพราะอะไร

   invariant:
   1. ราคาที่ตรึงไว้ต้องอยู่ในเอกสารเสมอ และอยู่ก่อนเนื้อหาอื่น
   2. กฎจาก "ความรู้ต่างๆ" ต้องถูกแปลงเป็นข้อความได้ (ไม่ใช่ว่างเปล่า)
   3. ตัดความยาวต้องตัดที่ขอบ section ไม่ตัดกลางตาราง                     */

import { BookOpen } from "lucide-react";
import { describe, expect, it } from "vitest";
import { KNOWLEDGE_SECTIONS } from "../content/knowledge";
import type { KnowledgeSection } from "../content/knowledge/types";
import type { QuizPriceSnapshot } from "./quizAttempt";
import {
  buildGradingReference,
  formatPriceSnapshot,
  sectionToText,
} from "./quizGradingReference";

const SNAP: QuizPriceSnapshot = {
  goldSellPerBaht: 51_300,
  goldBuyPerBaht: 50_200,
  silverSellPerGram: 38,
  silverBuyPerGram: 33,
  changeRates: { "1-baht": 1200, "2-saleung": 700 },
  changeRatesForPrice: 51_300,
  capturedAt: Date.parse("2026-09-21T09:00:00+07:00"),
  priceUpdatedAt: Date.parse("2026-09-21T08:45:00+07:00"),
};

const section = (
  id: string,
  blocks: KnowledgeSection["blocks"],
): KnowledgeSection => ({ id, title: id, Icon: BookOpen, blocks });

describe("formatPriceSnapshot", () => {
  it("มีราคาทองขาย/รับซื้อเสมอ", () => {
    const out = formatPriceSnapshot(SNAP);
    expect(out).toContain("51,300");
    expect(out).toContain("50,200");
  });

  it("ค่าเปลี่ยนจากจอราคาร้านติดไปด้วย (โจทย์หลายข้อใช้)", () => {
    const out = formatPriceSnapshot(SNAP);
    expect(out).toContain("1-baht");
    expect(out).toContain("1,200");
  });

  it("ไม่มีราคาเงิน = ไม่ต้องโชว์บรรทัดเงิน (อย่าบอก AI ว่าเงินราคา 0)", () => {
    const out = formatPriceSnapshot({
      ...SNAP,
      silverSellPerGram: 0,
      silverBuyPerGram: 0,
    });
    expect(out).not.toContain("ราคาเงิน");
  });
});

describe("sectionToText", () => {
  it("แปลง table เป็นข้อความครบทั้งหัวและแถว", () => {
    const out = sectionToText(
      section("t", [
        {
          type: "table",
          columns: ["น้ำหนัก", "ค่าแรง"],
          rows: [["1 สลึง", "400"]],
        },
      ]),
    );
    expect(out).toContain("น้ำหนัก");
    expect(out).toContain("1 สลึง");
    expect(out).toContain("400");
  });

  it("แปลง list / formula / callout ได้", () => {
    const out = sectionToText(
      section("m", [
        { type: "list", items: ["ดอกเบี้ย 1.5% ต่อเดือน"] },
        { type: "formula", formula: "ราคา = นน. × ราคาทอง" },
        { type: "callout", tone: "warn", text: "ขั้นต่ำ 30 บาท" },
      ]),
    );
    expect(out).toContain("ดอกเบี้ย 1.5% ต่อเดือน");
    expect(out).toContain("ราคา = นน. × ราคาทอง");
    expect(out).toContain("ขั้นต่ำ 30 บาท");
  });

  it("section ที่มีแต่ block ที่แปลงไม่ได้ → ว่าง (ไม่ส่งหัวข้อเปล่าไปกิน token)", () => {
    const out = sectionToText(
      section("empty", [
        { type: "image", src: "a.png", alt: "a" },
        { type: "change-price-table" },
      ]),
    );
    expect(out).toBe("");
  });

  it("ไม่ส่ง secret (PIN/รหัสภายใน) ออกไปกับ prompt", () => {
    const out = sectionToText(
      section("s", [
        { type: "secret", label: "รหัสตู้เซฟ", value: "999111" },
        { type: "p", text: "ข้อความปกติ" },
      ]),
    );
    expect(out).toContain("ข้อความปกติ");
    expect(out).not.toContain("999111");
  });
});

describe("buildGradingReference", () => {
  it("ราคาที่ตรึงไว้ต้องมาก่อนเนื้อหากฎ", () => {
    const out = buildGradingReference(
      [section("a", [{ type: "p", text: "กฎข้อหนึ่ง" }])],
      SNAP,
    );
    expect(out.indexOf("51,300")).toBeLessThan(out.indexOf("กฎข้อหนึ่ง"));
  });

  it("ไม่มี snapshot (ชุดเก่า) ก็ยังสร้างเอกสารได้ แต่ไม่มีท่อนราคา", () => {
    const out = buildGradingReference(
      [section("a", [{ type: "p", text: "กฎข้อหนึ่ง" }])],
      null,
    );
    expect(out).toContain("กฎข้อหนึ่ง");
    expect(out).not.toContain("ณ วันที่ทำข้อสอบ");
  });

  it("เนื้อหาจริงจาก 'ความรู้ต่างๆ' แปลงแล้วได้กฎที่ข้อสอบต้องใช้", () => {
    const out = buildGradingReference(KNOWLEDGE_SECTIONS, SNAP);
    expect(out.length).toBeGreaterThan(2000);
    // โจทย์หลายข้อพึ่งกฎพวกนี้ตรงๆ — หลุดไปแปลว่าตรวจข้อนั้นไม่ได้
    expect(out).toContain("ค่าเปลี่ยน");
    expect(out).toContain("ส่วนลด");
    expect(out).toContain("ดอกเบี้ย");
  });

  it("ยาวเกินเพดานตัดที่ขอบ section — ตารางไม่ขาดครึ่ง", () => {
    const big = "x".repeat(30_000);
    const many = Array.from({ length: 10 }, (_, i) =>
      section(`s${i}`, [{ type: "p", text: big }]),
    );
    const out = buildGradingReference(many, SNAP);
    expect(out.length).toBeLessThan(70_000);
    // ทุก section ที่ติดมาต้องมาเต็มใบ (ความยาวเป็นจำนวนเท่าของ block เต็ม)
    const kept = out.split("## s").length - 1;
    expect(out).toContain(`## s0`);
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(10);
  });
});
