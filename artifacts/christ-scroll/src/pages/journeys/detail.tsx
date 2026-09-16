import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { useGetJourney, useSetJourneyProgress } from '@workspace/api-client-react';
import { ChevronLeft, MapPin, ArrowRight, ArrowLeft } from 'lucide-react';

export default function JourneyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: journey, isLoading } = useGetJourney(slug || '');
  const [currentStopIndex, setCurrentStopIndexState] = useState(0);
  const setJourneyProgress = useSetJourneyProgress();

  const setCurrentStopIndex = (updater: (i: number) => number) => {
    setCurrentStopIndexState((prev) => {
      const next = updater(prev);
      if (slug) setJourneyProgress.mutate({ slug, data: { currentStopIndex: next } });
      return next;
    });
  };

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground animate-pulse">Loading journey...</div>;
  }

  if (!journey) {
    return <div className="p-10 text-center text-destructive">Journey not found</div>;
  }

  const stop = journey.stops[currentStopIndex];

  return (
    <div className="flex flex-col bg-background min-h-full">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <Link href="/journeys" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5 mr-1" />
          Journeys
        </Link>
        <div className="text-sm font-medium">
          {currentStopIndex + 1} of {journey.stops.length}
        </div>
        <div className="w-16" /> {/* spacer for center alignment */}
      </header>

      <main className="flex flex-1 flex-col md:flex-row">
        {/* Map Panel */}
        <div className="flex-1 min-h-[30vh] bg-secondary/30 relative border-b md:border-b-0 md:border-r border-border overflow-hidden flex flex-col">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, var(--color-primary) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          
          <div className="p-6 md:p-10 relative z-10">
            <h1 className="font-serif text-3xl font-medium mb-2">{journey.title}</h1>
            <p className="text-muted-foreground">{journey.subtitle}</p>
          </div>

          <div className="flex-1 flex items-center justify-center relative z-10 p-6">
             <div className="animate-in zoom-in duration-500 flex flex-col items-center">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 shadow-sm border border-primary/20">
                  <MapPin className="h-8 w-8" />
                </div>
                <div className="bg-background/90 backdrop-blur px-4 py-2 rounded-xl shadow-sm border border-border text-center">
                  <p className="font-serif font-medium">{stop.location}</p>
                  <Link href={`/places/${stop.placeSlug}`} className="text-xs text-primary hover:underline">View Place</Link>
                </div>
             </div>
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 flex flex-col bg-background relative max-w-2xl mx-auto w-full">
          <div className="flex-1 p-6 md:p-10 overflow-y-auto">
            <div className="animate-in fade-in slide-in-from-right-8 duration-500" key={currentStopIndex}>
              <div className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
                Stop {currentStopIndex + 1}
              </div>
              <h2 className="font-serif text-3xl font-medium text-foreground mb-6">
                {stop.title}
              </h2>
              
              <div className="prose prose-lg dark:prose-invert font-serif leading-relaxed text-foreground mb-10">
                <p>{stop.description}</p>
              </div>

              {stop.scriptureReferences?.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <h3 className="font-serif text-lg font-medium border-b border-border pb-2 mb-4">Related Scripture</h3>
                  <div className="flex flex-wrap gap-2">
                    {stop.scriptureReferences.map((ref, i) => (
                      <span key={i} className="inline-flex items-center rounded-lg bg-secondary/50 px-3 py-1.5 text-sm font-medium">
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="p-6 border-t border-border bg-background flex items-center justify-between">
            <button
              onClick={() => setCurrentStopIndex(i => Math.max(0, i - 1))}
              disabled={currentStopIndex === 0}
              className="flex items-center gap-2 px-4 py-3 rounded-full border border-border bg-card font-medium transition-colors hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Previous Stop</span>
            </button>
            <button
              onClick={() => setCurrentStopIndex(i => Math.min(journey.stops.length - 1, i + 1))}
              disabled={currentStopIndex === journey.stops.length - 1}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Next Stop</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
