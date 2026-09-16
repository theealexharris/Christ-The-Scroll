import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useLogin } from '@workspace/api-client-react';
import { Book } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(
      { data: { email, password } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries();
          setLocation('/home');
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Book className="h-7 w-7 text-primary" />
          <h1 className="font-serif text-3xl font-medium text-foreground">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to sync your progress and bookmarks.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {login.isError && <p className="text-sm text-destructive">Invalid email or password.</p>}

          <button
            type="submit"
            disabled={login.isPending}
            className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {login.isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
        <p className="text-center text-sm">
          <Link href="/home" className="text-muted-foreground hover:text-foreground">
            Continue as a guest
          </Link>
        </p>
      </div>
    </div>
  );
}
