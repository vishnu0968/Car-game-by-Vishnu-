import React, { useState } from 'react';
import { ArrowLeft, Check, Coins, Lock, Sparkles, Wrench } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  BODY_COLORS,
  CARS,
  COSMETIC_PRICES,
  getCarById,
  PAINT_FINISHES,
  RIM_COLORS,
  RIM_STYLES,
  TINT_LEVELS,
  UNDERGLOW_OPTIONS,
  UPGRADE_COSTS,
} from '../game/catalog';
import { CarCustomization, CarId, SaveData } from '../game/types';
import { GarageViewport } from './GarageViewport';

interface GarageModalProps {
  save: SaveData;
  onUpdateSave: (updater: (prev: SaveData) => SaveData) => void;
  onClose: () => void;
}

type GarageTab = 'cars' | 'paint' | 'wheels' | 'tuning';

export const GarageModal: React.FC<GarageModalProps> = ({ save, onUpdateSave, onClose }) => {
  const [tab, setTab] = useState<GarageTab>('cars');
  const [previewCarId, setPreviewCarId] = useState<CarId>(save.selectedCar);
  const [notice, setNotice] = useState<string | null>(null);

  const previewCar = getCarById(previewCarId);
  const isCarUnlocked = save.unlockedCars.includes(previewCarId);
  const custom = save.customizations[previewCarId];

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((curr) => (curr === msg ? null : curr)), 2200);
  };

  const hasCosmetic = (key: string, price: number) =>
    price === 0 || save.unlockedCosmetics.includes(key);

  const updateCarCustom = (patch: Partial<CarCustomization>) => {
    onUpdateSave((prev) => ({
      ...prev,
      customizations: {
        ...prev.customizations,
        [previewCarId]: {
          ...prev.customizations[previewCarId],
          ...patch,
        },
      },
    }));
  };

  const buyOrApplyCosmetic = (
    key: string,
    price: number,
    applyPatch: Partial<CarCustomization>,
  ) => {
    if (!isCarUnlocked) {
      showNotice(`Unlock ${previewCar.name} first to customize it`);
      return;
    }
    if (hasCosmetic(key, price)) {
      soundEngine.playClick();
      updateCarCustom(applyPatch);
      return;
    }
    if (save.coins < price) {
      showNotice(`Need ${price - save.coins} more coins`);
      return;
    }
    soundEngine.playCoin();
    onUpdateSave((prev) => ({
      ...prev,
      coins: prev.coins - price,
      unlockedCosmetics: [...prev.unlockedCosmetics, key],
      customizations: {
        ...prev.customizations,
        [previewCarId]: {
          ...prev.customizations[previewCarId],
          ...applyPatch,
        },
      },
    }));
  };

  const handleBuyOrSelectCar = (id: CarId) => {
    const target = getCarById(id);
    if (save.unlockedCars.includes(id)) {
      soundEngine.playClick();
      setPreviewCarId(id);
      onUpdateSave((prev) => ({ ...prev, selectedCar: id }));
      return;
    }
    if (save.coins < target.price) {
      setPreviewCarId(id);
      showNotice(`Need ${target.price - save.coins} more coins to buy ${target.name}`);
      return;
    }
    soundEngine.playLevelWin();
    setPreviewCarId(id);
    onUpdateSave((prev) => ({
      ...prev,
      coins: prev.coins - target.price,
      unlockedCars: [...prev.unlockedCars, id],
      selectedCar: id,
    }));
    showNotice(`${target.name} unlocked!`);
  };

  const handleUpgrade = (stat: 'speed' | 'handling') => {
    if (!isCarUnlocked) {
      showNotice(`Unlock ${previewCar.name} first`);
      return;
    }
    const currLv = stat === 'speed' ? custom.speedLevel : custom.handlingLevel;
    if (currLv >= 3) return;
    const cost = UPGRADE_COSTS[stat][currLv];
    if (save.coins < cost) {
      showNotice(`Need ${cost - save.coins} more coins`);
      return;
    }
    soundEngine.playCoin();
    onUpdateSave((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      customizations: {
        ...prev.customizations,
        [previewCarId]: {
          ...prev.customizations[previewCarId],
          speedLevel: stat === 'speed' ? currLv + 1 : prev.customizations[previewCarId].speedLevel,
          handlingLevel:
            stat === 'handling' ? currLv + 1 : prev.customizations[previewCarId].handlingLevel,
        },
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col lg:flex-row bg-[#0b0e14] text-slate-100">
      {/* LEFT: 3D Showroom Viewport */}
      <div className="relative w-full h-[42vh] lg:h-full lg:flex-1 border-b lg:border-b-0 lg:border-r border-white/10">
        <GarageViewport carId={previewCarId} customization={custom} />

        {/* Top-Left Showroom Header */}
        <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between gap-4">
          <div className="pointer-events-auto flex items-center gap-3">
            <button
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0b0e14]/90 hover:bg-slate-800 border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Drive</span>
            </button>
          </div>

          <div className="rounded-xl bg-[#0b0e14]/90 border border-white/15 px-3.5 py-2 flex items-center gap-2 font-mono-num font-bold text-amber-400">
            <Coins className="w-4 h-4" />
            <span>{save.coins}</span>
          </div>
        </div>

        {/* Bottom-Left Car Identity & Specs */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div className="rounded-xl bg-[#0b0e14]/90 border border-white/10 px-4 py-3 max-w-sm">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{isCarUnlocked ? 'Owned' : `Locked · ${previewCar.price} Coins`}</span>
              <span aria-hidden="true">·</span>
              <span>Drag to rotate 360°</span>
            </div>
            <h2 className="mt-0.5 font-display text-2xl font-bold text-white">
              {previewCar.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{previewCar.tagline}</p>
          </div>

          {notice && (
            <div className="rounded-xl bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold shadow-lg">
              {notice}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Customization & Car Shop Panel */}
      <div className="w-full lg:w-[440px] flex-1 lg:flex-none flex flex-col bg-[#101521] overflow-hidden">
        {/* Segmented Tabs */}
        <div className="p-3 border-b border-white/10 grid grid-cols-4 gap-1.5 bg-[#0d111b]">
          {(
            [
              { id: 'cars', label: 'Cars' },
              { id: 'paint', label: 'Paint' },
              { id: 'wheels', label: 'Wheels' },
              { id: 'tuning', label: 'Mods' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                soundEngine.playClick();
                setTab(t.id);
              }}
              className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === t.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-5">
          {tab === 'cars' && (
            <div className="space-y-2.5">
              {CARS.map((car) => {
                const owned = save.unlockedCars.includes(car.id);
                const selected = save.selectedCar === car.id;
                const previewing = previewCarId === car.id;
                return (
                  <div
                    key={car.id}
                    onClick={() => setPreviewCarId(car.id)}
                    className={`rounded-xl border p-3.5 transition-colors cursor-pointer ${
                      previewing
                        ? 'bg-slate-800/90 border-amber-500/70'
                        : 'bg-slate-900/70 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-base text-white">
                            {car.name}
                          </h3>
                          {selected && (
                            <span className="text-[11px] font-semibold text-emerald-400">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{car.tagline}</p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 font-mono-num">
                          <span>Speed {Math.round(car.maxSpeed * 6.5)} km/h</span>
                          <span>·</span>
                          <span>Hits {car.durability}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyOrSelectCar(car.id);
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-emerald-500 text-slate-950'
                            : owned
                              ? 'bg-slate-700 hover:bg-slate-600 text-white'
                              : save.coins >= car.price
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-400 border border-white/10'
                        }`}
                      >
                        {selected ? (
                          <span className="flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Selected
                          </span>
                        ) : owned ? (
                          'Select'
                        ) : (
                          <span className="flex items-center gap-1 font-mono-num">
                            <Lock className="w-3 h-3" /> {car.price}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'paint' && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Body Color</h3>
                <div className="grid grid-cols-5 gap-2.5">
                  {BODY_COLORS.map((c) => {
                    const key = `color:${c.hex}`;
                    const unlocked = hasCosmetic(key, c.price);
                    const active = custom.bodyColor.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        onClick={() => buyOrApplyCosmetic(key, c.price, { bodyColor: c.hex })}
                        className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-slate-800'
                            : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                        }`}
                        title={c.name}
                      >
                        <span
                          className="w-7 h-7 rounded-lg border border-white/25 block"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-[10px] font-mono-num text-slate-300">
                          {active ? 'On' : unlocked ? 'Free' : `${c.price}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Paint Finish</h3>
                <div className="grid grid-cols-3 gap-2">
                  {PAINT_FINISHES.map((f) => {
                    const key = `finish:${f.id}`;
                    const unlocked = hasCosmetic(key, f.price);
                    const active = custom.paintFinish === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => buyOrApplyCosmetic(key, f.price, { paintFinish: f.id })}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-slate-800 text-white'
                            : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-semibold">{f.name}</div>
                        <div className="text-[11px] font-mono-num text-amber-400 mt-0.5">
                          {active ? 'Equipped' : unlocked ? 'Owned' : `${f.price} coins`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Aero & Decals</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() =>
                      buyOrApplyCosmetic('aero:spoiler', COSMETIC_PRICES.spoiler, {
                        spoiler: !custom.spoiler,
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      custom.spoiler
                        ? 'border-amber-400 bg-slate-800'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Rear Wing Spoiler</div>
                    <div className="text-[11px] font-mono-num text-amber-400 mt-0.5">
                      {custom.spoiler
                        ? 'Equipped (Tap to remove)'
                        : hasCosmetic('aero:spoiler', COSMETIC_PRICES.spoiler)
                          ? 'Owned · Tap to fit'
                          : `${COSMETIC_PRICES.spoiler} coins`}
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      buyOrApplyCosmetic('decal:stripes', COSMETIC_PRICES.stripes, {
                        stripes: !custom.stripes,
                      })
                    }
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      custom.stripes
                        ? 'border-amber-400 bg-slate-800'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Racing Stripes</div>
                    <div className="text-[11px] font-mono-num text-amber-400 mt-0.5">
                      {custom.stripes
                        ? 'Equipped (Tap to remove)'
                        : hasCosmetic('decal:stripes', COSMETIC_PRICES.stripes)
                          ? 'Owned · Tap to fit'
                          : `${COSMETIC_PRICES.stripes} coins`}
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'wheels' && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Rim Design</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {RIM_STYLES.map((r) => {
                    const key = `rim:${r.id}`;
                    const unlocked = hasCosmetic(key, r.price);
                    const active = custom.rimStyle === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => buyOrApplyCosmetic(key, r.price, { rimStyle: r.id })}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-slate-800 text-white'
                            : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-semibold">{r.name}</div>
                        <div className="text-[11px] font-mono-num text-amber-400 mt-0.5">
                          {active ? 'Equipped' : unlocked ? 'Owned' : `${r.price} coins`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Rim Finish Color</h3>
                <div className="grid grid-cols-5 gap-2">
                  {RIM_COLORS.map((rc) => {
                    const key = `rimColor:${rc.hex}`;
                    const unlocked = hasCosmetic(key, rc.price);
                    const active = custom.rimColor.toLowerCase() === rc.hex.toLowerCase();
                    return (
                      <button
                        key={rc.hex}
                        onClick={() => buyOrApplyCosmetic(key, rc.price, { rimColor: rc.hex })}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-slate-800'
                            : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                        }`}
                        title={rc.name}
                      >
                        <span
                          className="w-7 h-7 rounded-full border-2 border-white/30 block"
                          style={{ backgroundColor: rc.hex }}
                        />
                        <span className="text-[10px] font-mono-num text-slate-300">
                          {active ? 'On' : unlocked ? 'Free' : `${rc.price}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'tuning' && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>Performance Tuning ({previewCar.name})</span>
                </h3>
                <div className="space-y-2.5">
                  {(
                    [
                      { key: 'speed', label: 'Engine & Top Speed', lv: custom.speedLevel },
                      { key: 'handling', label: 'Precision Steering', lv: custom.handlingLevel },
                    ] as const
                  ).map((u) => {
                    const maxed = u.lv >= 3;
                    const cost = maxed ? 0 : UPGRADE_COSTS[u.key][u.lv];
                    return (
                      <div
                        key={u.key}
                        className="rounded-xl border border-white/10 bg-slate-900/70 p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-semibold text-white">{u.label}</div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {[1, 2, 3].map((step) => (
                              <span
                                key={step}
                                className={`h-1.5 w-7 rounded-full ${
                                  step <= u.lv ? 'bg-amber-400' : 'bg-slate-700'
                                }`}
                              />
                            ))}
                            <span className="text-[11px] font-mono-num text-slate-400 ml-1">
                              Lv {u.lv}/3
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUpgrade(u.key)}
                          disabled={maxed}
                          className={`px-3 py-2 rounded-lg text-xs font-bold font-mono-num cursor-pointer transition-colors ${
                            maxed
                              ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                              : save.coins >= cost
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-400 border border-white/10'
                          }`}
                        >
                          {maxed ? 'MAX' : `${cost} Coins`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">Window Tint</h3>
                <div className="grid grid-cols-3 gap-2">
                  {TINT_LEVELS.map((t) => {
                    const key = `tint:${t.id}`;
                    const unlocked = hasCosmetic(key, t.price);
                    const active = custom.tint === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => buyOrApplyCosmetic(key, t.price, { tint: t.id })}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-slate-800 text-white'
                            : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-semibold">{t.name}</div>
                        <div className="text-[11px] font-mono-num text-amber-400 mt-0.5">
                          {active ? 'Equipped' : unlocked ? 'Owned' : `${t.price} coins`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Chassis Underglow</span>
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {UNDERGLOW_OPTIONS.map((ug) => {
                    const key = `glow:${ug.hex || 'none'}`;
                    const unlocked = hasCosmetic(key, ug.price);
                    const active = custom.underglowColor === ug.hex;
                    return (
                      <button
                        key={ug.name}
                        onClick={() =>
                          buyOrApplyCosmetic(key, ug.price, { underglowColor: ug.hex })
                        }
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-slate-800'
                            : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                        }`}
                        title={ug.name}
                      >
                        <span
                          className="w-6 h-6 rounded-full border border-white/25 block"
                          style={{
                            backgroundColor: ug.hex || '#1e293b',
                          }}
                        />
                        <span className="text-[10px] font-mono-num text-slate-300">
                          {active ? 'On' : unlocked ? (ug.hex ? 'Free' : 'Off') : `${ug.price}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Primary Action */}
        <div className="p-4 border-t border-white/10 bg-[#0d111b]">
          {isCarUnlocked ? (
            <button
              onClick={() => {
                soundEngine.playClick();
                onUpdateSave((prev) => ({ ...prev, selectedCar: previewCarId }));
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base transition-colors cursor-pointer"
            >
              Drive {previewCar.name}
            </button>
          ) : (
            <button
              onClick={() => handleBuyOrSelectCar(previewCarId)}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base transition-colors cursor-pointer"
            >
              Buy {previewCar.name} ({previewCar.price} Coins)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
