import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, ArrowRight, ArrowUpRight, Zap, Timer,
  Upload, Stethoscope, ShieldCheck, Truck, Clock,
} from "lucide-react";
import api from "../lib/api";
import { useFetch, useCountdown, pad } from "../lib/hooks";
import { cx, inr } from "../lib/format";
import ProductCard from "../components/ProductCard";
import LabCard from "../components/LabCard";
import { CategoryIcon } from "../components/icons";
import { SectionHeader, CardGridSkeleton } from "../components/ui/Feedback";
import Button from "../components/ui/Button";

/* ------------------------------------------------------------------ */
/* Hero carousel                                                       */
/* ------------------------------------------------------------------ */
const HERO_OVERLAY = {
  primary: "from-primary/95 via-primary/85 to-emerald-vibrant/40",
  teal: "from-teal-accent/95 via-teal-accent/85 to-primary/40",
  amber: "from-navy-deep/95 via-navy-deep/85 to-warning-amber/50",
};

function HeroCarousel() {
  const { data: banners } = useFetch(() => api.getBanners(), []);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = banners || [];
  const count = slides.length;

  const go = useCallback((n) => setIndex((i) => (count ? (n + count) % count : 0)), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 5500);
    return () => clearInterval(id);
  }, [paused, count]);

  if (!count) {
    return <div className="skeleton h-[440px] w-full rounded-3xl md:h-[480px]" />;
  }

  return (
    <div
      className="relative h-[460px] overflow-hidden rounded-3xl shadow-card md:h-[500px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          className={cx(
            "absolute inset-0 transition-opacity duration-700",
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={i !== index}
        >
          <img src={slide.image} alt="" className="h-full w-full object-cover" />
          <div className={cx("absolute inset-0 bg-gradient-to-r", HERO_OVERLAY[slide.accent] || HERO_OVERLAY.primary)} />
          <div className="absolute inset-0 flex items-center">
            <div className="container-max">
              <div className={cx("max-w-xl text-white", i === index && "animate-fade-up")}>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur">
                  {slide.eyebrow}
                  {slide.highlight && <span className="rounded-full bg-warning-amber px-2 py-0.5 text-navy-deep">{slide.highlight}</span>}
                </span>
                <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
                  {slide.title}
                </h1>
                <p className="mt-3 max-w-md text-sm text-white/90 sm:text-base">{slide.subtitle}</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button as={Link} to={slide.ctaLink} variant="amber" size="lg">
                    {slide.cta} <ArrowRight className="h-4 w-4" />
                  </Button>
                  {slide.coupon && (
                    <span className="rounded-full border border-dashed border-white/60 px-4 py-2 text-sm font-semibold">
                      Code <b>{slide.coupon}</b>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-5 flex items-center justify-between px-5 md:px-8">
        <div className="flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cx(
                "h-2 rounded-full transition-all",
                i === index ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
              )}
            />
          ))}
        </div>
        <div className="hidden gap-2 sm:flex">
          <button onClick={() => go(index - 1)} aria-label="Previous slide" className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/35">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => go(index + 1)} aria-label="Next slide" className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/35">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick-action bento                                                  */
/* ------------------------------------------------------------------ */
const TILE = {
  primary: "bg-primary/10 text-primary",
  teal: "bg-teal-accent/10 text-teal-accent",
  emerald: "bg-emerald-vibrant/10 text-emerald-vibrant",
  navy: "bg-navy-deep/10 text-navy-deep",
  amber: "bg-warning-amber/20 text-[#9a6a00]",
};

