import { useListJourneys } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Map, ChevronRight } from 'lucide-react';

export default function JourneysList() {
  const { data: journeys, isLoading } = useListJourneys();

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Map className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Journeys
          </h1>
        </div>
        <p className="text-muted-foreground">Follow the footsteps of biblical figures across the ancient world.</p>
      </header>

      {isLoading ? (
        <div className="grid gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl bg-secondary/50 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {journeys?.map((journey) => (
            <Link
              key={journey.slug}
              href={`/journeys/${journey.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card hover-elevate transition-all flex flex-col min-h-[240px]"
            >
              {/* Background Map placeholder */}
              <div className="absolute inset-0 bg-secondary/30" style={{ backgroundImage: 'radial-gradient(circle at center, var(--color-primary) 0.5px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.1 }} />
              
              <div className="relative z-10 flex flex-1 flex-col p-8 justify-between">
                <div>
                  <div className="inline-flex items-center rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary mb-4 shadow-sm border border-border uppercase tracking-wider">
                    {journey.durationLabel} &bull; {journey.stopCount} stops
                  </div>
                  <h2 className="font-serif text-3xl font-medium text-foreground leading-tight mb-2">
                    {journey.title}
                  </h2>
                  <p className="text-muted-foreground line-clamp-2">{journey.subtitle}</p>
                </div>
                <div className="mt-8 flex items-center font-medium text-primary uppercase tracking-widest text-sm">
                  Start Journey
                  <ChevronRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-2" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
