export const coordinationGames = {
  mole: {name:'萌鼠出没', description:'看准洞口点击，每轮一次机会，命中 +1 分。', asset:'mole', background:'/games/click/garden-bg-v1.png'},
  rhythm: {name:'节奏敲敲乐', description:'节奏光标进入绿色区时敲鼓，精准 +3 分，擦边 +1 分。', asset:'drum', background:'/games/click/stage-bg-v1.png'},
  stack: {name:'完美叠叠乐', description:'移动楼层与绿色基座对齐时落下，精准 +3 分，擦边 +1 分。', asset:'tower', background:'/games/click/town-bg-v1.png'},
  basket: {name:'萌宠投篮', description:'力度光标进入绿色区时投篮，命中 +2 分。', asset:'basket', background:'/games/race/stadium-cartoon-v2.png'},
  fruit: {name:'水果切切乐', description:'划过苹果，避开炸弹；有效切中 +1 分。', asset:'fruit', background:'/games/click/garden-bg-v1.png'},
  chef: {name:'美食接单王', description:'按订单顺序选择三份食材，完成 +3 分；选错本轮结束。', asset:'chef', background:'/games/money/wealth-plaza-v2.png'},
  fish: {name:'精准钓鱼', description:'浮标进入绿色区时收竿，成功钓鱼 +2 分。', asset:'fish', background:'/games/race/illustrated/yacht-bg-v2.png'},
  memory: {name:'记忆翻翻乐', description:'记忆 2 秒后翻牌配对，每对 +1 分，每轮最多 6 次配对。', asset:'fruit', background:'/games/click/carnival-bg-v1.png'}
} as const;
export type ReactionVariant = keyof typeof coordinationGames;
export function coordinationAsset(variant: ReactionVariant) {
  return variant === 'stack' ? '/games/click/tower-sprite-v1.png' : `/games/coordination/${coordinationGames[variant].asset}-v1.png`;
}
