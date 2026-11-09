import { and, eq, isNull } from "drizzle-orm";
import { children, families } from "../db/schema";
import type { DbOrTx } from "../db/types";
import { effectiveTheme, isThemeId, type ThemeId } from "@/ui/themes";
import { invalid, notFound } from "./errors";

// Theme của gia đình và của từng con (spec ui-theme, design D6).
// Theme hiệu lực = theme của con nếu có, ngược lại theme mặc định của gia đình.

function validTheme(theme: string): ThemeId {
  if (!isThemeId(theme)) throw invalid("Theme không có trong danh sách");
  return theme;
}

/** Bố mẹ đổi theme mặc định: áp cho màn bố mẹ, màn chọn avatar và các con chưa tự chọn. */
export async function setFamilyTheme(db: DbOrTx, familyId: number, theme: string): Promise<ThemeId> {
  const id = validTheme(theme);
  const rows = await db.update(families).set({ defaultTheme: id }).where(eq(families.id, familyId)).returning({ id: families.id });
  if (rows.length === 0) throw notFound();
  return id;
}

/** Con chọn theme riêng; `null` là "Dùng theme của gia đình". Chỉ đổi màn hình của chính con đó. */
export async function setChildTheme(db: DbOrTx, familyId: number, childId: number, theme: string | null): Promise<ThemeId | null> {
  const id = theme === null ? null : validTheme(theme);
  const rows = await db
    .update(children)
    .set({ theme: id })
    .where(and(eq(children.id, childId), eq(children.familyId, familyId), isNull(children.archivedAt)))
    .returning({ id: children.id });
  if (rows.length === 0) throw notFound();
  return id;
}

/** Theme hiệu lực của một con (hoặc của gia đình khi không có con, ví dụ màn bố mẹ và màn chọn avatar). */
export async function getEffectiveTheme(db: DbOrTx, familyId: number, childId?: number): Promise<ThemeId> {
  const [family] = await db.select({ theme: families.defaultTheme }).from(families).where(eq(families.id, familyId));
  if (!family) throw notFound();
  if (childId === undefined) return effectiveTheme(null, family.theme);
  const [child] = await db
    .select({ theme: children.theme })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)));
  if (!child) throw notFound();
  return effectiveTheme(child.theme, family.theme);
}
