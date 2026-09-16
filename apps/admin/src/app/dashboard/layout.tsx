import { EventShell } from '@/features/eventplay/components/shell';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <EventShell>{children}</EventShell>;
}
