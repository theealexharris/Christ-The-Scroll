import { useGetTimeline } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Clock, ChevronRight } from 'lucide-react';

export default function Timeline() {
  const { data: events, isLoading } = useGetTimeline();

  return (
    <div className="flex flex-col p-6 md:p-10 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2 text-primary">
          <Clock className="h-6 w-6" />
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            The Timeline
          </h1>
        </div>
        <p className="text-lg text-muted-foreground leading-relaxed mt-4">
          The biblical story is a single, unfolding narrative. See how the events connect from Creation to the Early Church.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-8">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex gap-6">
              <div className="w-24 h-6 bg-secondary/50 rounded animate-pulse" />
              <div className="flex-1 h-32 bg-secondary/50 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative border-l-2 border-border/50 ml-4 md:ml-24 space-y-12 pb-12">
          {events?.map((event, i) => (
            <div key={event.slug} className="relative pl-8 md:pl-12">
              {/* Timeline dot */}
              <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background bg-primary shadow-sm" />
              
              {/* Period / Date Label */}
              <div className="absolute top-0.5 -left-20 md:-left-32 w-16 md:w-24 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:block">
                {event.dateLabel}
              </div>

              <Link 
                href={`/events/${event.slug}`}
                className="group block rounded-2xl border border-border bg-card p-6 shadow-sm hover-elevate transition-all"
              >
                <div className="sm:hidden text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                  {event.dateLabel} &bull; {event.period}
                </div>
                <div className="hidden sm:block text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                  {event.period}
                </div>
                <h3 className="font-serif text-2xl font-medium text-foreground group-hover:text-primary transition-colors mb-3">
                  {event.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {event.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-primary">
                  Explore event <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