function QuickActions() {
  const { data: categories } = useFetch(() => api.getCategories(), []);
  const cats = categories || [];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cats.map((c, i) => (
        <Link
          key={c.id}
          to={c.to}
          className={cx(
            "card card-hover group flex items-center gap-4 p-4 sm:p-5",
            (i === 0 || i === 5) && "md:col-span-2"
          )}
        >
          <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-transform group-hover:scale-110", TILE[c.accent] || TILE.primary)}>
            <CategoryIcon name={c.icon} className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-bold text-on-surface">{c.label}</span>
            <span className="block truncate text-xs text-on-surface-variant">{c.caption}</span>
          </span>
          <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable horizontal rail                                            */
/* ------------------------------------------------------------------ */
function Rail({ items, render, itemClass = "w-[15rem]" }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <div className="group/rail relative">
      <div ref={ref} className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((item, i) => (
          <div key={item.id || i} className={cx("shrink-0 snap-start", itemClass)}>
            {render(item)}
          </div>
        ))}
      </div>
      {items.length > 3 && (
        <>
          <button
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="absolute -left-4 top-[42%] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-surface-container-lowest text-on-surface shadow-card-hover transition-opacity hover:text-primary lg:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="absolute -right-4 top-[42%] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-surface-container-lowest text-on-surface shadow-card-hover transition-opacity hover:text-primary lg:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flash sale                                                          */
/* ------------------------------------------------------------------ */
function CountdownPill({ endsAt }) {
  const { hours, minutes, seconds, done } = useCountdown(endsAt);
  if (!endsAt || done) return null;
  const Block = ({ v }) => (
    <span className="min-w-[2ch] rounded-lg bg-navy-deep px-1.5 py-1 text-center font-display text-sm font-bold tabular-nums text-white">
      {pad(v)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-amber/20 px-3 py-1.5">
      <Timer className="h-4 w-4 text-navy-deep" />
      <span className="text-xs font-bold text-navy-deep">Ends in</span>
      <Block v={hours} /><span className="font-bold text-navy-deep">:</span>
      <Block v={minutes} /><span className="font-bold text-navy-deep">:</span>
      <Block v={seconds} />
    </span>
  );
}

function FlashSale() {
  const { data: flash, loading } = useFetch(() => api.getFlashSale(), []);
  const items = flash?.items || [];

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-navy-deep to-[#0a4d5f] p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-warning-amber px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy-deep">
            <Zap className="h-4 w-4 fill-navy-deep" /> {flash?.title || "Flash Sale"}
          </span>
          <h2 className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">
            {flash?.subtitle || "Limited-time deals"}
          </h2>
        </div>
        <CountdownPill endsAt={flash?.endsAt} />
      </div>

      <div className="mt-6 rounded-2xl bg-surface-container-lowest/95 p-4">
        {loading ? (
          <CardGridSkeleton count={4} />
        ) : (
          <Rail items={items} render={(p) => <ProductCard product={p} />} itemClass="w-[15rem]" />
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Product rail section                                                */
/* ------------------------------------------------------------------ */
function ProductSection({ eyebrow, title, subtitle, to, fetcher }) {
  const { data, loading } = useFetch(fetcher, []);
  const items = (data || []).slice(0, 10);

  return (
    <section>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        action={
          <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="mt-6">
        {loading ? <CardGridSkeleton count={5} /> : <Rail items={items} render={(p) => <ProductCard product={p} />} itemClass="w-[15rem]" />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Lab packages                                                        */
/* ------------------------------------------------------------------ */
function LabSection() {
  const { data, loading } = useFetch(() => api.getLabTests({ sort: "popularity" }), []);
  const items = (data || []).filter((t) => t.bestseller).slice(0, 3);
  const show = items.length ? items : (data || []).slice(0, 3);

  return (
    <section>
      <SectionHeader
        eyebrow="Book a checkup"
        title="Popular lab packages"
        subtitle="NABL-accredited labs, free home sample collection and expert-reviewed reports."
        action={
          <Link to="/lab-tests" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? <CardGridSkeleton count={3} variant="lab" />
          : show.map((t) => <LabCard key={t.id} test={t} />)}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Wellness guides                                                     */
/* ------------------------------------------------------------------ */
function WellnessSection() {
  const { data } = useFetch(() => api.getWellness(), []);
  const guides = data || [];

  return (
    <section>
      <SectionHeader eyebrow="From the health desk" title="Wellness guides" subtitle="Expert-reviewed reads to help you live healthier." />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {guides.map((g) => (
          <Link key={g.id} to="/" className="card card-hover group flex flex-col overflow-hidden">
            <div className="aspect-[16/10] overflow-hidden">
              <img src={g.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-primary">
                <span>{g.category}</span>
                <span className="text-on-surface-variant">· {g.readTime}</span>
              </div>
              <h3 className="mt-2 line-clamp-2 font-display text-base font-bold leading-snug text-on-surface">{g.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-on-surface-variant">{g.excerpt}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Read more <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing CTA band                                                    */
/* ------------------------------------------------------------------ */
function CtaBand() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-vibrant p-7 text-white">
        <Upload className="absolute -right-4 -top-4 h-28 w-28 text-white/10" strokeWidth={1.5} />
        <h3 className="font-display text-2xl font-extrabold">Have a prescription?</h3>
        <p className="mt-2 max-w-sm text-sm text-white/90">Upload it and our pharmacists will build your order — reviewed within minutes.</p>
        <Button as={Link} to="/upload-prescription" variant="amber" size="md" className="mt-5">
          Upload prescription <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-accent to-navy-deep p-7 text-white">
        <Stethoscope className="absolute -right-4 -top-4 h-28 w-28 text-white/10" strokeWidth={1.5} />
        <h3 className="font-display text-2xl font-extrabold">Not sure what you need?</h3>
        <p className="mt-2 max-w-sm text-sm text-white/90">Talk to a certified doctor online in minutes — available 24×7 from ₹349.</p>
        <Button as={Link} to="/consult" variant="amber" size="md" className="mt-5">
          Consult a doctor <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
const PROMISES = [
  { icon: Truck, label: "Delivered in 30–90 min" },
  { icon: ShieldCheck, label: "100% genuine & sealed" },
  { icon: Clock, label: "24×7 pharmacist support" },
];

export default function Home() {
  return (
    <div className="container-max space-y-14 py-6 sm:py-8">
      <HeroCarousel />

      {/* promise strip */}
      <div className="-mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 rounded-2xl bg-surface-container-low px-4 py-3 text-sm">
        {PROMISES.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-2 font-semibold text-on-surface">
            <Icon className="h-4 w-4 text-primary" /> {label}
          </span>
        ))}
      </div>

      <QuickActions />
      <FlashSale />
      <ProductSection
        eyebrow="Everyday essentials"
        title="Popular medicines"
        subtitle="Fever, allergy, digestion & more — trusted brands at the best prices."
        to="/medicines"
        fetcher={() => api.getMedicines({ sort: "popularity" })}
      />
      <LabSection />
      <ProductSection
        eyebrow="Feel your best"
        title="Trending supplements"
        subtitle="Protein, vitamins and daily wellness picks loved by our customers."
        to="/supplements"
        fetcher={() => api.getSupplements({ sort: "rating" })}
      />
      <ProductSection
        eyebrow="For your little one"
        title="Baby food & nutrition"
        subtitle="Organic cereals, purees, meals and snacks — stage-based nutrition for every milestone."
        to="/baby-food"
        fetcher={() => api.getBabyFood({ sort: "rating" })}
      />
      <WellnessSection />
      <CtaBand />
    </div>
  );
}
