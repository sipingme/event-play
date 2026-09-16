import { notFound } from 'next/navigation';
import { HostDesk, HostLobby, HostShell } from '@/features/eventplay/components/host';
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (path.length > 1) notFound();
  return (
    <HostShell key={path[0] ?? 'lobby'}>
      {path[0] ? <HostDesk id={path[0]} /> : <HostLobby />}
    </HostShell>
  );
}
