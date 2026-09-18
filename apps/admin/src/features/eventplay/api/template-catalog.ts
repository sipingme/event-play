import type { Template } from './types';

export const catalogCategories = ['摇一摇', '滑屏', '点击', '手眼协调', '控制', '知识答题', '抽奖互动', '签到与上墙', '投票与评分', '群体共创', '社交破冰'];

// Keep these records in the service for saved activities and historical URLs.
export const legacyTemplateIds = new Set(['catch-garden', 'alternating-space', 'light-gold', 'money-gold', 'race-gold', 'tug-space', 'race-space', 'race-garden']);
export function catalogMembership(template: Template): string[] {
  const category = template.category === '知识互动' ? '知识答题' : template.category;
  return ['click-brand', 'click-flower'].includes(template.id) ? [category, '群体共创'] : [category];
}
export function visibleTemplates(items: Template[]) {
  return items.filter((item) => !legacyTemplateIds.has(item.id));
}

export const plannedGames: {id:string;category:string;name:string;description:string;status:'planned'}[] = [];
