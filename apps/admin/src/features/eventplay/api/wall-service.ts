import { liveRequest, ownerToken, playerSession } from './realtime';
import type { WallState } from './wall-games';
export function submitWall(id:string,data:{action:'profile'|'post'|'star';avatar?:number;city?:string;text?:string;photo?:string}){
 const player=playerSession(id);if(!player)throw new Error('请先加入活动');
 return liveRequest<{accepted:boolean}>(`/rooms/${id}/wall-action`,data,player.token);
}
export const wallAdminQuery=(id:string)=>({queryKey:['wall-admin',id],queryFn:()=>liveRequest<WallState>(`/rooms/${id}/wall-admin`,undefined,ownerToken(id)),refetchInterval:2000});
export const manageWall=(id:string,data:{action:string;id?:string;variant?:string})=>liveRequest<WallState>(`/rooms/${id}/wall-admin`,data,ownerToken(id));
