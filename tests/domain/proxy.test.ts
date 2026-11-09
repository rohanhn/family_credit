import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { HOUR, DAY } from "@/server/clock";

// Design D4 "gia hạn khi hoạt động": cookie phiên trượt được đặt lại hạn mới ở mỗi request GET.

function request(method: string, cookie: string) {
  return new NextRequest("http://localhost/kid/home", { method, headers: { cookie } });
}

describe("proxy gia hạn cookie phiên", () => {
  it("GET: đặt lại cookie bố mẹ 30 ngày, cookie con 2 giờ và cookie thiết bị 90 ngày", () => {
    const before = Date.now();
    const res = proxy(request("GET", "mc_parent=p1; mc_child=c1; mc_device=d1"));
    const parent = res.cookies.get("mc_parent");
    const child = res.cookies.get("mc_child");
    const device = res.cookies.get("mc_device");
    expect(parent?.value).toBe("p1");
    expect(child?.value).toBe("c1");
    expect(device?.value).toBe("d1");
    expect(parent?.httpOnly).toBe(true);
    expect(new Date(parent!.expires as Date).getTime()).toBeGreaterThanOrEqual(before + 30 * DAY - 1000);
    expect(new Date(child!.expires as Date).getTime()).toBeGreaterThanOrEqual(before + 2 * HOUR - 1000);
    expect(new Date(child!.expires as Date).getTime()).toBeLessThanOrEqual(Date.now() + 2 * HOUR);
    expect(new Date(device!.expires as Date).getTime()).toBeGreaterThanOrEqual(before + 90 * DAY - 1000);
  });

  it("Con trên máy riêng (mc_child_mode): không đặt hạn cho cookie con, để cookie mất khi đóng trình duyệt", () => {
    const res = proxy(request("GET", "mc_child=c1; mc_child_mode=browser; mc_device=d1"));
    expect(res.cookies.get("mc_child")).toBeUndefined();
    expect(res.cookies.get("mc_device")?.value).toBe("d1");
  });

  it("POST (Server Action) và request không có cookie: không đặt cookie", () => {
    expect(proxy(request("POST", "mc_parent=p1")).cookies.getAll()).toEqual([]);
    expect(proxy(request("GET", "")).cookies.getAll()).toEqual([]);
  });
});
