import { useListBooks } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { BookOpen } from 'lucide-react';
import { useMemo } from 'react';

export default function BibleBrowser() {
  const { data: books, isLoading } = useListBooks();

  const groupedBooks = useMemo(() => {
    if (!books) return null;
    const oldTestament = books.filter(b => b.testament === 'old');
    const newTestament = books.filter(b => b.testament === 'new');
    
    return {
      old: oldTestament,
      new: newTestament
    };
  }, [books]);

  if (isLoading || !groupedBooks) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
          <BookOpen className="h-8 w-8" />
          <p>Opening the Scroll...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 animate-in fade-in duration-500">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          The Library
        </h1>
        <p className="mt-2 text-muted-foreground">Select a book to begin reading.</p>
      </header>

      <div className="space-y-12">
        <TestamentSection title="Old Testament" books={groupedBooks.old} />
        <TestamentSection title="New Testament" books={groupedBooks.new} />
      </div>
    </div>
  );
}

function TestamentSection({ title, books }: { title: string, books: any[] }) {
  // Group by category if we want, but for simplicity, we'll display a grid
  return (
    <section className="space-y-6">
      <h2 className="font-serif text-2xl font-medium text-foreground border-b border-border pb-2">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/bible/${book.slug}/1`}
            className="flex flex-col rounded-xl border border-border bg-card p-4 text-center hover-elevate transition-all hover:border-primary/50 group"
          >
            <span className="font-medium text-foreground group-hover:text-primary transition-colors">
              {book.name}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {book.chapterCount} {book.chapterCount === 1 ? 'Chapter' : 'Chapters'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
