import { useCallback, useEffect, useRef, useState } from 'react';
import { Car, LayoutGrid, Play, RotateCcw } from 'lucide-react';
import { DrivingHUD } from './components/DrivingHUD';
import { DrivingInputState, GameViewport } from './components/GameViewport';
import { GarageModal } from './components/GarageModal';
import { LevelSelectModal } from './components/LevelSelectModal';
import { ResultModal } from './components/ResultModal';
import { soundEngine } from './game/audio';
import { getCarById } from './game/catalog';
import { getLevelById, LEVELS } from './game/levels';
import { loadSaveData, persistSaveData } from './game/storage';
import { CameraMode, HudTelemetry, SaveData } from './game/types';

export default function App() {
  const [save, setSave] = useState<SaveData>(() => {
    const loaded = loadSaveData();
    soundEngine.setEnabled(loaded.soundEnabled);
    return loaded;
  });

  const [currentLevelId, setCurrentLevelId] = useState<number>(() =>
    Math.min(LEVELS.length, Math.max(1, loadSaveData().highestUnlockedLevel)),
  );
  const [cameraMode, setCameraMode] = useState<CameraMode>('auto');
  const [restartNonce, setRestartNonce] = useState(0);
  const [modal, setModal] = useState<'none' | 'pause' | 'garage' | 'levels' | 'win' | 'crash'>('none');
  const [webglError, setWebglError] = useState(false);

  const [winStats, setWinStats] = useState<{
    time: number;
    hits: number;
    bonusCoins: number;
    stars: number;
    earnedCoins: number;
  } | null>(null);

  const currentLevel = getLevelById(currentLevelId);
  const activeCar = getCarById(save.selectedCar);
  const activeCustomization = save.customizations[save.selectedCar];

  const [telemetry, setTelemetry] = useState<HudTelemetry>(() => ({
    speedKmh: 0,
    gear: 'D',
    steerNorm: 0,
    elapsedTime: 0,
    health: activeCar.durability,
    maxHealth: activeCar.durability,
    parkProgress: 0,
    parkStatus: 'driving',
    sensorDistance: 99,
    sensorRearLeft: 99,
    sensorRearRight: 99,
    sensorFrontLeft: 99,
    sensorFrontRight: 99,
    coinsCollectedInRun: 0,
  }));

  const inputRef = useRef<DrivingInputState>({
    gas: false,
    brake: false,
    steerTarget: 0,
    gear: 'D',
    paused: false,
  });

  inputRef.current.paused = modal !== 'none';

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      persistSaveData(next);
      return next;
    });
  }, []);

  const cycleCamera = useCallback(() => {
    soundEngine.playClick();
    setCameraMode((m) =>
      m === 'auto'
        ? 'cam1'
        : m === 'cam1'
          ? 'cam2'
          : m === 'cam2'
            ? 'interior'
            : m === 'interior'
              ? 'free'
              : 'auto',
    );
  }, []);

  const resetRun = useCallback((nextLevelId?: number) => {
    inputRef.current.gas = false;
    inputRef.current.brake = false;
    inputRef.current.steerTarget = 0;
    inputRef.current.gear = 'D';
    if (nextLevelId !== undefined) {
      setCurrentLevelId(nextLevelId);
    }
    setModal('none');
    setWinStats(null);
    setRestartNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const keysDown = new Set<string>();

    const syncKeys = () => {
      const gas = keysDown.has('KeyW') || keysDown.has('ArrowUp');
      const brake = keysDown.has('KeyS') || keysDown.has('ArrowDown');
      const left = keysDown.has('KeyA') || keysDown.has('ArrowLeft');
      const right = keysDown.has('KeyD') || keysDown.has('ArrowRight');

      inputRef.current.gas = gas;
      inputRef.current.brake = brake;
      inputRef.current.steerTarget = left && !right ? -1 : right && !left ? 1 : 0;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !e.repeat) {
        if (modal === 'none') {
          setModal('pause');
          return;
        }
        if (modal === 'pause') {
          setModal('none');
          return;
        }
      }

      if (modal !== 'none') return;
      soundEngine.unlock();

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if ((e.code === 'KeyR' || e.code === 'Space') && !e.repeat) {
        const nextGear = inputRef.current.gear === 'R' ? 'D' : 'R';
        inputRef.current.gear = nextGear;
        soundEngine.playGearShift(nextGear);
        return;
      }

      if (e.code === 'KeyP' && !e.repeat) {
        inputRef.current.gear = inputRef.current.gear === 'P' ? 'D' : 'P';
        soundEngine.playGearShift('D');
        return;
      }

      if (e.code === 'KeyC' && !e.repeat) {
        cycleCamera();
        return;
      }

      keysDown.add(e.code);
      syncKeys();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
      if (modal === 'none') {
        syncKeys();
      }
    };

    const onBlur = () => {
      keysDown.clear();
      inputRef.current.gas = false;
      inputRef.current.brake = false;
      inputRef.current.steerTarget = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [modal, cycleCamera]);

  const handleLevelComplete = useCallback(
    (stats: { time: number; hits: number; bonusCoins: number }) => {
      const lv = getLevelById(currentLevelId);
      let stars = 1;
      if (stats.hits === 0) stars += 1;
      if (stats.time <= lv.parTime) stars += 1;

      const prevStars = save.levelStars[lv.id] || 0;
      const baseReward = prevStars === 0 ? lv.rewardCoins : Math.round(lv.rewardCoins * 0.6);
      const earnedCoins = baseReward + stars * 20 + stats.bonusCoins;

      setWinStats({
        ...stats,
        stars,
        earnedCoins,
      });
      setModal('win');

      updateSave((prev) => {
        const oldBest = prev.levelBestTime[lv.id];
        return {
          ...prev,
          coins: prev.coins + earnedCoins,
          highestUnlockedLevel: Math.min(
            LEVELS.length,
            Math.max(prev.highestUnlockedLevel, lv.id + 1),
          ),
          levelStars: {
            ...prev.levelStars,
            [lv.id]: Math.max(prev.levelStars[lv.id] || 0, stars),
          },
          levelBestTime: {
            ...prev.levelBestTime,
            [lv.id]: oldBest === undefined ? stats.time : Math.min(oldBest, stats.time),
          },
        };
      });
    },
    [currentLevelId, save.levelStars, updateSave],
  );

  const handleCrash = useCallback(() => {
    setModal('crash');
  }, []);

  const toggleSound = () => {
    const next = !save.soundEnabled;
    soundEngine.setEnabled(next);
    if (next) {
      soundEngine.unlock();
      soundEngine.playClick();
    }
    updateSave((prev) => ({ ...prev, soundEnabled: next }));
  };

  const toggleSensor = () => {
    soundEngine.playClick();
    updateSave((prev) => ({ ...prev, sensorEnabled: !prev.sensorEnabled }));
  };

  const toggleSteerMode = () => {
    soundEngine.playClick();
    updateSave((prev) => ({
      ...prev,
      steerMode: prev.steerMode === 'wheel' ? 'arrows' : 'wheel',
    }));
  };

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0b0e14] p-6 text-center">
        <div className="max-w-md rounded-2xl bg-[#111622] border border-white/15 p-6">
          <h1 className="font-display text-2xl font-bold text-white">3D WebGL Unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please enable hardware acceleration or reload the browser to launch Apex Park 3D.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm cursor-pointer"
          >
            Reload Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#8bb6e2]">
      <GameViewport
        levelId={currentLevelId}
        carId={save.selectedCar}
        customization={activeCustomization}
        cameraMode={cameraMode}
        sensorEnabled={save.sensorEnabled}
        restartNonce={restartNonce}
        inputRef={inputRef}
        onTelemetry={setTelemetry}
        onLevelComplete={handleLevelComplete}
        onCrash={handleCrash}
        onContextError={() => setWebglError(true)}
      />

      {modal === 'none' && (
        <DrivingHUD
          level={currentLevel}
          telemetry={telemetry}
          totalCoins={save.coins}
          cameraMode={cameraMode}
          soundEnabled={save.soundEnabled}
          sensorEnabled={save.sensorEnabled}
          steerMode={save.steerMode}
          inputRef={inputRef}
          onCycleCamera={cycleCamera}
          onToggleSound={toggleSound}
          onToggleSensor={toggleSensor}
          onPause={() => {
            soundEngine.playClick();
            setModal('pause');
          }}
          onOpenGarage={() => {
            soundEngine.playClick();
            setModal('garage');
          }}
        />
      )}

      {modal === 'pause' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#111622] border border-white/15 p-6 shadow-2xl space-y-3">
            <div className="text-center pb-2 border-b border-white/10">
              <p className="text-xs text-amber-400 font-semibold">
                Level {currentLevel.id} · {currentLevel.name}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-white">Paused</h2>
              <p className="text-xs text-slate-400 mt-1">{currentLevel.hint}</p>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick();
                setModal('none');
              }}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Resume</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                resetRun();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart Course</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setModal('levels');
                }}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <LayoutGrid className="w-4 h-4 text-sky-400" />
                <span>Levels</span>
              </button>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setModal('garage');
                }}
                className="py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Car className="w-4 h-4" />
                <span>Garage</span>
              </button>
            </div>

            <button
              onClick={toggleSteerMode}
              className="w-full py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer transition-colors"
            >
              Steering Control: {save.steerMode === 'wheel' ? 'Steering Wheel' : 'Left / Right Arrows'} (Tap to switch)
            </button>
          </div>
        </div>
      )}

      {modal === 'garage' && (
        <GarageModal
          save={save}
          onUpdateSave={updateSave}
          onClose={() => resetRun()}
        />
      )}

      {modal === 'levels' && (
        <LevelSelectModal
          save={save}
          currentLevelId={currentLevelId}
          onSelectLevel={(id) => resetRun(id)}
          onClose={() => setModal('none')}
        />
      )}

      {(modal === 'win' || modal === 'crash') && (
        <ResultModal
          mode={modal}
          level={currentLevel}
          stats={winStats}
          hasNextLevel={currentLevelId < LEVELS.length}
          onRetry={() => resetRun()}
          onNextLevel={() => resetRun(Math.min(LEVELS.length, currentLevelId + 1))}
          onOpenGarage={() => setModal('garage')}
          onOpenLevels={() => setModal('levels')}
        />
      )}
    </main>
  );
}
