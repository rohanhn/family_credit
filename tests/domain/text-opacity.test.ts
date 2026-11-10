import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Design D7: `opacity-*` trên phần tử có chữ làm chữ dưới 4.5:1 mà test tương phản theo token không bắt được.
// Quét lớp `opacity-<số>` trong src/app và src/ui; mọi chỗ dùng phải nằm trong danh sách cho phép kèm lý do.
// Không tính `disabled:opacity-*` (nút bị vô hiệu hóa được miễn yêu cầu tương phản, WCAG 1.4.3).

const ALLOWED: { file: string; className: string; reason: string }[] = [
  {
    file: "src/app/parent/tasks/task-form.tsx",
    className: "opacity-60",
    reason: "Chip chọn từng con khi đang chọn \"Tất cả các con\": trạng thái không áp dụng (WCAG 1.4.3 miễn)",
  },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

describe("Không dùng opacity làm mờ chữ", () => {
  it("Mọi lớp opacity-* đều nằm trong danh sách cho phép", () => {
    const root = process.cwd();
    const found: { file: string; className: string }[] = [];
    for (const file of [...walk(join(root, "src/app")), ...walk(join(root, "src/ui"))]) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/(?<![\w:/-])opacity-\d+/g)) found.push({ file: relative(root, file), className: m[0] });
    }
    const notAllowed = found.filter((f) => !ALLOWED.some((a) => a.file === f.file && a.className === f.className));
    expect(notAllowed).toEqual([]);
  });

  it("Danh sách cho phép không có mục thừa", () => {
    for (const a of ALLOWED) expect(readFileSync(join(process.cwd(), a.file), "utf8")).toContain(a.className);
  });
});
