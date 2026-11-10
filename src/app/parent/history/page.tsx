import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { getCurrency } from "@/server/domain/currency";
import { getFamily } from "@/server/domain/families";
import { listTransactions, type TransactionKind } from "@/server/domain/ledger";
import { TRANSACTION_KINDS } from "@/server/db/schema";
import { addDays, isDateString, startOfDayInZone } from "@/lib/time";
import { HistoryList, KIND_LABELS } from "@/ui/history-list";
import { Button } from "@/ui/primitives";
import { AdjustButton } from "./adjust-button";

export const metadata: Metadata = { title: "Lịch sử · Sao nhà mình" };

type SearchParams = Promise<{ child?: string; kind?: string; from?: string; to?: string }>;

const selectClass = "min-h-11 rounded-xl border-2 border-black/15 bg-card px-3 text-base font-bold text-ink";
const inputLabel = "flex flex-col gap-1 text-[13px] font-extrabold text-muted";

async function History({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireParentWithFamily();
  const sp = await searchParams;
  const db = getDb();
  const [family, kids, currency] = await Promise.all([getFamily(db, auth.familyId), listChildren(db, auth.familyId, { includeArchived: true }), getCurrency(db, auth.familyId)]);

  const childId = kids.some((k) => String(k.id) === sp.child) ? Number(sp.child) : undefined;
  const kind = (TRANSACTION_KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as TransactionKind) : undefined;
  const from = sp.from && isDateString(sp.from) ? sp.from : "";
  const to = sp.to && isDateString(sp.to) ? sp.to : "";
  const { rows } = await listTransactions(db, {
    familyId: auth.familyId,
    childId,
    kinds: kind ? [kind] : undefined,
    from: from ? startOfDayInZone(from, family.timezone) : undefined,
    to: to ? startOfDayInZone(addDays(to, 1), family.timezone) : undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-extrabold">Lịch sử</h1>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[20px] bg-card p-4 shadow-flat">
        <label className={inputLabel}>
          Con
          <select name="child" defaultValue={childId ?? ""} className={selectClass}>
            <option value="">Cả gia đình</option>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.archivedAt ? " (đã lưu trữ)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={inputLabel}>
          Loại
          <select name="kind" defaultValue={kind ?? ""} className={selectClass}>
            <option value="">Tất cả</option>
            {TRANSACTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={inputLabel}>
          Từ ngày
          <input type="date" name="from" defaultValue={from} className={selectClass} />
        </label>
        <label className={inputLabel}>
          Đến ngày
          <input type="date" name="to" defaultValue={to} className={selectClass} />
        </label>
        <Button type="submit" variant="soft">
          Lọc
        </Button>
      </form>
      <HistoryList
        rows={rows}
        timezone={family.timezone}
        currency={currency.name}
        showChild
        rowAction={(r) => (r.kind !== "adjust" && !r.adjusted && r.appliedAmount !== 0 ? <AdjustButton transactionId={r.id} /> : null)}
      />
    </div>
  );
}

export default function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <History searchParams={searchParams} />
    </Suspense>
  );
}
