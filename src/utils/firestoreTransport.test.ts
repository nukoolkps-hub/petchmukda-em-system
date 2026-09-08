import { describe, expect, it } from "vitest";
import { isLineWebView, shouldForceLongPolling } from "./firestoreTransport";

/* UA จริงที่เก็บมาจากเครื่องผู้ใช้ */
const LINE_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F79 Safari/604.1 Line/14.10.0";
const LINE_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.9.1";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("isLineWebView", () => {
  it("จับเบราว์เซอร์ในแอป LINE ได้ทั้ง iOS และ Android", () => {
    expect(isLineWebView(LINE_IOS)).toBe(true);
    expect(isLineWebView(LINE_ANDROID)).toBe(true);
  });

  it("ไม่ false positive กับเบราว์เซอร์ปกติ", () => {
    expect(isLineWebView(SAFARI_IOS)).toBe(false);
    expect(isLineWebView(CHROME_DESKTOP)).toBe(false);
    expect(isLineWebView("")).toBe(false);
  });

  it('ต้องมี "/" + เลขเวอร์ชัน — คำว่า line เฉยๆ ไม่นับ', () => {
    expect(isLineWebView("Mozilla/5.0 Streamline/2.0")).toBe(false);
    expect(isLineWebView("Mozilla/5.0 (Airline Browser)")).toBe(false);
  });
});

describe("shouldForceLongPolling", () => {
  it("ใน LINE → บังคับเสมอ (WebChannel ค้างบ่อย)", () => {
    expect(
      shouldForceLongPolling({ userAgent: LINE_IOS, stalledBefore: false }),
    ).toBe(true);
  });

  it("เบราว์เซอร์ปกติ → ปล่อยให้ auto-detect ทำงาน (เร็วกว่า)", () => {
    expect(
      shouldForceLongPolling({ userAgent: SAFARI_IOS, stalledBefore: false }),
    ).toBe(false);
  });

  it("เครื่องที่เคยค้าง → บังคับ แม้ไม่ได้อยู่ใน LINE", () => {
    expect(
      shouldForceLongPolling({
        userAgent: CHROME_DESKTOP,
        stalledBefore: true,
      }),
    ).toBe(true);
  });
});
