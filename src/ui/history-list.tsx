import type { ReactNode } from "react";
import Link from "next/link";
import { formatDateTime, signed } from "@/lib/time";

// Danh sách giao dịch dùng chung cho bố mẹ và con (spec currency-ledger "Xem lịch sử giao dịch").

export const KIND_LABELS: Record<string, string> = {
  rule: "Rule",
  task: "Nhiệm vụ",
  adhoc: "Đột xuất",
  redeem: "Đổi thưởng",
  adjust: "Điều chỉnh",
};

export type HistoryRow = {
  id: number;
  createdAt: Date;
  kind: string;
  description: string;
  requestedAmount: number;
  appliedAmount: number;
  childName?: string;
  actorName: string;
  /** Đã có giao dịch điều chỉnh tham chiếu tới dòng này. */
  adjusted?: boolean;
};

export function HistoryList({
  rows,
  timezone,
  currency,
  showChild,
  rowAction,
}: {
  rows: HistoryRow[];
  timezone: string;
  currency: string;
  showChild?: boolean;
  rowAction?: (row: HistoryRow) => ReactNode;
}) {
  if (rows.length === 0) return <p className="rounded-[20px] bg-card p-6 text-center font-semibold text-muted shadow-flat">Chưa có giao dịch nào.</p>;
  return (
    <ol className="flex flex-col rounded-[20px] bg-card px-4 shadow-flat">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/5 py-3 last:border-0">
          <span className="flex min-w-0 flex-[1_1_220px] flex-col">
            <span className="font-extrabold">
              {showChild && r.childName ? `${r.childName} · ` : ""}
              {r.description}
            </span>
            <span className="text-[13px] font-semibold text-muted">
              {KIND_LABELS[r.kind] ?? r.kind} · {r.actorName} · {formatDateTime(r.createdAt, timezone)}
              {r.appliedAmount !== r.requestedAmount && ` · mức gốc ${signed(r.requestedAmount)}`}
            </span>
          </span>
          <span className={`font-display text-lg font-extrabold ${r.appliedAmount > 0 ? "text-plus" : r.appliedAmount < 0 ? "text-minus" : "text-muted"}`}>
            {signed(r.appliedAmount)} <span className="text-sm font-bold text-muted">{currency}</span>
          </span>
          {rowAction?.(r)}
        </li>
      ))}
    </ol>
  );
}

/** Phân trang lịch sử (design D2): link tới trang cũ hơn giữ nguyên bộ lọc trên URL, không cần JavaScript. */
export function HistoryPager({ basePath, params, nextBeforeId, isFirstPage }: { basePath: string; params: Record<string, string | undefined>; nextBeforeId: number | null; isFirstPage: boolean }) {
  if (nextBeforeId === null && isFirstPage) return null;
  const href = (before?: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (before !== undefined) q.set("before", String(before));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const linkClass = "inline-flex min-h-11 items-center rounded-full bg-soft px-5 font-extrabold text-ink";
  return (
    <nav aria-label="Phân trang lịch sử" className="flex flex-wrap justify-center gap-3">
      {!isFirstPage && (
        <Link href={href()} className={linkClass}>
          Về mới nhất
        </Link>
      )}
      {nextBeforeId !== null && (
        <Link href={href(nextBeforeId)} className={linkClass}>
          Xem thêm
        </Link>
      )}
    </nav>
  );
}
