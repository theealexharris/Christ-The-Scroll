import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useRegister } from '@workspace/api-client-react';
import { Book } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    register.mutate(
      { data: { email, password } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries();
          setLocation('/home');
        },
      },
    );
  };

  const errorMessage = register.isError
    ? register.error.status === 409
      ? 'An account with that email already exists.'
      : 'Please enter a valid email and a password of at least 8 characters.'
    : null;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Book className="h-7 w-7 text-primary" />
          <h1 className="font-serif text-3xl font-medium text-foreground">Create your account</h1>
          <p className="text-muted-foreground">Save your progress, bookmarks, and reading plan.</p>
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
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <button
            type="submit"
            disabled={register.isPending}
            className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {register.isPending ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
