import { queryOptions } from '@tanstack/react-query';
import { getActivity, getBrand, getRoom, listActivities, listRooms } from './service';
export const eventKeys = { all: ['eventplay'] as const };
export const activitiesQuery = () =>
  queryOptions({ queryKey: [...eventKeys.all, 'activities'], queryFn: listActivities });
export const activityQuery = (id: string) =>
  queryOptions({ queryKey: [...eventKeys.all, 'activity', id], queryFn: () => getActivity(id) });
export const roomsQuery = () =>
  queryOptions({ queryKey: [...eventKeys.all, 'rooms'], queryFn: listRooms });
export const roomQuery = (id: string) =>
  queryOptions({
    queryKey: [...eventKeys.all, 'room', id],
    queryFn: () => getRoom(id),
    refetchInterval: 1000
  });
export const brandQuery = () =>
  queryOptions({ queryKey: [...eventKeys.all, 'brand'], queryFn: getBrand });
