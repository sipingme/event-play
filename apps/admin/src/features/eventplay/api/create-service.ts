import { liveRequest, playerSession, ownerToken } from './realtime';
import type { CreationItem, CreationStroke } from './create-games';
function token(id: string) {
  const p = playerSession(id);
  if (!p) throw new Error('请先加入活动');
  return p.token;
}
export interface CreationInput {
  action: string;
  slot?: number;
  color?: number;
  shape?: number;
  city?: number;
  text?: string;
  strokes?: CreationStroke[];
}
export const sendCreation = (id: string, body: CreationInput) =>
  liveRequest('/rooms/' + id + '/create-action', body, token(id));
export const creationSelfQuery = (id: string) => ({
  queryKey: ['create-self', id],
  queryFn: () =>
    liveRequest<{
      item: CreationItem | null;
      tree: string[];
      lease: { piece: number; until: number } | null;
    }>('/rooms/' + id + '/create-self', undefined, token(id)),
  refetchInterval: 1000
});
export const creationAdminQuery = (id: string) => ({
  queryKey: ['create-admin', id],
  queryFn: () =>
    liveRequest<{
      items: Record<string, CreationItem>;
      closed: boolean;
      launchedAt: number | null;
    }>('/rooms/' + id + '/create-admin', undefined, ownerToken(id)),
  refetchInterval: 1500
});
export const manageCreation = (id: string, action: string, item?: CreationItem) =>
  liveRequest(
    '/rooms/' + id + '/create-admin',
    { action, id: item?.id, revision: item?.revision },
    ownerToken(id)
  );
