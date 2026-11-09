import { children, families, parents } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

// Dữ liệu mẫu nhỏ cho test domain: một gia đình, một bố, các con.

export async function seedFamily(db: Db, opts: { kids?: string[]; familyName?: string } = {}) {
  const [family] = await db
    .insert(families)
    .values({ name: opts.familyName ?? "Nhà Bin & Na" })
    .returning();
  const [parent] = await db
    .insert(parents)
    .values({ familyId: family.id, email: `bo-${family.id}@example.com`, displayName: "Bố", passwordHash: "x" })
    .returning();
  const kids = [];
  for (const name of opts.kids ?? ["Bin"]) {
    const [kid] = await db
      .insert(children)
      .values({ familyId: family.id, name, avatar: "boy-brown", pinHash: "x" })
      .returning();
    kids.push(kid);
  }
  return { family, parent, kids };
}
