export type Mechanic = 'race' | 'tug';
export type ThemeId = 'gold' | 'space' | 'garden';
export interface GameConfig {
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
