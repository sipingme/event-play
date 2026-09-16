import { notFound } from 'next/navigation';
import { LivePage } from '@/features/eventplay/components/realtime';
import { EventPortal } from '@/features/eventplay/components/event-portal';
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const [mode, id] = path;
  if (path.length === 2 && ['event', 'event-screen'].includes(mode)) return <EventPortal id={id} mode={mode === 'event' ? 'play' : 'screen'} />;
  if (path.length !== 2 || !['host', 'play', 'screen'].includes(mode)) notFound();
  return <LivePage key={`${mode}-${id}`} id={id} mode={mode as 'host' | 'play' | 'screen'} />;
}
