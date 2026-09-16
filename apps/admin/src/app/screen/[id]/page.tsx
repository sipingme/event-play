import { Control } from '@/features/eventplay/components/live';
import { ClientReady } from '@/features/eventplay/components/shell';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ClientReady>
      <Control id={id} screen />
    </ClientReady>
  );
}
