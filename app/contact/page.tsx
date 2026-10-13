"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { useState, type FormEvent } from "react";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { CONTACT_THANKS } from "@/lib/contact-enquiry";
import { useSchoolProfile } from "@/components/SchoolProfileContext";

import { AnimatedText } from "@/components/AnimatedText";
type EnquiryForm = { name: string; email: string; phone: string; message: string; website: string };

const EMPTY_FORM: EnquiryForm = { name: "", email: "", phone: "", message: "", website: "" };

export default function ContactPage() {
  const { address } = useSchoolProfile();
  const [form, setForm] = useState<EnquiryForm>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Success is shown only after the server has stored the enquiry (a 2xx response).
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(
          body?.error ||
            "We could not send your enquiry. Please try again, or call the school office.",
        );
        return;
      }
      setSentTo(form.name);
      setForm(EMPTY_FORM);
    } catch {
      setError(
        "We could not reach the school office. Check your connection and try again, or call us.",
      );
    } finally {
      setSending(false);
    }
  }

  const fieldClass =
    "w-full p-4 rounded-xl bg-[var(--input-bg)] border border-[var(--border-subtle)] text-[var(--text-primary)]";

  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <Reveal>
          <section className="pt-32 pb-20 bg-brand-navy px-6">
            <div className="mx-auto max-w-7xl text-center">
              <h1 className="font-display text-white text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="CONTACT" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="US" delay={0.175} />
                </span>
              </h1>
              <p className="text-white/50 max-w-md mx-auto mt-4">
                We are here to answer your questions and welcome you to our campus.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 px-6">
            <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-16">
              <div>
                <AnimatedText
                  as="h2"
                  className="font-display text-3xl text-[var(--text-primary)] mb-8"
                  text="Reach Out"
                />
                <div className="space-y-4">
                  {[
                    { icon: Mail, label: "Email", val: "info@ykaycollege.com" },
                    { icon: Phone, label: "Phone", val: "0701 537 4411" },
                    { icon: MessageCircle, label: "WhatsApp", val: "0701 537 4411" },
                    // Shown only once the school has confirmed its address.
                    ...(address ? [{ icon: MapPin, label: "Address", val: address }] : []),
                  ].map((i) => (
                    <div
                      key={i.label}
                      className="flex items-center gap-5 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]"
                    >
                      <i.icon className="text-brand-green" size={20} />
                      <div>
                        <p className="text-[10px] font-bold uppercase text-brand-green tracking-widest">
                          {i.label}
                        </p>
                        <p className="text-sm text-[var(--text-primary)] font-medium">{i.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-10 rounded-[2.5rem] shadow-[var(--card-shadow)]">
                <AnimatedText
                  as="h2"
                  className="font-display text-3xl text-[var(--text-primary)] mb-8"
                  text="Send a Message"
                />
                {sentTo ? (
                  <div
                    role="status"
                    className="rounded-2xl border border-brand-green/40 bg-brand-green/10 p-6"
                  >
                    <p className="font-bold text-[var(--text-primary)]">Thank you, {sentTo}.</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{CONTACT_THANKS}</p>
                    <button
                      type="button"
                      onClick={() => setSentTo(null)}
                      className="mt-4 text-sm font-bold text-brand-green underline"
                    >
                      Send another enquiry
                    </button>
                  </div>
                ) : (
                  <form className="relative space-y-4" onSubmit={submit}>
                    <input
                      name="name"
                      aria-label="Your name"
                      placeholder="Your Name"
                      required
                      maxLength={120}
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className={fieldClass}
                    />
                    <input
                      name="email"
                      type="email"
                      aria-label="Email address"
                      placeholder="Email Address"
                      required
                      maxLength={200}
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      className={fieldClass}
                    />
                    <input
                      name="phone"
                      type="tel"
                      aria-label="Phone number (optional)"
                      placeholder="Phone number (optional)"
                      maxLength={20}
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                      className={fieldClass}
                    />
                    <textarea
                      name="message"
                      aria-label="Your message"
                      placeholder="How can we help?"
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={4}
                      value={form.message}
                      onChange={(event) => setForm({ ...form, message: event.target.value })}
                      className={`${fieldClass} resize-none`}
                    />
                    {/* Hidden from people. Automated form-fillers complete it, and the server ignores those. */}
                    <div
                      aria-hidden="true"
                      className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
                    >
                      <label>
                        Website
                        <input
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={form.website}
                          onChange={(event) => setForm({ ...form, website: event.target.value })}
                        />
                      </label>
                    </div>
                    {error && (
                      <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={sending}
                      className="btn-primary w-full py-4 disabled:opacity-60"
                    >
                      {sending ? "Sending…" : "Send Message"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
