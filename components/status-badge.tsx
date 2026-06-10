import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, HelpCircle, Clock, Ban } from 'lucide-react';

// ——————————————————————————————
// 응답 상태 뱃지
// ——————————————————————————————
type ResponseStatus = 'attending' | 'declined' | 'undecided';

const RESPONSE_CONFIG: Record<
  ResponseStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  attending: {
    label: '참석',
    variant: 'default',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  declined: {
    label: '불참',
    variant: 'destructive',
    icon: <XCircle className="w-3 h-3" />,
  },
  undecided: {
    label: '미정',
    variant: 'secondary',
    icon: <HelpCircle className="w-3 h-3" />,
  },
};

export function ResponseStatusBadge({ status }: { status: ResponseStatus }) {
  const config = RESPONSE_CONFIG[status];
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ——————————————————————————————
// 이벤트 상태 뱃지
// ——————————————————————————————
type EventStatus = 'scheduled' | 'cancelled' | 'done';

const EVENT_CONFIG: Record<
  EventStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  scheduled: {
    label: '예정',
    variant: 'default',
    icon: <Clock className="w-3 h-3" />,
  },
  done: {
    label: '완료',
    variant: 'secondary',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  cancelled: {
    label: '취소',
    variant: 'destructive',
    icon: <Ban className="w-3 h-3" />,
  },
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const config = EVENT_CONFIG[status];
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}
