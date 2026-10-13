/**
 * afterLoad — defers a next/dynamic loader until the largest contentful
 * paint (the hero image) has actually happened — plus one more frame and a
 * short beat — so the deferred chunk is never on the critical path of the
 * first paint, whatever the speed of the machine running the page.
 *
 * The chunk request itself may already be in flight (Next.js preloads
 * dynamic chunks at low priority); what matters for the first paint is when
 * the chunk is *evaluated*, and this keeps that strictly after the LCP
 * paint. On the server there is no paint to wait for, so the loader runs
 * immediately and the component is rendered inline.
 *
 * Use for interactive widgets and below-the-fold sections that no visitor
 * needs in the first viewport.
 */
export function afterLoad<T>(loader: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = new Promise<T>((resolve) => {
        let started = false;
        const begin = () => {
          if (started) return;
          started = true;
          loader().then(resolve);
        };
        if (typeof window === "undefined") {
          begin();
          return;
        }
        // The LCP paint happens in the frame after the hero image paints;
        // settle two frames later so the evaluation is strictly after it.
        const settle = () =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(begin, 150)));
        try {
          const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const el = (entry as unknown as { element?: Element }).element;
              if (el && el.tagName === "IMG") {
                po.disconnect();
                settle();
                return;
              }
            }
          });
          po.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // LCP observation unsupported — the fallback timeout below applies.
        }
        // Fallback (no LCP observer support, or no LCP entry yet): never
        // hold the deferred chunk back for long. Generous on purpose — it
        // must not fire before the LCP paint on a slow machine.
        setTimeout(begin, 4000);
      });
    }
    return pending;
  };
}
