export type DrawVariant='list'|'wheel'|'egg'|'box'|'capsule'|'balloon'|'treasure'|'train';
export const drawGames:Record<DrawVariant,{name:string;description:string;background:string}>={
 list:{name:'幸运名单',description:'扫码入场，名字滚动热场，由主持人抽取并锁定中奖名单。',background:'/games/click/stage-bg-v1.png'},
 wheel:{name:'幸运大转盘',description:'巨型转盘旋转揭晓，服务端随机抽取，动画不决定概率。',background:'/games/click/carnival-bg-v1.png'},
 egg:{name:'欢乐砸金蛋',description:'中奖者点击手机砸蛋，或由主持人代揭晓；结果已提前锁定。',background:'/games/click/stage-bg-v1.png'},
 box:{name:'惊喜礼盒',description:'中奖者打开专属礼盒，揭晓本轮奖项；开盒动作不改变结果。',background:'/games/click/garden-bg-v1.png'},
 capsule:{name:'幸运扭蛋机',description:'彩色扭蛋翻滚，逐个揭晓服务端抽中的幸运来宾。',background:'/games/click/carnival-bg-v1.png'},
 balloon:{name:'星愿气球',description:'选择一句祝福，名字随气球登场，开奖后点亮中奖气球。',background:'/games/click/garden-bg-v1.png'},
 treasure:{name:'寻宝大冒险',description:'全场点击积累开箱能量，达标后主持人随机抽奖；贡献不增加个人概率。',background:'/games/race/illustrated/yacht-bg-v2.png'},
 train:{name:'幸运列车',description:'扫码获得虚拟车票，列车进站后，车厢逐一揭晓幸运乘客。',background:'/games/click/town-bg-v1.png'}
};
export const drawWishes=['心想事成','幸福同行','一路生花','好运常在'];
