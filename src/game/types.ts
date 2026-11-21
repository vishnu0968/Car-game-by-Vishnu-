export type CarId = 'hatch' | 'sedan' | 'coupe' | 'suv' | 'supercar';

export type PaintFinish = 'gloss' | 'metallic' | 'matte';

export type RimStyle = 'five-spoke' | 'mesh' | 'deep-dish' | 'turbine';

export type TintLevel = 'light' | 'smoked' | 'limo';

export type CameraMode = 'auto' | 'cam1' | 'cam2' | 'interior' | 'free';

export type SteerControlMode = 'wheel' | 'arrows';

export type GearMode = 'P' | 'R' | 'N' | 'D';

export interface CarCustomization {
  bodyColor: string;
  paintFinish: PaintFinish;
  rimStyle: RimStyle;
  rimColor: string;
  spoiler: boolean;
  stripes: boolean;
  stripeColor: string;
  tint: TintLevel;
  underglowColor: string | null;
  speedLevel: number;
  handlingLevel: number;
}

export interface CarDefinition {
  id: CarId;
  name: string;
  tagline: string;
  price: number;
  width: number;
  length: number;
  height: number;
  wheelbase: number;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  maxSteerAngle: number;
  durability: number;
  defaultColor: string;
}

export interface SaveData {
  coins: number;
  unlockedCars: CarId[];
  selectedCar: CarId;
  customizations: Record<CarId, CarCustomization>;
  unlockedCosmetics: string[];
  levelStars: Record<number, number>;
  levelBestTime: Record<number, number>;
  highestUnlockedLevel: number;
  soundEnabled: boolean;
  sensorEnabled: boolean;
  steerMode: SteerControlMode;
}

export type ObstacleKind =
  | 'wall'
  | 'cone'
  | 'pillar'
  | 'parked-car'
  | 'parked-mpv'
  | 'container'
  | 'curb'
  | 'speed-bump'
  | 'patrol-car'
  | 'gate';

export interface StaticObstacle {
  id: string;
  kind: ObstacleKind;
  x: number;
  z: number;
  width: number;
  length: number;
  rotation: number;
  height?: number;
  color?: string;
}

export interface MovingObstacle extends StaticObstacle {
  axis: 'x' | 'z';
  range: number;
  speed: number;
  phase?: number;
}

export interface RampPlatform {
  x: number;
  z: number;
  width: number;
  length: number;
  height: number;
  rampLength: number;
}

export interface RoadArrow {
  x: number;
  z: number;
  rotation: number; // radians around Y (0 points -Z)
}

export interface CoinPickup {
  id: string;
  x: number;
  z: number;
  value: number;
}

export interface ParkingBay {
  x: number;
  z: number;
  y?: number;
  width: number;
  length: number;
  rotation: number;
  requiredDirection: 'any' | 'forward' | 'reverse';
}

export type EnvironmentTheme = 'daylight' | 'sunset' | 'basement' | 'rooftop';

export interface LevelDefinition {
  id: number;
  name: string;
  subtitle: string;
  theme: EnvironmentTheme;
  arenaWidth: number;
  arenaLength: number;
  spawn: {
    x: number;
    z: number;
    rotation: number;
  };
  bay: ParkingBay;
  platform?: RampPlatform;
  parTime: number;
  rewardCoins: number;
  staticObstacles: StaticObstacle[];
  movingObstacles: MovingObstacle[];
  pathArrows: RoadArrow[];
  coins: CoinPickup[];
  hint: string;
}

export interface HudTelemetry {
  speedKmh: number;
  gear: GearMode;
  steerNorm: number;
  elapsedTime: number;
  health: number;
  maxHealth: number;
  parkProgress: number;
  parkStatus: 'driving' | 'aligning' | 'wrong-direction' | 'hold-steady' | 'parked';
  sensorDistance: number;
  sensorRearLeft: number;
  sensorRearRight: number;
  sensorFrontLeft: number;
  sensorFrontRight: number;
  coinsCollectedInRun: number;
}
