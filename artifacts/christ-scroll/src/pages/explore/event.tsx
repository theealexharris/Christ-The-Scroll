import { useParams, Link } from 'wouter';
import { useGetEvent } from '@workspace/api-client-react';
import { Calendar, ChevronLeft, ArrowRight, ArrowLeft } from 'lucide-react';

export default function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: event, isLoading } = useGetEvent(slug || '');

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground animate-pulse">Loading event...</div>;
  }

  if (!event) {
    return <div className="p-10 text-center text-destructive">Event not found</div>;
  }

  return (
    <div className="flex flex-col bg-background min-h-full">
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <Link href="/timeline" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5 mr-1" />
          Timeline
        </Link>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Calendar className="h-8 w-8" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-primary mb-1">
              {event.period}
            </div>
            <h1 className="font-serif text-4xl font-medium text-foreground">{event.name}</h1>
          </div>
        </div>

        <div className="prose prose-lg dark:prose-invert font-serif text-foreground leading-relaxed mb-12 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <p className="m-0">{event.summary}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {event.before && (
            <Link href={`/events/${event.before}`} className="flex flex-col p-4 rounded-xl border border-border bg-secondary/20 hover-elevate transition-all group">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <ArrowLeft className="h-3 w-3" /> Previous Event
              </span>
              <span className="font-serif text-lg font-medium group-hover:text-primary">{event.before.replace(/-/g, ' ')}</span>
            </Link>
          )}
          {event.after && (
            <Link href={`/events/${event.after}`} className="flex flex-col p-4 rounded-xl border border-border bg-secondary/20 hover-elevate transition-all group text-right">
              <span className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Next Event <ArrowRight className="h-3 w-3" />
              </span>
              <span className="font-serif text-lg font-medium group-hover:text-primary">{event.after.replace(/-/g, ' ')}</span>
            </Link>
          )}
        </div>

      </main>
    </div>
  );
}
