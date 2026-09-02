'use client';

import { Badge } from '@/components/ui/badge';
import { statusColors, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status?: string | null;
  className?: string;
}

/**
 * Render a colored badge for a status enum value (PENDING, RUNNING, etc.)
 * Falls back to a muted badge with the raw value if unknown.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn('bg-muted text-muted-foreground', className)}>
        {t.unknown}
      </Badge>
    );
  }
  const color = statusColors[status] ?? 'bg-muted text-muted-foreground';
  const label = (t as any)[status] ?? status;
  return (
    <Badge variant="outline" className={cn(color, 'border-transparent', className)}>
      {label}
    </Badge>
  );
}
