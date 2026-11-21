import { CarCustomization, CarId, SaveData } from './types';

const STORAGE_KEY = 'apex_park_3d_save_v2';

export const DEFAULT_CUSTOMIZATION: Record<CarId, CarCustomization> = {
  hatch: {
    bodyColor: '#1d7bf2',
    paintFinish: 'gloss',
    rimStyle: 'five-spoke',
    rimColor: '#cbd5e1',
    spoiler: false,
    stripes: false,
    stripeColor: '#f8fafc',
    tint: 'smoked',
    underglowColor: null,
    speedLevel: 1,
    handlingLevel: 1,
  },
  sedan: {
    bodyColor: '#f8fafc',
    paintFinish: 'metallic',
    rimStyle: 'mesh',
    rimColor: '#cbd5e1',
    spoiler: false,
    stripes: false,
    stripeColor: '#0f172a',
    tint: 'smoked',
    underglowColor: null,
    speedLevel: 1,
    handlingLevel: 1,
  },
  coupe: {
    bodyColor: '#f59e0b',
    paintFinish: 'metallic',
    rimStyle: 'deep-dish',
    rimColor: '#1e293b',
    spoiler: true,
    stripes: true,
    stripeColor: '#0f172a',
    tint: 'smoked',
    underglowColor: null,
    speedLevel: 1,
    handlingLevel: 1,
  },
  suv: {
    bodyColor: '#059669',
    paintFinish: 'matte',
    rimStyle: 'five-spoke',
    rimColor: '#334155',
    spoiler: false,
    stripes: false,
    stripeColor: '#f8fafc',
    tint: 'limo',
    underglowColor: null,
    speedLevel: 1,
    handlingLevel: 1,
  },
  supercar: {
    bodyColor: '#e11d48',
    paintFinish: 'gloss',
    rimStyle: 'turbine',
    rimColor: '#d97706',
    spoiler: true,
    stripes: true,
    stripeColor: '#f8fafc',
    tint: 'limo',
    underglowColor: '#06b6d4',
    speedLevel: 1,
    handlingLevel: 1,
  },
};

export function createInitialSave(): SaveData {
  return {
    coins: 250,
    unlockedCars: ['hatch'],
    selectedCar: 'hatch',
    customizations: JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION)),
    unlockedCosmetics: [
      'color:#1d7bf2',
      'color:#e11d48',
      'color:#f8fafc',
      'color:#1e293b',
      'finish:gloss',
      'rim:five-spoke',
      'rimColor:#cbd5e1',
      'tint:light',
      'tint:smoked',
    ],
    levelStars: {},
    levelBestTime: {},
    highestUnlockedLevel: 1,
    soundEnabled: true,
    sensorEnabled: true,
    steerMode: 'wheel',
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = createInitialSave();
    return {
      coins: typeof parsed.coins === 'number' ? Math.max(0, parsed.coins) : base.coins,
      unlockedCars:
        Array.isArray(parsed.unlockedCars) && parsed.unlockedCars.length > 0
          ? parsed.unlockedCars
          : base.unlockedCars,
      selectedCar: parsed.selectedCar || base.selectedCar,
      customizations: {
        ...base.customizations,
        ...(parsed.customizations || {}),
      },
      unlockedCosmetics: Array.isArray(parsed.unlockedCosmetics)
        ? Array.from(new Set([...base.unlockedCosmetics, ...parsed.unlockedCosmetics]))
        : base.unlockedCosmetics,
      levelStars: parsed.levelStars || {},
      levelBestTime: parsed.levelBestTime || {},
      highestUnlockedLevel:
        typeof parsed.highestUnlockedLevel === 'number'
          ? Math.max(1, parsed.highestUnlockedLevel)
          : 1,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      sensorEnabled: typeof parsed.sensorEnabled === 'boolean' ? parsed.sensorEnabled : true,
      steerMode: parsed.steerMode === 'arrows' ? 'arrows' : 'wheel',
    };
  } catch {
    return createInitialSave();
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}
