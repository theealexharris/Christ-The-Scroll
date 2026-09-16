import { useParams, Link } from 'wouter';
import { useGetPerson } from '@workspace/api-client-react';
import { Users, ChevronLeft, MapPin, Calendar } from 'lucide-react';
import { BookmarkButton } from '@/components/bookmark-button';

export default function PersonDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: person, isLoading } = useGetPerson(slug || '');

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground animate-pulse">Loading figure...</div>;
  }

  if (!person) {
    return <div className="p-10 text-center text-destructive">Person not found</div>;
  }

  return (
    <div className="flex flex-col bg-background min-h-full">
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <Link href="/explore" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back to Explore
        </Link>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-8 w-8" />
          </div>
          <div>
            <h1 className="font-serif text-4xl font-medium text-foreground">{person.name}</h1>
            <p className="text-lg text-muted-foreground uppercase tracking-widest font-medium mt-1">{person.role}</p>
          </div>
          <BookmarkButton targetType="person" targetRef={slug || ''} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary" />
        </div>

        <div className="prose prose-lg dark:prose-invert font-serif text-foreground leading-relaxed mb-12">
          <p>{person.description}</p>
        </div>

        <div className="space-y-8">
          {person.events?.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-medium text-foreground border-b border-border pb-2 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Key Events
              </h2>
              <div className="space-y-3">
                {person.events.map(event => (
                  <Link key={event.slug} href={`/events/${event.slug}`} className="block p-4 rounded-xl border border-border bg-card hover-elevate transition-all">
                    <h3 className="font-serif text-lg font-medium">{event.name}</h3>
                    <p className="text-sm text-muted-foreground">{event.period}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {person.places?.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-medium text-foreground border-b border-border pb-2 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                Associated Places
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {person.places.map(place => (
                  <Link key={place.slug} href={`/places/${place.slug}`} className="flex flex-col p-4 rounded-xl border border-border bg-card hover-elevate transition-all">
                    <span className="font-serif text-lg font-medium">{place.name}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{place.region}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
