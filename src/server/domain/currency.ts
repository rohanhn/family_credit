import { eq } from "drizzle-orm";
import { families } from "../db/schema";
import type { DbOrTx } from "../db/types";
import { invalid, notFound } from "./errors";

// Đơn vị tiền tệ của gia đình (spec currency-ledger "Đơn vị tiền tệ của gia đình").
// Đổi tên chỉ đổi cách hiển thị; số điểm trong sổ cái không đổi.

export const DEFAULT_CURRENCY = { name: "Sao", icon: "star" } as const;

/** Bộ icon có sẵn cho đơn vị tiền tệ. */
export const CURRENCY_ICONS = ["star", "coin", "clock", "heart", "gem", "game"] as const;
export type CurrencyIcon = (typeof CURRENCY_ICONS)[number];

export type Currency = { name: string; icon: CurrencyIcon };

export function normalizeCurrencyName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const length = [...trimmed].length;
  if (length < 1 || length > 20) throw invalid("Tên đơn vị phải dài từ 1 đến 20 ký tự");
  return trimmed;
}

export async function getCurrency(db: DbOrTx, familyId: number): Promise<Currency> {
  const [row] = await db
    .select({ name: families.currencyName, icon: families.currencyIcon })
    .from(families)
    .where(eq(families.id, familyId));
  if (!row) throw notFound();
  const icon = (CURRENCY_ICONS as readonly string[]).includes(row.icon) ? (row.icon as CurrencyIcon) : DEFAULT_CURRENCY.icon;
  return { name: row.name, icon };
}

export async function updateCurrency(db: DbOrTx, familyId: number, input: { name: string; icon: string }): Promise<Currency> {
  const name = normalizeCurrencyName(input.name);
  if (!(CURRENCY_ICONS as readonly string[]).includes(input.icon)) throw invalid("Icon không có trong bộ có sẵn");
  const rows = await db
    .update(families)
    .set({ currencyName: name, currencyIcon: input.icon })
    .where(eq(families.id, familyId))
    .returning({ id: families.id });
  if (rows.length === 0) throw notFound();
  return { name, icon: input.icon as CurrencyIcon };
}
