export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventForm } from '@/components/event-form';

interface EditEventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect('/auth/login');

  const { data: event } = await supabase
    .from('events')
    .select('id, title, description, raid_name, scheduled_at, created_by')
    .eq('id', id)
    .single();

  if (!event) notFound();

  // 주최자만 수정 가능
  if (event.created_by !== authData.claims.sub) {
    redirect(`/events/${id}`);
  }

  return (
    <div className="flex justify-center">
      <EventForm
        eventId={event.id}
        initialValues={{
          title: event.title,
          description: event.description,
          raid_name: event.raid_name,
          scheduled_at: event.scheduled_at,
        }}
      />
    </div>
  );
}
