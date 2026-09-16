import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { useGetChapter, useGetVerseExploration, useExplainPassage, useUpdateProgress, type Verse as VerseModel } from '@workspace/api-client-react';
import { ChevronLeft, ChevronRight, Sparkles, BookOpen, Compass } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { BookmarkButton } from '@/components/bookmark-button';

export default function Reader() {
  const params = useParams();
  const bookSlug = params.bookSlug || 'genesis';
  const chapter = parseInt(params.chapter || '1', 10);
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<'flow' | 'discovery'>('flow');

  const { data, isLoading, error } = useGetChapter(bookSlug, chapter);
  const updateProgress = useUpdateProgress();

  useEffect(() => {
    if (!data) return;
    const percent = Math.min(100, Math.round((chapter / data.book.chapterCount) * 100));
    updateProgress.mutate({
      data: { bookSlug, chapter, verse: data.verses[0]?.verse ?? 1, percent, lastReference: `${data.book.name} ${chapter}` },
    });
    // Only re-record progress when the chapter actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.book.slug, chapter]);

  const handlePrev = () => {
    if (chapter > 1) {
      setLocation(`/bible/${bookSlug}/${chapter - 1}`);
      window.scrollTo(0, 0);
    }
  };

  const handleNext = () => {
    // Ideally we'd check max chapter
    setLocation(`/bible/${bookSlug}/${chapter + 1}`);
    window.scrollTo(0, 0);
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <BookOpen className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[80vh]">
        <p className="text-destructive font-medium mb-2">Failed to load chapter</p>
        <Link href="/bible" className="text-primary hover:underline">Return to Library</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-full">
      {/* Sticky Reader Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <Link href="/bible" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5 mr-1" />
          Library
        </Link>
        <div className="font-serif text-lg font-medium">
          {data.book.name} {data.chapter}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'flow' ? 'discovery' : 'flow')}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${mode === 'discovery' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
            title="Toggle Discovery Mode"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Reader Content */}
      <main className="flex-1 px-6 py-12 md:px-16 lg:px-24 mx-auto max-w-3xl w-full">
        <div className="prose prose-lg md:prose-xl dark:prose-invert font-serif text-foreground leading-relaxed w-full max-w-none">
          {mode === 'discovery' && (
            <div className="mb-8 rounded-lg bg-primary/5 p-4 border border-primary/10 text-sm text-primary flex items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0 mt-0.5" />
              <p>
                <strong>Discovery Mode Active.</strong> Tap on verses to explore people, places, and historical context.
              </p>
            </div>
          )}

          {/* Verses rendering */}
          {data.verses.map((v) => (
            <Verse
              key={v.id}
              verse={v}
              isDiscovery={mode === 'discovery'}
            />
          ))}
        </div>

        {/* Navigation Footer */}
        <div className="mt-16 flex items-center justify-between border-t border-border pt-8 pb-12">
          <button
            onClick={handlePrev}
            disabled={chapter === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm font-medium transition-colors hover:bg-secondary"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}

function Verse({ verse, isDiscovery }: { verse: VerseModel; isDiscovery: boolean }) {
  const [open, setOpen] = useState(false);

  if (!isDiscovery) {
    return (
      <span className="mr-1">
        <sup className="mr-1 text-[0.6em] font-sans text-muted-foreground select-none">{verse.verse}</sup>
        {verse.text}
      </span>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <span className="mr-1 cursor-pointer rounded transition-colors hover:bg-primary/10 hover:text-primary active:bg-primary/20 p-0.5 -m-0.5">
          <sup className="mr-1 text-[0.6em] font-sans text-muted-foreground select-none">{verse.verse}</sup>
          {verse.text}
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-background p-6 shadow-2xl animate-in slide-in-from-bottom-full md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:rounded-2xl md:border">
          <div className="flex flex-col gap-4">
            <div className="mx-auto h-1 w-12 rounded-full bg-border md:hidden" />
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="font-serif text-xl font-medium">{verse.reference}</h3>
              <div className="flex items-center gap-2">
                <BookmarkButton targetType="verse" targetRef={verse.id} />
                <Dialog.Close className="rounded-full p-2 hover:bg-secondary">
                  <span className="sr-only">Close</span>
                  <ChevronRight className="h-5 w-5 rotate-90 md:rotate-0" />
                </Dialog.Close>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Scripture</div>
              <div className="font-serif text-lg leading-relaxed">{verse.text}</div>
            </div>

            <UnderstandThis verse={verse} />
            <ExploreVerse verseId={verse.id} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UnderstandThis({ verse }: { verse: VerseModel }) {
  const explain = useExplainPassage();

  if (!explain.data && !explain.isPending) {
    return (
      <button
        onClick={() => explain.mutate({ data: { verseId: verse.id, passage: verse.text, reference: verse.reference } })}
        className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <Sparkles className="h-4 w-4" />
        Understand This
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-card p-4 border border-border space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
        <Sparkles className="h-4 w-4" />
        AI-Assisted Explanation — not Scripture
      </div>
      {explain.isPending ? (
        <p className="text-sm text-muted-foreground animate-pulse">Thinking it through…</p>
      ) : (
        <>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">In Simple Words</div>
            <p className="text-sm leading-relaxed">{explain.data!.simpleWords}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Why It Matters</div>
            <p className="text-sm leading-relaxed">{explain.data!.whyItMatters}</p>
          </div>
        </>
      )}
    </div>
  );
}

function ExploreVerse({ verseId }: { verseId: string }) {
  const { data, isLoading } = useGetVerseExploration(verseId);

  if (isLoading) return <p className="text-sm text-muted-foreground animate-pulse">Loading connections…</p>;
  if (!data) return null;

  const hasAny = data.people.length > 0 || data.places.length > 0 || data.events.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Compass className="h-4 w-4" />
        Explore
      </div>
      {data.people.length > 0 && (
        <ChipRow label="Who?" items={data.people.map((p) => ({ label: p.name, href: `/people/${p.slug}` }))} />
      )}
      {data.places.length > 0 && (
        <ChipRow label="Where?" items={data.places.map((p) => ({ label: p.name, href: `/places/${p.slug}` }))} />
      )}
      {data.events.length > 0 && (
        <ChipRow label="What happened?" items={data.events.map((e) => ({ label: e.name, href: `/events/${e.slug}` }))} />
      )}
      {data.afterEvent && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">What Happens Next</div>
          <p className="text-sm text-muted-foreground">{data.afterEvent}</p>
        </div>
      )}
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex h-7 items-center rounded-full bg-secondary/60 px-3 text-xs font-medium hover:bg-secondary"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
