import { Link } from 'wouter';
import { Heart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListBookmarksQueryKey,
  useCreateBookmark,
  useDeleteBookmark,
  useListBookmarks,
  type BookmarkTargetType,
} from '@workspace/api-client-react';
import { useAuth } from '@/hooks/use-auth';

export function BookmarkButton({ targetType, targetRef, className }: { targetType: BookmarkTargetType; targetRef: string; className?: string }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: bookmarks } = useListBookmarks({ query: { enabled: isAuthenticated, queryKey: getListBookmarksQueryKey() } });
  const existing = bookmarks?.find((bookmark) => bookmark.targetType === targetType && bookmark.targetRef === targetRef);

  const createBookmark = useCreateBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries() } });
  const deleteBookmark = useDeleteBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries() } });

  const baseClass =
    className ??
    'flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary';

  if (!isAuthenticated) {
    return (
      <Link href="/login" className={baseClass} title="Sign in to bookmark">
        <Heart className="h-4 w-4" />
      </Link>
    );
  }

  const isPending = createBookmark.isPending || deleteBookmark.isPending;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => (existing ? deleteBookmark.mutate({ id: existing.id }) : createBookmark.mutate({ data: { targetType, targetRef } }))}
      className={`${baseClass} ${existing ? 'border-primary/40 bg-primary/10 text-primary' : ''} disabled:opacity-50`}
      title={existing ? 'Remove bookmark' : 'Bookmark this'}
    >
      <Heart className="h-4 w-4" fill={existing ? 'currentColor' : 'none'} />
    </button>
  );
}
