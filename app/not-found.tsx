import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0a1628] p-6 text-center">
      <div className="max-w-md">
        <p className="text-8xl font-bold text-[#16a34a]">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">Page not found</h1>
        <p className="mt-3 text-sm text-slate-400">
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-[#16a34a] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#15803d]"
          >
            Go to homepage
          </Link>
          <Link href="/admissions" className="text-sm text-slate-400 underline hover:text-white">
            Apply for admission
          </Link>
        </div>
      </div>
    </main>
  );
}
