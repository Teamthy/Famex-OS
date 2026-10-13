import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ApplicationStatusLookup from "@/components/admissions/ApplicationStatusLookup";

export default function ApplicationStatusPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-[var(--section-bg-alt)] pb-12 pt-32 md:pb-16 md:pt-40">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-green">
              Admissions
            </p>
            <h1 className="mt-4 font-display text-5xl tracking-[0.08em] text-[var(--text-primary)] sm:text-7xl">
              CHECK <span className="text-brand-green">STATUS</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
              Use your Application ID to follow the progress of a submitted admission application.
            </p>
          </div>
        </section>
        <section className="pt-10 md:pt-14">
          <ApplicationStatusLookup />
        </section>
      </main>
      <Footer />
    </>
  );
}
