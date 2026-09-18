import type { ClickVariant, Mechanic } from './types';
export const clickGames: Record<ClickVariant, {name:string; description:string; action:string; success:string; mechanic:Mechanic}> = {
  tug:{name:'团队拔河',description:'两队点击助力，绳结向贡献更多的一方移动；时间到按积分判胜。',action:'点击助力，拉向我方！',success:'拔河结束',mechanic:'tug'},
  boss:{name:'齐心打 Boss',description:'全场点击攻击，逐步破盾、削弱怪兽；共同贡献达到目标即获胜。',action:'点击攻击，一起打 Boss！',success:'Boss 已被全场击败！',mechanic:'light'},
  balloon:{name:'气球充气赛',description:'点击为战队气球充气，满格放飞后继续累计积分；时间到按积分排名。',action:'点击打气，让气球长大！',success:'气球派对结束',mechanic:'race'},
  rocket:{name:'火箭发射',description:'全场合力点击蓄能，完成准备、点火和发射，共同达标即成功。',action:'点击蓄能，准备发射！',success:'全场助力，火箭发射成功！',mechanic:'light'},
  flower:{name:'开花大作战',description:'全场点击浇水，让种子发芽、长叶、开花，共同达标绽放。',action:'点击浇水，让花朵绽放！',success:'共同培育的花朵绽放了！',mechanic:'light'},
  tower:{name:'欢乐盖高楼',description:'点击贡献砖块，楼层随战队积分增加；时间到按积分排名。',action:'点击添砖，一起盖高楼！',success:'建造挑战结束',mechanic:'race'},
  brand:{name:'点亮品牌',description:'全场点击贡献光点，逐渐点亮主办方品牌 Logo，共同达标即完成。',action:'点击贡献光点，点亮品牌！',success:'全场点亮品牌成功！',mechanic:'light'},
  popcorn:{name:'爆米花派对',description:'点击加热，战队爆米花桶逐渐装满；满格后继续累计积分，时间到按分排名。',action:'点击加热，爆米花出锅！',success:'爆米花派对结束',mechanic:'race'}
};
