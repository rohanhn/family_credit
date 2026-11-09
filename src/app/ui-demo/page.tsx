import { notFound } from "next/navigation";
import { UiDemo } from "./ui-demo";

// Trang mẫu để kiểm tra theme và bố cục (task 1.4). Không có trên production.
export default function UiDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiDemo />;
}
