'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LayoutDashboard, ShieldCheck, UserRound } from 'lucide-react';

/** Demo accounts for one-click quick login (UI redesign Phase 7). */
const demoAccounts = [
  { label: 'مدیر', email: 'admin@bpms.local', password: 'admin123', isAdmin: true },
  { label: 'جان', email: 'john@bpms.local', password: 'user123', isAdmin: false },
  { label: 'جین', email: 'jane@bpms.local', password: 'user123', isAdmin: false },
  { label: 'باب', email: 'bob@bpms.local', password: 'user123', isAdmin: false },
];

export function LoginView() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const doLogin = async (emailValue: string, passwordValue: string) => {
    setLoading(true);
    try {
      await login(emailValue, passwordValue);
      toast({ title: 'خوش آمدید', description: 'ورود موفقیت‌آمیز بود' });
    } catch (err: any) {
      toast({
        title: 'خطا',
        description: t.loginError,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  const handleQuickLogin = async (account: (typeof demoAccounts)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    await doLogin(account.email, account.password);
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4"
      dir="rtl"
    >
      {/* Indigo gradient wash + ambient blobs (MD3 expressive surface) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5 dark:from-primary/8 dark:via-transparent dark:to-primary/5" />
        <div className="absolute -top-32 -start-32 size-96 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10" />
        <div className="absolute -bottom-40 -end-24 size-[28rem] rounded-full bg-primary-container/40 blur-3xl dark:bg-primary/8" />
      </div>

      <Card className="relative w-full max-w-md rounded-[28px] border-border/60 shadow-elev-2">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-container shadow-elev-1">
            <LayoutDashboard className="size-7 text-on-primary-container" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">{t.loginTitle}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{t.loginSubtitle}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bpms.local"
                required
                dir="ltr"
                className="border-input/60 bg-muted/50 text-left focus-visible:bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
                className="border-input/60 bg-muted/50 text-left focus-visible:bg-card"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="ml-2 size-4 animate-spin" />}
              {t.login}
            </Button>
          </form>

          {/* One-click demo-account chips (Phase 7) */}
          <div className="mt-6 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              ورود سریع با حساب‌های آزمایشی
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin(account)}
                  className="state-layer md-ripple-host flex items-center gap-2.5 rounded-full border border-border/70 bg-card px-3 py-2 text-start transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                      account.isAdmin
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {account.isAdmin ? (
                      <ShieldCheck className="size-3.5" />
                    ) : (
                      <UserRound className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold leading-4">
                      {account.label}
                    </span>
                    <span className="block text-[10px] leading-3 text-muted-foreground" dir="ltr">
                      {account.email.split('@')[0]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
