import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fromError } from "@/app/actions/result";
import { DomainError, notFound } from "@/server/domain/errors";
import { setSecurityLogSink, type SecurityEvent, type SecurityFields } from "@/server/log";

// Task 6.3 (design D9): Server Action gặp NOT_FOUND khi có phiên hợp lệ thì ghi `authz_denied`.

let events: { event: SecurityEvent; fields: SecurityFields }[] = [];
beforeEach(() => {
  events = [];
  setSecurityLogSink((event, fields) => events.push({ event, fields }));
});
afterEach(() => {
  setSecurityLogSink();
});

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("fromError ghi authz_denied", () => {
  it("NOT_FOUND với phiên bố mẹ: ghi tên action và id được yêu cầu, không ghi dữ liệu cá nhân", () => {
    const result = fromError(notFound(), {
      action: "approveClaimAction",
      auth: { familyId: 7, parentId: 3 },
      form: form({ id: "42", reason: "Con nói dối", childId: "9", note: "abc" }),
    });
    expect(result).toEqual({ error: expect.any(String) });
    expect(events).toEqual([{ event: "authz_denied", fields: { familyId: 7, parentId: 3, childId: undefined, detail: "approveClaimAction id=42,childId=9" } }]);
    expect(JSON.stringify(events)).not.toContain("Con nói dối");
  });

  it("NOT_FOUND với phiên con", () => {
    fromError(notFound(), { action: "redeemAction", auth: { familyId: 7, childId: 5 }, form: form({ rewardId: "11" }) });
    expect(events[0]).toMatchObject({ event: "authz_denied", fields: { familyId: 7, childId: 5, detail: "redeemAction rewardId=11" } });
  });

  it("Lỗi khác NOT_FOUND hoặc không có ngữ cảnh phiên thì không ghi", () => {
    fromError(new DomainError("CONFLICT", "Đã xử lý"), { action: "approveClaimAction", auth: { familyId: 7, parentId: 3 } });
    fromError(notFound());
    expect(events).toEqual([]);
  });
});
