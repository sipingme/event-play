export type CreateVariant =
  | 'puzzle'
  | 'tree'
  | 'map'
  | 'draw'
  | 'stars'
  | 'city'
  | 'flowers'
  | 'scroll'
  | 'fireworks';
export const createGames: Record<
  CreateVariant,
  { name: string; description: string; background: string }
> = {
  puzzle: {
    name: '品牌拼图',
    description: '领取真实图块，对照原图找到位置，全场协作拼出品牌画面。',
    background: '/games/click/stage-bg-v1.png'
  },
  tree: {
    name: '共同种树',
    description: '播种、浇水与施肥各司其职，让全场共同种出一棵大树。',
    background: '/games/click/garden-bg-v1.png'
  },
  map: {
    name: '地图点亮',
    description: '选择来源城市，全场共同点亮城市星图；不采集定位。',
    background: '/games/race/illustrated/yacht-bg-v2.png'
  },
  draw: {
    name: '全场绘画',
    description: '绘制自己的小画布，审核后拼成一幅全场共创画卷。',
    background: '/games/click/garden-bg-v1.png'
  },
  stars: {
    name: '星河共创',
    description: '设计星星颜色和形状，写下祝福，合成一颗全场爱心星河。',
    background: '/games/race/illustrated/spaceship-bg-v2.png'
  },
  city: {
    name: '共筑品牌城',
    description: '选择建筑造型和颜色，为小镇添一栋属于你的建筑。',
    background: '/games/click/town-bg-v1.png'
  },
  flowers: {
    name: '花海共创',
    description: '选择花种与颜色，让每一份祝福开成全场花海。',
    background: '/games/click/garden-bg-v1.png'
  },
  scroll: {
    name: '祝福长卷',
    description: '用祝福、贴纸和手绘签名，共同完成一幅纪念长卷。',
    background: '/games/click/stage-bg-v1.png'
  },
  fireworks: {
    name: '共创烟花秀',
    description: '设计烟花颜色与形状，由主持人统一点火燃放。',
    background: '/games/race/illustrated/spaceship-bg-v2.png'
  }
};
export const creationColors = ['#ee806e', '#ffce62', '#68caa6', '#65bbed', '#b196e4', '#f2a5cc'];
export const creationCities = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '武汉',
  '西安',
  '南京',
  '重庆',
  '其他'
];
export interface CreationStroke {
  color: number;
  points: { x: number; y: number }[];
}
export interface CreationItem {
  id: string;
  color: number;
  shape: number;
  city: number;
  text: string;
  strokes: CreationStroke[];
  revision: number;
  status: 'pending' | 'approved' | 'hidden';
}
export interface CreationState {
  items: CreationItem[];
  pieces: number[];
  tree: Record<string, number>;
  treeStage: number;
  treeTarget: number;
  total: number;
  closed: boolean;
  launchedAt: number | null;
  serverTime: number;
}
