import { CarDefinition, PaintFinish, RimStyle, TintLevel } from './types';

export const CARS: CarDefinition[] = [
  {
    id: 'hatch',
    name: 'Evoq Crossover',
    tagline: 'Cobalt urban SUV · Panoramic roof & crisp handling',
    price: 0,
    width: 1.92,
    length: 4.18,
    height: 1.56,
    wheelbase: 2.58,
    maxSpeed: 10.8,
    acceleration: 8.8,
    turnSpeed: 3.4,
    maxSteerAngle: 0.68,
    durability: 3,
    defaultColor: '#1d7bf2',
  },
  {
    id: 'sedan',
    name: 'Executive Sedan',
    tagline: 'Balanced 4-door saloon · Smooth steering response',
    price: 450,
    width: 1.92,
    length: 4.38,
    height: 1.42,
    wheelbase: 2.7,
    maxSpeed: 11.8,
    acceleration: 9.2,
    turnSpeed: 3.2,
    maxSteerAngle: 0.64,
    durability: 3,
    defaultColor: '#f8fafc',
  },
  {
    id: 'coupe',
    name: 'Apex Coupe',
    tagline: 'Sport-tuned chassis · Quick throttle response',
    price: 950,
    width: 1.96,
    length: 4.25,
    height: 1.32,
    wheelbase: 2.62,
    maxSpeed: 13.0,
    acceleration: 10.8,
    turnSpeed: 3.6,
    maxSteerAngle: 0.66,
    durability: 3,
    defaultColor: '#f59e0b',
  },
  {
    id: 'suv',
    name: 'Ridge 4x4',
    tagline: 'Heavy utility SUV · Reinforced 4-hit bumper',
    price: 1500,
    width: 2.04,
    length: 4.5,
    height: 1.72,
    wheelbase: 2.78,
    maxSpeed: 11.2,
    acceleration: 8.8,
    turnSpeed: 3.0,
    maxSteerAngle: 0.62,
    durability: 4,
    defaultColor: '#059669',
  },
  {
    id: 'supercar',
    name: 'Phantom GT',
    tagline: 'Widebody flagship · Precision track steering',
    price: 2400,
    width: 2.06,
    length: 4.55,
    height: 1.24,
    wheelbase: 2.72,
    maxSpeed: 14.5,
    acceleration: 12.2,
    turnSpeed: 3.8,
    maxSteerAngle: 0.68,
    durability: 4,
    defaultColor: '#e11d48',
  },
];

export function getCarById(id: string): CarDefinition {
  return CARS.find((c) => c.id === id) || CARS[0];
}

export interface PaintSwatch {
  hex: string;
  name: string;
  price: number;
}

export const BODY_COLORS: PaintSwatch[] = [
  { hex: '#1d7bf2', name: 'Electric Blue', price: 0 },
  { hex: '#e11d48', name: 'Crimson Red', price: 0 },
  { hex: '#f8fafc', name: 'Pearl White', price: 0 },
  { hex: '#1e293b', name: 'Obsidian', price: 0 },
  { hex: '#f59e0b', name: 'Solar Amber', price: 100 },
  { hex: '#059669', name: 'Racing Green', price: 100 },
  { hex: '#06b6d4', name: 'Ice Cyan', price: 140 },
  { hex: '#7c3aed', name: 'Deep Violet', price: 160 },
  { hex: '#ea580c', name: 'Sunset Copper', price: 180 },
  { hex: '#94a3b8', name: 'Titanium Silver', price: 120 },
];

export const PAINT_FINISHES: { id: PaintFinish; name: string; price: number }[] = [
  { id: 'gloss', name: 'Gloss Clear', price: 0 },
  { id: 'metallic', name: 'Metallic', price: 150 },
  { id: 'matte', name: 'Stealth Matte', price: 220 },
];

export const RIM_STYLES: { id: RimStyle; name: string; price: number }[] = [
  { id: 'five-spoke', name: '5-Spoke Sport', price: 0 },
  { id: 'mesh', name: 'Multi-Mesh', price: 160 },
  { id: 'deep-dish', name: 'Deep Dish', price: 240 },
  { id: 'turbine', name: 'Aero Turbine', price: 320 },
];

export const RIM_COLORS: PaintSwatch[] = [
  { hex: '#cbd5e1', name: 'Alloy Silver', price: 0 },
  { hex: '#18181b', name: 'Matte Black', price: 90 },
  { hex: '#d97706', name: 'Bronze Gold', price: 140 },
  { hex: '#f8fafc', name: 'Chrome Pearl', price: 160 },
  { hex: '#ef4444', name: 'Track Red', price: 180 },
];

export const TINT_LEVELS: { id: TintLevel; name: string; opacity: number; price: number }[] = [
  { id: 'light', name: 'Factory Clear', opacity: 0.42, price: 0 },
  { id: 'smoked', name: 'Smoked 50%', opacity: 0.72, price: 0 },
  { id: 'limo', name: 'Limo Dark', opacity: 0.92, price: 180 },
];

export const UNDERGLOW_OPTIONS: { hex: string | null; name: string; price: number }[] = [
  { hex: null, name: 'Off', price: 0 },
  { hex: '#06b6d4', name: 'Ice Cyan', price: 220 },
  { hex: '#f59e0b', name: 'Amber Gold', price: 220 },
  { hex: '#ef4444', name: 'Crimson', price: 250 },
  { hex: '#10b981', name: 'Emerald', price: 250 },
];

export const COSMETIC_PRICES = {
  spoiler: 200,
  stripes: 160,
};

export const UPGRADE_COSTS = {
  speed: [0, 180, 380],
  handling: [0, 160, 340],
};
