import Link from "next/link";

// Trang gốc thường được `src/proxy.ts` chuyển tới đúng nơi theo cookie (spec "Lối vào ứng dụng");
// trang này chỉ là dự phòng.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">Sao nhà mình</h1>
      <p>Thưởng, phạt và nhiệm vụ hằng ngày cho cả gia đình.</p>
      <nav aria-label="Lối vào" className="flex flex-wrap justify-center gap-3">
        <Link href="/login" className="inline-flex min-h-11 items-center px-3 font-extrabold underline">
          Bố mẹ đăng nhập
        </Link>
        <Link href="/kid" className="inline-flex min-h-11 items-center px-3 font-extrabold underline">
          Con đăng nhập
        </Link>
      </nav>
    </main>
  );
}
