// IP client (design D9): lấy phần tử cuối của X-Forwarded-For do Traefik gắn.
// Chỉ tin header này vì container không publish port, mọi request đều đi qua Traefik.

export function clientIpFrom(forwardedFor: string | null | undefined, realIp?: string | null): string {
  const parts = (forwardedFor ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const ip = parts.at(-1) ?? realIp?.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}
