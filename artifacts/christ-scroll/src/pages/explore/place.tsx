import { useParams, Link } from 'wouter';
import { useGetPlace } from '@workspace/api-client-react';
import { MapPin, ChevronLeft, Map as MapIcon } from 'lucide-react';
import { BookmarkButton } from '@/components/bookmark-button';

export default function PlaceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: place, isLoading } = useGetPlace(slug || '');

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground animate-pulse">Locating place...</div>;
  }

  if (!place) {
    return <div className="p-10 text-center text-destructive">Place not found</div>;
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
        {/* Map Treatment Placeholder */}
        <div className="w-full h-48 md:h-64 rounded-3xl bg-secondary/30 mb-8 flex flex-col items-center justify-center text-muted-foreground border border-border relative overflow-hidden">
           <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
           <MapIcon className="h-10 w-10 mb-2 opacity-50" />
           <span className="text-sm font-medium tracking-widest uppercase">Historical Map Context</span>
           <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-mono border border-border shadow-sm">
             {place.latitude.toFixed(4)}° N, {place.longitude.toFixed(4)}° E
           </div>
        </div>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
              {place.region} &bull; {place.confidence} location
            </div>
            <h1 className="font-serif text-4xl font-medium text-foreground mb-1">{place.name}</h1>
            {place.ancientName && place.ancientName !== place.name && (
              <p className="text-lg text-muted-foreground italic">Anciently known as {place.ancientName}</p>
            )}
          </div>
          <BookmarkButton targetType="place" targetRef={slug || ''} />
        </div>

        <div className="prose prose-lg dark:prose-invert font-serif text-foreground leading-relaxed mb-12">
          <p>{place.historicalNotes}</p>
        </div>
      </main>
    </div>
  );
}
