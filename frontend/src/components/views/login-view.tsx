'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LayoutDashboard } from 'lucide-react';

export function LoginView() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center mx-auto">
            <LayoutDashboard className="w-7 h-7 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">{t.loginTitle}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">{t.loginSubtitle}</p>
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
                className="text-left"
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
                className="text-left"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {t.login}
            </Button>
          </form>
          <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
            <p className="font-medium">حساب‌های آزمایشی:</p>
            <p dir="ltr" className="text-left">admin@bpms.local / admin123</p>
            <p dir="ltr" className="text-left">john@bpms.local / user123</p>
            <p dir="ltr" className="text-left">jane@bpms.local / user123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
