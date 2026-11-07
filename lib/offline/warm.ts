"use client";

/**
 * Ask the service worker to hold a page on the device.
 *
 * Next.js caches a route's JS chunks only after that route has been visited in
 * the current build. For the exam list that is fine — a student visits it. For
 * the runner it is not: the page is opened once, on exam morning, sometimes in
 * a hall with no signal, and a student who saved the paper the night before
 * would find the questions on their device and nothing to render them with.
 *
 * So after a successful "Save to device" the list posts the runner's path to
 * the worker, which fetches the HTML and every chunk it references. The worker
 * cannot see the IndexedDB write, which is why the page has to say so.
 *
 * Deliberately best-effort and silent on failure. The paper is already saved;
 * this only improves the odds of opening it offline. A browser with no service
 * worker (private mode, an old kiosk) reports false, and the caller softens its
 * message rather than claiming an offline guarantee it cannot keep.
 */
export async function warmExamPage(examId: string, timeoutMs = 8000): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    if (!worker) return false;

    const path = `/student/exams/${examId}`;

    return await new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      const done = (ok: boolean) => {
        channel.port1.onmessage = null;
        clearTimeout(timer);
        resolve(ok);
      };
      // Never hold the UI open on this. A save that succeeded is a success even
      // if the worker never answers.
      const timer = setTimeout(() => done(false), timeoutMs);

      channel.port1.onmessage = (event: MessageEvent) => {
        const data = event.data as { ok?: boolean } | null;
        done(Boolean(data?.ok));
      };

      worker.postMessage({ type: "FAMEX_WARM_EXAM", path }, [channel.port2]);
    });
  } catch {
    return false;
  }
}
