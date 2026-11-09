import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listRules } from "@/server/domain/rules";
import { ParentColumns } from "@/ui/parent-shell";
import { Card } from "@/ui/primitives";
import { NewRuleForm, RuleRow } from "./rule-forms";

export const metadata: Metadata = { title: "Danh mục rule · Sao nhà mình" };

async function Rules() {
  const auth = await requireParentWithFamily();
  const rules = await listRules(getDb(), auth.familyId, { includeHidden: true });
  const groups = [
    { kind: "reward" as const, title: "Rule thưởng" },
    { kind: "penalty" as const, title: "Rule phạt" },
  ];
  return (
    <ParentColumns
      main={
        <>
          <h1 className="font-display text-3xl font-extrabold">Danh mục rule</h1>
          {groups.map((g) => {
            const list = rules.filter((r) => r.kind === g.kind);
            return (
              <section key={g.kind} className="flex flex-col gap-2.5" aria-label={g.title}>
                <h2 className="font-display text-xl font-extrabold">{g.title}</h2>
                {list.length === 0 ? (
                  <p className="font-semibold text-muted">Chưa có.</p>
                ) : (
                  list.map((r) => <RuleRow key={r.id} rule={{ id: r.id, name: r.name, kind: r.kind, points: r.points, hidden: r.hidden }} />)
                )}
              </section>
            );
          })}
        </>
      }
      aside={
        <Card>
          <NewRuleForm />
        </Card>
      }
    />
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Rules />
    </Suspense>
  );
}
