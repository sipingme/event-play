export type SocialVariant =
  | 'team'
  | 'interest'
  | 'match'
  | 'same'
  | 'bingo'
  | 'truth'
  | 'cards'
  | 'story'
  | 'praise';
export const socialGames: Record<
  SocialVariant,
  { name: string; description: string; background: string }
> = {
  team: {
    name: '随机组队',
    description: '自愿加入卡通营地，随机均衡分组，至少两位队友共同确认破冰任务。',
    background: '/games/click/garden-bg-v1.png'
  },
  interest: {
    name: '兴趣配对',
    description: '选择爱好，寻找同好；双方确认后建立连接，可随时退出。',
    background: '/games/race/illustrated/yacht-bg-v2.png'
  },
  match: {
    name: '默契问答',
    description: '与伙伴双向确认，独立回答三道题，全部提交后揭晓默契。',
    background: '/games/click/stage-bg-v1.png'
  },
  same: {
    name: '寻找同款',
    description: '领取秘密图案，通过交流寻找同款伙伴，双方确认才算配对。',
    background: '/games/click/carnival-bg-v1.png'
  },
  bingo: {
    name: '破冰宾果',
    description: '找到符合条件的不同伙伴，由对方确认，完成九宫格。',
    background: '/games/click/garden-bg-v1.png'
  },
  truth: {
    name: '两真一假',
    description: '提交三段经历，审核后让大家猜，主持人截止后统一揭晓。',
    background: '/games/click/stage-bg-v1.png'
  },
  cards: {
    name: '交换名片',
    description: '自愿填写交换信息，仅双方同意后私下可见，不上大屏。',
    background: '/games/click/town-bg-v1.png'
  },
  story: {
    name: '团队故事接龙',
    description: '按组轮流接一句话，审核通过后交给下一位，组成团队故事。',
    background: '/games/click/stage-bg-v1.png'
  },
  praise: {
    name: '夸夸接力',
    description: '向伙伴投递鼓励，对方接收且主持人审核后进入温暖祝福墙。',
    background: '/games/click/garden-bg-v1.png'
  }
};
export const socialInterests = [
  '露营',
  '阅读',
  '运动',
  '音乐',
  '旅行',
  '美食',
  '摄影',
  '电影',
  '宠物'
];
export const socialTasks = ['互相介绍昵称', '找到一个共同爱好', '一起想一个团队口号'];
export const socialQuestions = [
  { text: '周末更喜欢？', choices: ['户外活动', '室内放松'] },
  { text: '旅行更喜欢？', choices: ['提前规划', '随心出发'] },
  { text: '合作更喜欢？', choices: ['先讨论', '先尝试'] }
];
export const socialSymbols = ['小太阳', '小星星', '小爱心', '小花朵', '小月亮', '小叶子'];
export interface SocialPost {
  id: string;
  group: number;
  text: string;
  statements: string[];
  kind: string;
  lie?: number;
  status?: string;
}
export interface SocialState {
  participants: number;
  connections: number;
  groups: { index: number; members: number; tasks: boolean[]; sentences: number }[];
  interests: number[];
  posts: SocialPost[];
  closed: boolean;
  revealed: boolean;
  bingoCompleted: number;
}
export interface SocialRequest {
  id: string;
  kind: string;
  from: string;
  to: string;
  index: number;
  text: string;
  status: string;
  otherCode: string;
  contact?: string;
}
export interface SocialSelf {
  profile: {
    active: boolean;
    code: string;
    group: number;
    symbol: number;
    interests: number[];
    contact: string;
  } | null;
  playerId: string;
  requests: SocialRequest[];
  pairAnswers: {
    id: string;
    mine: Record<string, number>;
    ready: boolean;
    results: { question: string; choices: string[]; same: boolean; answers: number[] }[];
  } | null;
  bingo: string[];
  taskMine: number[];
  myTurn: boolean;
  posts: { id: string; status: string; text: string; statements: string[] }[];
  guessed: string[];
}
