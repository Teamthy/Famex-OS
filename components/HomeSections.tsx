// HomeSections — the below-the-fold marketing sections of the home page.
//
// These sections are server-rendered. Their CSS-only headings and static
// markup therefore ship no per-section JavaScript chunks and do not hydrate
// hundreds of DOM nodes on the first load; only the small Reveal wrappers and
// profile-dependent address/map islands are client components. The sections'
// images remain lazy, and the Reveal wrappers use content-visibility:auto so
// below-the-fold rendering stays off the LCP critical path measured by
// lighthouserc.json.

import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import AdmissionsBanner from "@/components/AdmissionsBanner";
import FindUs from "@/components/FindUs";
import Groups from "@/components/Groups";
import ServiceInfo from "@/components/ServiceInfo";
import Services from "@/components/Services";

/** Sections between the hero and the marquee. */
export function HomeSectionsTop() {
  return (
    <>
      <Reveal variant="up" className="cv-auto">
        <ServiceInfo />
      </Reveal>
      <Reveal variant="right" delay={60} className="cv-auto">
        <AdmissionsBanner />
      </Reveal>
    </>
  );
}

/** Sections after the marquee. `children` is the server-rendered app CTA
 *  (it builds its QR code from request headers, so it must stay a server
 *  component) — passed through so it keeps its place in the page order. */
export function HomeSectionsBottom({ children }: { children: ReactNode }) {
  return (
    <>
      <Reveal variant="zoom" className="cv-auto">
        <Services />
      </Reveal>
      <Reveal variant="blur" delay={60} className="cv-auto">
        <Groups />
      </Reveal>
      {children}
      <Reveal variant="right" delay={60} className="cv-auto">
        <FindUs />
      </Reveal>
    </>
  );
}
