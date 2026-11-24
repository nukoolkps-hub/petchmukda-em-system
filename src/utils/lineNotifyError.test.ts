import { describe, expect, it } from "vitest";
import { diagnoseLineNotifyError } from "./lineNotifyError";

const cause = (e: string | null | undefined) =>
  diagnoseLineNotifyError(e).cause;

describe("diagnoseLineNotifyError", () => {
  it("401 → token", () => {
    expect(
      cause(
        'LINE push failed: 401 {"message":"Authentication failed. Confirm that the access token in the authorization header is valid."}',
      ),
    ).toBe("token");
  });

  it("429 monthly limit → quota (แยกจาก rate limit)", () => {
    expect(
      cause(
        'LINE push failed: 429 {"message":"You have reached your monthly limit."}',
      ),
    ).toBe("quota");
    expect(
      cause(
        'LINE push failed: 429 {"message":"The API rate limit has been exceeded."}',
      ),
    ).toBe("rate_limit");
  });

  it("400 'to' invalid → recipient · 400 อื่น → bad_request", () => {
    expect(
      cause(
        `LINE push failed: 400 {"message":"The property, 'to', in the request body is invalid (line: -, column: -)"}`,
      ),
    ).toBe("recipient");
    expect(
      cause(
        'LINE push failed: 400 {"message":"A message (messages[0]) in the request body is invalid"}',
      ),
    ).toBe("bad_request");
  });

  it("5xx และ error เครือข่าย → line_down (กดซ้ำได้)", () => {
    expect(cause("LINE push failed: 500 Internal Server Error")).toBe(
      "line_down",
    );
    expect(cause("fetch failed")).toBe("line_down");
    expect(cause("connect ETIMEDOUT 1.2.3.4:443")).toBe("line_down");
    expect(diagnoseLineNotifyError("fetch failed").retryable).toBe(true);
  });

  it("403 → forbidden · not_configured → not_configured", () => {
    expect(cause("LINE push failed: 403 {}")).toBe("forbidden");
    expect(cause("not_configured")).toBe("not_configured");
  });

  it("ใบเก่าที่ไม่มี error / ข้อความแปลไม่ได้ → unknown (ไม่พัง)", () => {
    expect(cause(undefined)).toBe("unknown");
    expect(cause("")).toBe("unknown");
    expect(cause("something weird")).toBe("unknown");
    expect(diagnoseLineNotifyError(null).title).toBeTruthy();
  });

  it("admin หลายคน (คั่น ' | ') → ใช้สาเหตุแรกที่แปลได้", () => {
    expect(cause("weird | LINE push failed: 401 bad token")).toBe("token");
  });

  it("ทุกสาเหตุมี title + hint ภาษาไทย", () => {
    for (const e of ["LINE push failed: 401 x", "not_configured", "x"]) {
      const d = diagnoseLineNotifyError(e);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.hint.length).toBeGreaterThan(0);
    }
  });
});
