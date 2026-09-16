import { notFound, redirect } from 'next/navigation';
import { Workspace, Activities, Templates } from '@/features/eventplay/components/workspace';
import { NewActivity, EditActivity } from '@/features/eventplay/components/editor';
import { Publish, Reports } from '@/features/eventplay/components/live';
import { Brands, Settings } from '@/features/eventplay/components/settings';
export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ activity?: string }>;
}) {
  const { path = [] } = await params;
  if (!path.length) return <Workspace />;
  if (path.length === 1) {
    switch (path[0]) {
      case 'activities':
        return <Activities />;
      case 'templates':
        return <Templates />;
      case 'brands':
        return <Brands />;
      case 'settings':
        return <Settings />;
      case 'reports':
        return <Reports activityId={(await searchParams).activity} />;
    }
  }
  if (path[0] === 'activities' && path[1] === 'new' && path.length === 2) return <NewActivity />;
  if (path[0] === 'activities' && path.length === 3) {
    if (path[2] === 'edit') return <EditActivity id={path[1]} />;
    if (path[2] === 'publish') return <Publish id={path[1]} />;
  }
  if (path[0] === 'rooms' && path[2] === 'control' && path.length === 3)
    redirect(`/host/${path[1]}`);
  notFound();
}
