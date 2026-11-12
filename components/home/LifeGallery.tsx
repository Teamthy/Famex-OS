import { SERIF } from "./theme";

const TILES = [
  {
    src: "/home/college-sports.jpg",
    alt: "Students competing on the sports field",
    caption: "Inter-house sports",
    span: "lg:col-span-2 lg:row-span-2",
    height: "h-64 lg:h-full",
  },
  {
    src: "/home/arts.jpg",
    alt: "Student artwork in the studio",
    caption: "Arts & culture",
    span: "",
    height: "h-56",
  },
  {
    src: "/home/college-itlab.jpg",
    alt: "Students in the computer laboratory",
    caption: "Digital literacy",
    span: "",
    height: "h-56",
  },
  {
    src: "/home/college-assembly.jpg",
    alt: "Whole-school assembly",
    caption: "Monday assembly",
    span: "lg:col-span-2",
    height: "h-56",
  },
];

/** Section 9 — the campus-life mosaic ("#campus" anchor target). */
export default function LifeGallery() {
  return (
    <section id="campus" className="home-below-fold mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className={`${SERIF} text-4xl font-semibold tracking-tight sm:text-5xl`}>
            Life on <em className="font-light italic text-[var(--famex-forest-mid)]">campus</em>
          </h2>
          <p className="mt-3 max-w-md text-sm text-[var(--famex-text-secondary)]">
            The hours between the bell and the gate — where most of the character formation actually
            happens.
          </p>
        </div>
        <a
          href="/gallery"
          className="rounded-full border border-[var(--famex-primary)]/15 bg-white/70 px-5 py-2.5 text-sm font-medium text-[var(--famex-primary)] transition hover:border-[var(--famex-primary)]/35"
        >
          Full gallery
        </a>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-4 lg:grid-rows-2">
        {TILES.map((tile) => (
          <figure
            key={tile.src}
            className={`group relative overflow-hidden rounded-3xl ${tile.span}`}
          >
            <img
              src={tile.src}
              alt={tile.alt}
              loading="lazy"
              decoding="async"
              className={`${tile.height} w-full object-cover transition duration-700 group-hover:scale-[1.04]`}
            />
            <figcaption className="absolute bottom-3 left-3 rounded-full bg-[var(--famex-white)]/90 px-3 py-1 text-[11px] font-semibold text-[var(--famex-primary)] backdrop-blur">
              {tile.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
