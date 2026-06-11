export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { EventsList } from '@/components/events-list';
import { getEvents, splitEvents } from '@/lib/queries';

export default async function EventsPage() {
  const supabase = await createClient();
  const [{ data }, events] = await Promise.all([
    supabase.auth.getClaims(),
    getEvents(),
  ]);

  const currentUserId = data?.claims?.sub ?? null;
  const { upcoming, past } = splitEvents(events);

  return (
    <EventsList
      upcoming={upcoming}
      past={past}
      currentUserId={currentUserId}
    />
  );
}
