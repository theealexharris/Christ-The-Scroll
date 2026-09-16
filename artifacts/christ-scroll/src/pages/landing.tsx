import { Link } from 'wouter';
import { Book, ChevronRight } from 'lucide-react';

export default function Landing() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background selection:bg-primary/20">
      {/* Navbar */}
      <header className="flex h-16 items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-2">
          <Book className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">
            Christ: The Scroll
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign In
        </Link>
      </header>

      {/* Hero Section */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-12 px-6 py-12 md:flex-row md:items-center md:gap-16 md:px-12 md:py-0">
        <div className="max-w-xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 md:flex-1 md:text-left">
          <h1 className="font-serif text-5xl leading-[1.1] text-foreground md:text-6xl lg:text-7xl">
            The Living Word, <br />
            <span className="text-primary italic">Opened.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground md:mx-0 md:text-xl">
            Read Scripture as it was meant to be experienced—a connected story of people, places, events, and the journey of God with humanity.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row md:justify-start pt-4">
            <Link
              href="/onboarding"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
            >
              Begin Your Journey
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/home"
              className="flex h-12 items-center justify-center rounded-full border border-border bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Continue Reading
            </Link>
          </div>
        </div>

        {/* Hero portrait */}
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 fill-mode-both md:max-w-md md:flex-1">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-3xl border border-border shadow-2xl">
            <picture>
              <source srcSet="/hero-christ.webp" type="image/webp" />
              <img
                src="/hero-christ.jpg"
                alt="Jesus walking a path above the Sea of Galilee"
                className="h-full w-full object-cover"
                loading="eager"
                fetchPriority="high"
              />
            </picture>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
          </div>
        </div>
      </main>
    </div>
  );
}
