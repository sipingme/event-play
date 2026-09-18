const illustrated='/games/race/illustrated/';
export const controlGames={
  coins:{name:'接住好运',description:'左右移动篮子，金币 +1，炸弹 -1，最低 0 分。',asset:'/games/control/basket-v1.png',background:'/games/money/wealth-plaza-v2.png'},
  runner:{name:'萌宠跑酷',description:'左右换道收星，跳跃越过障碍；收星 +2，安全通过 +1，撞障碍 -1；跳跃需隔一波冷却。',asset:'/games/control/pet-v1.png',background:'/games/click/town-bg-v1.png'},
  space:{name:'太空护航',description:'左右驾驶飞船，自动射击同轨敌机 +2，碰陨石 -1。',asset:illustrated+'spaceship-sprite-v2.png',background:illustrated+'spaceship-bg-v2.png'},
  ski:{name:'极速滑雪',description:'左右转向穿过旗门 +2，避开雪道障碍，碰撞 -1。',asset:illustrated+'penguin-sprite-v2.png',background:illustrated+'penguin-bg-v2.png'},
  boat:{name:'小船寻宝',description:'左右选航道，收集宝箱 +2，碰到礁石 -1。',asset:illustrated+'yacht-sprite-v2.png',background:illustrated+'yacht-bg-v2.png'},
  parking:{name:'欢乐停车场',description:'左右转向、前进后退；绕开障碍，车头朝上停入 P 位 +5。',asset:illustrated+'car-sprite-v2.png',background:illustrated+'car-bg-v2.png'},
  maze:{name:'迷宫寻宝',description:'四向移动，先拿右下角钥匙，再到右上角出口 +5。',asset:'/games/control/pet-v1.png',background:'/games/click/forest-bg-v1.png'},
  balance:{name:'平衡小球',description:'方向控制小球，同方向连续操作滑行两格；刹车清除惯性。到终点 +5，落洞或越界 -1。',asset:'',background:'/games/click/garden-bg-v1.png'}
} as const;
export type ControlVariant=keyof typeof controlGames;
export type ControlDirection='left'|'right'|'up'|'down'|'forward'|'back'|'jump'|'brake';
export interface ControlState {x:number;y:number;heading:number;key:boolean;completed:number;direction:string;message:string}
