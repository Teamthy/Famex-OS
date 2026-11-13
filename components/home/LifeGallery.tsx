import { ArrowUpRight } from "lucide-react";
import { SERIF } from "./theme";

const TILES = [
  {
    src: "/home/college-sports.jpg",
    alt: "Students playing football on the field",
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
    alt: "Students gathered for assembly",
    caption: "Monday assembly",
    span: "lg:col-span-2",
    height: "h-56",
  },
];

/** The campus-life photo mosaic, borrowing the reference's editorial image cards. */
export default function LifeGallery() {
  return (
    <section
      id="campus"
      className="home-below-fold mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--home-dark-soft)]">
            Beyond the classroom
          </p>
          <h2
            className={`${SERIF} text-[clamp(2.7rem,5vw,4.6rem)] uppercase leading-[.9] text-[var(--home-dark)]`}
          >
            Life on campus
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--home-muted)]">
            The hours between the bell and the gate — where friendships, confidence and character
            take shape.
          </p>
        </div>
        <a
          href="/gallery"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--home-dark)] px-5 py-3 text-xs font-bold text-white transition hover:bg-[var(--home-lime)] hover:text-[var(--home-dark)]"
        >
          Explore the gallery <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
        {TILES.map((tile) => (
          <figure
            key={tile.src}
            className={`group relative overflow-hidden rounded-[22px] bg-[var(--home-dark)] ${tile.span}`}
          >
            <img
              src={tile.src}
              alt={tile.alt}
              loading="lazy"
              decoding="async"
              className={`${tile.height} w-full object-cover transition duration-700 group-hover:scale-[1.04]`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <figcaption className="absolute bottom-3 left-3 rounded-full bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--home-dark)]">
              {tile.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
