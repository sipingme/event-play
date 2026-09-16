export type Mechanic = 'race' | 'tug' | 'money' | 'alternating' | 'light' | 'quiz' | 'draw' | 'catch' | 'reaction';
export type ThemeId = 'gold' | 'space' | 'garden';
export interface PublicEvent {
  id: string;
  name: string;
  index: number;
  total: number;
  roomId: string | null;
  stepName: string | null;
  state: DemoRoom['state'];
  finished: boolean;
}
export interface GameConfig {
  inputMode?: 'tap' | 'shake';
  quizText?: string;
  winnerCount?: number;
  prizeName?: string;
  catchDifficulty?: 'easy' | 'normal' | 'hard';
  goal?: number;
  name: string;
  description: string;
  mechanic: Mechanic;
  theme: ThemeId;
  duration: number;
  participants: number;
  teams: string;
  brand: string;
  logo: string;
}
export interface Activity extends GameConfig {
  id: string;
  revision: number;
  updatedAt: string;
  archived: boolean;
  release?: { version: number; config: GameConfig; createdAt: string };
}
export interface Template {
  inputMode?: 'tap' | 'shake';
  featured?: boolean;
  id: string;
  name: string;
  category: string;
  description: string;
  mechanic: Mechanic;
  theme: ThemeId;
  teams: string;
  duration: number;
}
export interface Brand {
  name: string;
  color: string;
  logo: string;
}
export interface DemoRoom {
  host?: { checks: string[]; blackout: boolean; log: { at: number; text: string }[] };
  id: string;
  activityId: string;
  version: number;
  config: GameConfig;
  state: 'waiting' | 'running' | 'paused' | 'completed' | 'aborted';
  remaining: number;
  scores: number[];
  updatedAt: number;
}
