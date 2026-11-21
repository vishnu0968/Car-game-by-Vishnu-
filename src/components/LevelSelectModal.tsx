import React from 'react';
import { Coins, Lock, Star, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { LEVELS } from '../game/levels';
import { SaveData } from '../game/types';

interface LevelSelectModalProps {
  save: SaveData;
  currentLevelId: number;
  onSelectLevel: (levelId: number) => void;
  onClose: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  save,
  currentLevelId,
  onSelectLevel,
  onClose,
}) => {
  const totalStars = Object.values(save.levelStars).reduce((acc, s) => acc + s, 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#101521] border border-white/15 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c1019]">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Parking Courses</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalStars} / {LEVELS.length * 3} Stars Earned · {save.coins} Coins
            </p>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
            aria-label="Close Level Select"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scroll grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {LEVELS.map((lv) => {
            const unlocked = lv.id <= save.highestUnlockedLevel;
            const stars = save.levelStars[lv.id] || 0;
            const bestTime = save.levelBestTime[lv.id];
            const isActive = lv.id === currentLevelId;

            return (
              <button
                key={lv.id}
                disabled={!unlocked}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectLevel(lv.id);
                }}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  !unlocked
                    ? 'bg-slate-900/40 border-white/5 opacity-55 cursor-not-allowed'
                    : isActive
                      ? 'bg-slate-800/90 border-amber-400 cursor-pointer'
                      : 'bg-slate-900/80 border-white/10 hover:border-white/25 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono-num font-semibold text-amber-400">
                        Level {String(lv.id).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{lv.theme}</span>
                      {lv.bay.requiredDirection === 'reverse' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-sky-400">Reverse Bay</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 font-display text-lg font-bold text-white">{lv.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{lv.subtitle}</p>
                  </div>

                  {!unlocked ? (
                    <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0 mt-1">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-mono-num">
                  <span className="text-slate-400">
                    {bestTime !== undefined ? `Best ${bestTime.toFixed(1)}s` : `Par ${lv.parTime}s`}
                  </span>
                  <span className="text-amber-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />+{lv.rewardCoins}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
