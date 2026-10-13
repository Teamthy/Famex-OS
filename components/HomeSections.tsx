"use client";

// HomeSections — the below-the-fold marketing sections of the home page.
//
// Each section is its own async chunk (next/dynamic, ssr kept so the markup
// is in the server HTML for SEO and no-JS visitors). They carry no animation
// library and their images sit behind content-visibility:auto (see the Reveal
// classNames), so the chunks and bytes stay off the LCP critical path
// measured by lighthouserc.json.
//
// NOTE: do not gate these loaders client-side (e.g. "load after LCP") — a
// loader that resolves on the server but suspends on the client breaks
// hydration and blanks the page. Gating is only safe with ssr:false.

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

const ServiceInfo = dynamic(() => import("@/components/ServiceInfo"));
const ITFlagshipSection = dynamic(() => import("@/components/ITFlagshipSection"));
const AdmissionsBanner = dynamic(() => import("@/components/AdmissionsBanner"));
const Services = dynamic(() => import("@/components/Services"));
const Groups = dynamic(() => import("@/components/Groups"));
const VirtualBridge = dynamic(() => import("@/components/VirtualBridge"));
const FindUs = dynamic(() => import("@/components/FindUs"));

/** Sections between the hero and the marquee. */
export function HomeSectionsTop() {
  return (
    <>
      <Reveal variant="up" className="cv-auto">
        <ServiceInfo />
      </Reveal>
      <Reveal variant="left" delay={60} className="cv-auto">
        <ITFlagshipSection />
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
      <Reveal variant="left" delay={60} className="cv-auto">
        <VirtualBridge />
      </Reveal>
      <Reveal variant="right" delay={60} className="cv-auto">
        <FindUs />
      </Reveal>
    </>
  );
}
