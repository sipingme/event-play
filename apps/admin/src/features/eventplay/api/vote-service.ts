import {liveRequest,playerSession,ownerToken} from './realtime';
function token(id:string){const p=playerSession(id);if(!p)throw new Error('请先加入活动');return p.token;}
export const sendBallot=(id:string,round:number,choice:number,score=1)=>liveRequest(`/rooms/${id}/ballot`,{round,choice,score},token(id));
export const voteSelfQuery=(id:string)=>({queryKey:['vote-self',id],queryFn:()=>liveRequest<{round:number;ballot:Record<string,number>}>(`/rooms/${id}/vote-self`,undefined,token(id)),refetchInterval:1000});
export const voteCommand=(id:string,round:number,action:string)=>liveRequest(`/rooms/${id}/vote-command`,{round,action},ownerToken(id));
