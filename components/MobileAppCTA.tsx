import { Download, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { apkQrDataUrl, requestOrigin } from "@/lib/apk";

export default async function MobileAppCTA() {
  // QR encodes the INSTALL PAGE on the origin the visitor is actually on —
  // preview deploys, custom domains and production all scan correctly.
  const qr = await apkQrDataUrl(`${await requestOrigin()}/download`);

  return (
    <section
      id="download-app"
      className="relative w-full overflow-hidden bg-brand-navy py-20 md:py-28"
    >
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/home/mobile.jpg"
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-brand-navy/80" />
      </div>
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-brand-green/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-brand-orange/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <span className="font-body text-[10px] font-bold tracking-[0.25em] uppercase text-brand-green block mb-4">
                YKAY ON THE GO
              </span>
              <h2 className="font-display text-4xl md:text-6xl leading-[0.95] tracking-[2px] text-white mb-6">
                THE SCHOOL IN <br />
                <span className="text-brand-green">YOUR POCKET</span>
              </h2>
              <p className="font-body text-base md:text-lg text-white/70 max-w-lg mb-8 leading-relaxed">
                Results, attendance, fees, timetables and push notifications — all offline-ready.
                Install the app instantly from this website on{" "}
                <b className="text-white">iPhone and Android</b>: it is the full mobile app,
                installs in seconds and updates itself. Android users can also grab the app file
                (APK).
              </p>
              <div className="flex flex-wrap items-center gap-5">
                {/* Always route through /download rather than straight at the
                    .apk. The page explains instant PWA install (both platforms)
                    and handles the Android "unknown source" warning for the
                    APK — a parent who taps a raw file link with no explanation
                    will stop there. */}
                <Link
                  href="/download"
                  className="inline-flex items-center gap-3 rounded-full bg-[#4ec54d] px-8 py-4 font-body text-sm font-bold uppercase tracking-[0.15em] text-[#0c1824] transition-all duration-300 hover:scale-[1.03] hover:bg-[#3aa93a] active:scale-[0.97] shadow-lg shadow-black/30"
                >
                  <Download size={18} /> Install the app
                  <span className="font-normal normal-case tracking-normal opacity-80">
                    iPhone · Android
                  </span>
                </Link>
              </div>
              <p className="mt-5 flex items-start gap-2 font-body text-xs leading-relaxed text-white/50">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-green" />
                <span>
                  No app store needed and no unknown-source warnings — the installable app comes
                  straight from the school&apos;s own website.
                </span>
              </p>
            </div>
          </Reveal>
          <div className="flex justify-center lg:justify-end">
            <div className="relative rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex items-center gap-2 text-brand-green">
                  <QrCode size={18} />
                  <span className="font-body text-[10px] font-bold uppercase tracking-[0.25em]">
                    Scan to open the install page
                  </span>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-xl">
                  {qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr}
                      alt="Scan to download the Ykay College app"
                      width={196}
                      height={196}
                    />
                  ) : (
                    <div className="flex h-[196px] w-[196px] items-center justify-center text-center text-xs text-slate-600">
                      QR appears here once the download link is configured
                    </div>
                  )}
                </div>
                <p className="mt-4 max-w-[16rem] text-xs leading-relaxed text-white/55">
                  Point your phone camera at the code, tap the notification, and install.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
