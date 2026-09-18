export type Mechanic = 'race' | 'tug' | 'money' | 'alternating' | 'light' | 'quiz' | 'draw' | 'catch' | 'reaction' | 'wall' | 'vote' | 'create' | 'social';
export type ClickVariant = 'tug' | 'boss' | 'balloon' | 'rocket' | 'flower' | 'tower' | 'brand' | 'popcorn';
export type ThemeId = 'gold' | 'space' | 'garden';
export type RaceVariant = 'horse' | 'yacht' | 'car' | 'motorbike' | 'spaceship' | 'rocket' | 'penguin' | 'balloon' | 'dragonboat' | 'bicycle' | 'climb';
export type SwipeDirection = 'up' | 'down' | 'alternating';
export type InputKind = 'tap' | 'shake' | 'swipe' | 'left' | 'right' | 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right';
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
  participationMode?: 'team' | 'individual';
  teamAssignment?: 'choose' | 'balanced';
  raceBackdrop?: 'day' | 'sunset' | 'night';
  raceHorse?: 'team' | 'red' | 'blue' | 'green' | 'purple';
  storyboard?: import('./storyboard').Storyboard | null;
  socialVariant?:import('./social-games').SocialVariant;
  createVariant?: import('./create-games').CreateVariant;
  createImage?:string;
  voteVariant?: import('./vote-games').VoteVariant;
  voteOptions?:string;voteImages?:string;voteStory?:string;voteLive?:boolean;voteChange?:boolean;
  wallVariant?: import('./wall-games').WallVariant;
  drawVariant?: import('./draw-games').DrawVariant;
  drawRepeat?: boolean;
  quizVariant?: import('./quiz-games').QuizVariant;
  controlVariant?: import('./control-games').ControlVariant;
  reactionVariant?: import('./coordination').ReactionVariant;
  clickVariant?: ClickVariant;
  raceVariant?: RaceVariant;
  inputMode?: 'tap' | 'shake' | 'swipe';
  swipeDirection?: SwipeDirection;
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
  socialVariant?:import('./social-games').SocialVariant;
  createVariant?: import('./create-games').CreateVariant;
  createImage?:string;
  voteVariant?: import('./vote-games').VoteVariant;
  voteOptions?:string;voteImages?:string;voteStory?:string;voteLive?:boolean;
  wallVariant?: import('./wall-games').WallVariant;
  drawVariant?: import('./draw-games').DrawVariant;
  quizVariant?: import('./quiz-games').QuizVariant;
  quizText?: string;
  controlVariant?: import('./control-games').ControlVariant;
  reactionVariant?: import('./coordination').ReactionVariant;
  clickVariant?: ClickVariant;
  goal?: number;
  raceVariant?: RaceVariant;
  showcase?: boolean;
  inputMode?: 'tap' | 'shake' | 'swipe';
  swipeDirection?: SwipeDirection;
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
