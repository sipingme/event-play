export type VoteVariant='poll'|'score'|'support'|'product'|'stance'|'proposal'|'satisfaction'|'story'|'bracket';
export const defaultStory=JSON.stringify({start:{title:'品牌探险：先去哪里？',choices:[{label:'森林工坊',next:'forest'},{label:'海岛展台',next:'island'}]},forest:{title:'如何打造新产品？',choices:[{label:'绿色材料',next:'green'},{label:'智慧设计',next:'smart'}]},island:{title:'如何分享发现？',choices:[{label:'现场体验',next:'green'},{label:'线上共创',next:'smart'}]},green:{title:'绿色未来：全场选择了可持续之路',choices:[]},smart:{title:'智慧未来：全场选择了共创之路',choices:[]}},null,2);
export const voteGames:Record<VoteVariant,{name:string;description:string;options:string;background:string;symbol:string}>={
 poll:{name:'全民投票站',description:'每人每轮选择一项，由主持人截止与揭晓。',options:'方案A\n方案B\n方案C\n方案D',background:'/games/click/stage-bg-v1.png',symbol:'▣'},
 score:{name:'节目评分秀',description:'每人对每个节目评分1～5分，截止后展示平均分和评分人数。',options:'开场舞\n歌曲串烧\n魔术表演\n团队小品',background:'/games/click/stage-bg-v1.png',symbol:'★'},
 support:{name:'人气应援榜',description:'每轮支持一支队伍，实时展示人气，不支持无限点击刷票。',options:'阳光队\n追风队\n星光队\n梦想队',background:'/games/race/stadium-cartoon-v2.png',symbol:'⚑'},
 product:{name:'新品心动榜',description:'查看主办方配置的产品图片，投出心动一票。',options:'花园模型\n星际模型\n城市模型\n游艇模型',background:'/games/click/garden-bg-v1.png',symbol:'♥'},
 stance:{name:'左右观点站',description:'两种观点二选一，票数驱动天平倾斜。',options:'支持创新尝试\n支持稳步推进',background:'/games/click/stage-bg-v1.png',symbol:'⚖'},
 proposal:{name:'创意提案赛',description:'为每份提案打1～5分，按平均分展示并保留样本人数。',options:'绿色展会\n智慧服务\n社区共创\n品牌体验',background:'/games/click/town-bg-v1.png',symbol:'✦'},
 satisfaction:{name:'现场满意度',description:'五档评价表达体验，显示人数与分布，不伪造满意率。',options:'非常满意\n满意\n一般\n不满意\n非常不满意',background:'/games/click/garden-bg-v1.png',symbol:'☺'},
 story:{name:'全场选剧情',description:'投票决定下一幕；获胜分支进入对应剧情，最终到达不同结局。',options:'森林工坊\n海岛展台',background:'/games/race/illustrated/yacht-bg-v2.png',symbol:'⌘'},
 bracket:{name:'人气淘汰赛',description:'两两投票，胜者晋级；平票需要加赛，直至决出冠军。',options:'阳光队\n追风队\n星光队\n梦想队',background:'/games/race/stadium-cartoon-v2.png',symbol:'♛'}
};
export interface VoteResult{label:string;count:number;total:number}
