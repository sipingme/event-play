export type StoryKind = 'gather' | 'teams' | 'message' | 'countdown' | 'race' | 'awards' | 'celebrate';
export interface StoryNode { id: string; kind: StoryKind; x: number; y: number; title: string; caption: string; seconds: number }
export interface Storyboard { version: 1; nodes: StoryNode[]; edges: { source: string; target: string }[] }
export const storyKinds: Record<StoryKind, { name: string; description: string; rank: number; color: string }> = {
  gather: { name: '扫码集结', description: '欢迎来宾，展示品牌', rank: 0, color: '#16a085' },
  teams: { name: '战队亮相', description: '队伍登场，喊出你的口号', rank: 1, color: '#3984e8' },
  message: { name: '品牌寄语', description: '开场前讲一句品牌故事', rank: 1, color: '#9362d9' },
  countdown: { name: '开场倒计时', description: '一起准备，迎接发令', rank: 2, color: '#e99925' },
  race: { name: '赛马冲刺', description: '手机互动，战队共同加速', rank: 3, color: '#ef704a' },
  awards: { name: '颁奖时刻', description: '展示排名与结束祝福', rank: 4, color: '#ca9a28' },
  celebrate: { name: '欢庆谢幕', description: '用品牌祝福结束这一场', rank: 5, color: '#d65a94' }
};
export function defaultStoryboard(): Storyboard {
  const kinds: StoryKind[] = ['gather', 'teams', 'countdown', 'race', 'awards'];
  return { version: 1, nodes: kinds.map((kind, i) => ({ id: `node-${kind}`, kind, x: 48 + (i % 3) * 270, y: 60 + Math.floor(i / 3) * 240,
    title: storyKinds[kind].name, caption: kind === 'gather' ? '欢迎加入，一起创造精彩现场' : kind === 'awards' ? '每一份热爱，都值得被看见' : '', seconds: 3 })),
    edges: kinds.slice(1).map((kind, i) => ({ source: `node-${kinds[i]}`, target: `node-${kind}` })) };
}
export function connectionError(board: Storyboard, source: string, target: string): string | null {
  const from = board.nodes.find((node) => node.id === source), to = board.nodes.find((node) => node.id === target);
  if (!from || !to) return '连接的节点不存在';
  if (source === target) return '不能连接节点自身';
  if (board.edges.some((edge) => edge.source === source)) return '出口已有连线，请先断开原连线';
  if (board.edges.some((edge) => edge.target === target)) return '入口已有连线，请先断开原连线';
  if (to.kind === 'gather' || from.kind === 'celebrate' || storyKinds[from.kind].rank > storyKinds[to.kind].rank) return '请按集结、开场、比赛、颁奖、谢幕的顺序连接';
  const visited = new Set<string>();
  let cursor: string | undefined = target;
  while (cursor && !visited.has(cursor)) {
    if (cursor === source) return '不支持循环连接';
    visited.add(cursor); cursor = board.edges.find((edge) => edge.source === cursor)?.target;
  }
  return null;
}
export function storyOrder(board: Storyboard): StoryNode[] {
  const order: StoryNode[] = [];
  let node = board.nodes.find((item) => item.kind === 'gather');
  while (node && !order.some((item) => item.id === node!.id)) {
    order.push(node);
    const next = board.edges.find((edge) => edge.source === node!.id)?.target;
    node = board.nodes.find((item) => item.id === next);
  }
  return order;
}
export function storyboardErrors(board: Storyboard): string[] {
  const errors: string[] = [];
  if (board.version !== 1 || board.nodes.length < 3 || board.nodes.length > 10) errors.push('需要 3～10 个节点');
  if (new Set(board.nodes.map((node) => node.id)).size !== board.nodes.length) errors.push('节点标识不能重复');
  for (const kind of ['gather', 'race', 'awards'] as StoryKind[]) {
    if (board.nodes.filter((node) => node.kind === kind).length !== 1) errors.push(`需要且只能有一个${storyKinds[kind].name}`);
  }
  for (const node of board.nodes) {
    if (!node.title.trim() || node.title.length > 60 || node.caption.length > 200 || !Number.isInteger(node.seconds) || node.seconds < 1 || node.seconds > 15) errors.push('节点标题和时长未填写完整（1～15 秒）');
  }
  const partial: Storyboard = { ...board, edges: [] };
  for (const edge of board.edges) {
    const error = connectionError(partial, edge.source, edge.target);
    if (error) errors.push(error);
    partial.edges.push(edge);
  }
  if (storyOrder(board).length !== board.nodes.length || board.edges.length !== board.nodes.length - 1) errors.push('存在未接入主流程的节点，请补齐连线');
  return [...new Set(errors)];
}
