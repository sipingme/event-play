import { liveRequest, playerSession, ownerToken } from './realtime';
import type { SocialSelf, SocialPost } from './social-games';
export interface SocialInput {
  action: string;
  id?: string;
  code?: string;
  interests?: number[];
  contact?: string;
  text?: string;
  index?: number;
  choice?: number;
  statements?: string[];
}
function token(id: string) {
  const p = playerSession(id);
  if (!p) throw new Error('请先加入活动');
  return p.token;
}
export const sendSocial = (id: string, body: SocialInput) =>
  liveRequest('/rooms/' + id + '/social-action', body, token(id));
export const socialSelfQuery = (id: string) => ({
  queryKey: ['social-self', id],
  queryFn: () => liveRequest<SocialSelf>('/rooms/' + id + '/social-self', undefined, token(id)),
  refetchInterval: 1000
});
export const socialAdminQuery = (id: string) => ({
  queryKey: ['social-admin', id],
  queryFn: () =>
    liveRequest<{ posts: SocialPost[]; closed: boolean; revealed: boolean }>(
      '/rooms/' + id + '/social-admin',
      undefined,
      ownerToken(id)
    ),
  refetchInterval: 1500
});
export const manageSocial = (id: string, action: string, postId?: string) =>
  liveRequest('/rooms/' + id + '/social-admin', { action, id: postId }, ownerToken(id));
