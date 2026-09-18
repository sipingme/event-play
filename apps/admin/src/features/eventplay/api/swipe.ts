import type { InputKind, SwipeDirection } from './types';

export const swipeLabels: Record<SwipeDirection,string> = {
  up: '向上滑动', down: '向下滑动', alternating: '左右交替滑动'
};
export function detectSwipe(dx:number,dy:number,elapsed:number,direction:SwipeDirection):InputKind|null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || elapsed < 0 || elapsed >= 2000) return null;
  if (direction === 'alternating') return Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'swipe-left' : 'swipe-right' : null;
  if (Math.abs(dy) < 48 || Math.abs(dy) <= Math.abs(dx)) return null;
  return direction === 'up' && dy < 0 ? 'swipe-up' : direction === 'down' && dy > 0 ? 'swipe-down' : null;
}
