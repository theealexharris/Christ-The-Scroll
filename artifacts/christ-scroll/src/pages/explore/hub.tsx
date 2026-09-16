import { useState, useEffect } from 'react';
import { useListPeople, useListPlaces, useListEvents, useSearchContent } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Compass, Users, MapPin, Calendar, Clock, Search, BookOpen, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce'; // We'll create this

export default function ExploreHub() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const { data: people } = useListPeople();
  const { data: places } = useListPlaces();
  const { data: events } = useListEvents();
  
  const { data: searchResults, isLoading: isSearching } = useSearchContent(
    { q: debouncedSearch },
    { query: { enabled: debouncedSearch.length >= 2, queryKey: ['search', debouncedSearch] } }
  );

  const isSearchActive = debouncedSearch.length >= 2;

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Explore
          </h1>
        </div>
        <p className="text-muted-foreground">Discover the people, places, and events that shape the biblical narrative.</p>
      </header>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          type="search"
          placeholder="Search Scripture, people, places..."
          className="w-full h-14 pl-12 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}
      </div>

      {isSearchActive ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="font-serif text-2xl font-medium text-foreground border-b border-border pb-2">
            Search Results
          </h2>
          
          {!searchResults ? (
            <div className="text-center py-12 text-muted-foreground">Searching the scroll...</div>
          ) : (
            <div className="space-y-10">
              {searchResults.scripture?.length > 0 && (
                <SearchResultSection 
                  title="Scripture" 
                  icon={<BookOpen className="h-5 w-5" />} 
                  items={searchResults.scripture.map(s => ({
                    slug: `${s.bookSlug}/${s.chapter}#v${s.verse}`,
                    name: s.reference,
                    description: s.text,
                    path: '/bible'
                  }))} 
                />
              )}
              {searchResults.people?.length > 0 && (
                <SearchResultSection 
                  title="People" 
                  icon={<Users className="h-5 w-5" />} 
                  items={searchResults.people.map(p => ({
                    slug: p.slug, name: p.name, description: p.role, path: '/people'
                  }))} 
                />
              )}
              {searchResults.places?.length > 0 && (
                <SearchResultSection 
                  title="Places" 
                  icon={<MapPin className="h-5 w-5" />} 
                  items={searchResults.places.map(p => ({
                    slug: p.slug, name: p.name, description: p.region, path: '/places'
                  }))} 
                />
              )}
              {searchResults.events?.length > 0 && (
                <SearchResultSection 
                  title="Events" 
                  icon={<Calendar className="h-5 w-5" />} 
                  items={searchResults.events.map(e => ({
                    slug: e.slug, name: e.name, description: e.period, path: '/events'
                  }))} 
                />
              )}
              {(!searchResults.scripture?.length && !searchResults.people?.length && !searchResults.places?.length && !searchResults.events?.length) && (
                <div className="text-center py-12 text-muted-foreground">No results found for "{debouncedSearch}"</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top Level Nav */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link href="/timeline" className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 hover-elevate transition-all flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl font-medium text-foreground group-hover:text-primary transition-colors">The Timeline</h2>
                <Clock className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground">From Creation to Revelation, see the complete story unfold chronologically.</p>
            </Link>
            <Link href="/journeys" className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 hover-elevate transition-all flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl font-medium text-foreground group-hover:text-primary transition-colors">Guided Journeys</h2>
                <MapPin className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground">Walk with Jesus and others through interactive map-based stories.</p>
            </Link>
          </div>

          <div className="space-y-12">
            <ExploreSection 
              title="Key Figures" 
              icon={<Users className="h-5 w-5" />} 
              items={people?.slice(0, 4) || []} 
              basePath="/people" 
            />
            <ExploreSection 
              title="Important Places" 
              icon={<MapPin className="h-5 w-5" />} 
              items={places?.slice(0, 4) || []} 
              basePath="/places" 
            />
            <ExploreSection 
              title="Major Events" 
              icon={<Calendar className="h-5 w-5" />} 
              items={events?.slice(0, 4) || []} 
              basePath="/events" 
            />
          </div>
        </>
      )}
    </div>
  );
}

function SearchResultSection({ title, icon, items }: { title: string, icon: React.ReactNode, items: { slug: string, name: string, description: string, path: string }[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <h3 className="font-serif text-xl font-medium">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => (
          <Link
            key={item.slug}
            href={`${item.path}/${item.slug}`}
            className="flex flex-col rounded-xl border border-border bg-card p-4 hover-elevate transition-all"
          >
            <span className="font-serif text-lg font-medium text-foreground mb-1">{item.name}</span>
            <span className="text-sm text-muted-foreground line-clamp-2">{item.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ExploreSection({ title, icon, items, basePath }: { title: string, icon: React.ReactNode, items: any[], basePath: string }) {
  if (!items.length) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2 text-foreground">
          {icon}
          <h2 className="font-serif text-xl font-medium">{title}</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1,2,3,4].map(i => <div key={i} className="h-32 flex-1 rounded-xl bg-secondary/50 animate-pulse min-w-[200px]" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          <h2 className="font-serif text-xl font-medium">{title}</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <Link
            key={item.slug}
            href={`${basePath}/${item.slug}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-5 hover-elevate transition-all"
          >
            <h3 className="font-serif text-lg font-medium text-foreground group-hover:text-primary mb-1">
              {item.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.role || item.region || item.summary || item.period}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
