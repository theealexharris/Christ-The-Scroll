import { Link } from 'wouter';
import { BookOpen } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center animate-in fade-in">
      <BookOpen className="h-12 w-12 text-muted-foreground mb-6" />
      <h1 className="font-serif text-4xl font-medium text-foreground mb-4">
        Page Not Found
      </h1>
      <p className="text-lg text-muted-foreground max-w-md mb-8">
        We could not find the passage or page you are looking for in The Scroll.
      </p>
      <Link
        href="/home"
        className="flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        Return Home
      </Link>
    </div>
  );
}
