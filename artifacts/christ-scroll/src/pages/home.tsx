import { Link } from 'wouter';
import { useListJourneys } from '@workspace/api-client-react';
import { BookOpen, ArrowRight, Sun, Moon } from 'lucide-react';

export default function Home() {
  const { data: journeys, isLoading } = useListJourneys();

  // Mock progress since we don't have real user data yet
  const recentReading = {
    bookSlug: 'john',
    bookName: 'John',
    chapter: 1,
    percent: 15,
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10 animate-in fade-in duration-500">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Good Morning
          </p>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Seek and you will find.
          </h1>
        </div>
      </header>

      {/* Continue Reading */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Continue Reading</h2>
        <Link
          href={`/bible/${recentReading.bookSlug}/${recentReading.chapter}`}
          className="group block overflow-hidden rounded-2xl border border-border bg-card p-1 hover-elevate transition-all"
        >
          <div className="relative overflow-hidden rounded-xl bg-secondary/50 p-6 md:p-8">
            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <BookOpen className="h-4 w-4" />
                  Gospel
                </div>
                <h3 className="font-serif text-2xl font-medium text-foreground">
                  {recentReading.bookName} {recentReading.chapter}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-primary shadow-sm transition-transform group-hover:scale-110">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
            {/* Progress bar */}
            <div className="relative z-10 mt-8 h-1.5 w-full overflow-hidden rounded-full bg-background/50">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${recentReading.percent}%` }}
              />
            </div>
          </div>
        </Link>
      </section>

      {/* Recommended Journeys */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Guided Journeys</h2>
          <Link href="/journeys" className="text-sm font-medium text-primary hover:underline">
            View All
          </Link>
        </div>
        
        {isLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 min-w-[280px] flex-1 rounded-2xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
            {journeys?.slice(0, 3).map((journey) => (
              <Link
                key={journey.slug}
                href={`/journeys/${journey.slug}`}
                className="group flex h-48 min-w-[280px] flex-1 flex-col justify-end overflow-hidden rounded-2xl bg-card p-5 relative border border-border shadow-sm hover-elevate transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                {/* Fallback pattern background */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary via-background to-background group-hover:scale-105 transition-transform duration-700" />
                
                <div className="relative z-20 text-white">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/80 mb-1">
                    {journey.durationLabel}
                  </p>
                  <h3 className="font-serif text-xl font-medium leading-tight">
                    {journey.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
