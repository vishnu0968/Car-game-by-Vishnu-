import React from 'react';
import { ArrowRight, Car, Coins, RotateCcw, Star } from 'lucide-react';
import { LevelDefinition } from '../game/types';

interface ResultModalProps {
  mode: 'win' | 'crash';
  level: LevelDefinition;
  stats: {
    time: number;
    hits: number;
    bonusCoins: number;
    stars: number;
    earnedCoins: number;
  } | null;
  hasNextLevel: boolean;
  onRetry: () => void;
  onNextLevel: () => void;
  onOpenGarage: () => void;
  onOpenLevels: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  mode,
  level,
  stats,
  hasNextLevel,
  onRetry,
  onNextLevel,
  onOpenGarage,
  onOpenLevels,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111622] border border-white/15 p-6 shadow-2xl">
        {mode === 'win' && stats ? (
          <>
            <div className="text-center">
              <p className="text-xs font-medium text-emerald-400">
                Level {level.id} Complete · {level.name}
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold text-white">
                Cleanly Parked
              </h2>

              {/* Stars Row */}
              <div className="mt-5 flex items-center justify-center gap-3">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-10 h-10 ${
                      s <= stats.stars
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div className="mt-6 grid grid-cols-3 gap-3 border-y border-white/10 py-4 text-center">
              <div>
                <p className="text-xs text-slate-400">Time</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-white">
                  {stats.time.toFixed(1)}s
                </p>
                <p className="text-[11px] text-slate-500">Par {level.parTime}s</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Bumper Hits</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-white">
                  {stats.hits}
                </p>
                <p className="text-[11px] text-slate-500">{stats.hits === 0 ? 'Flawless' : 'Bumped'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Earned</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-amber-400 flex items-center justify-center gap-1">
                  <Coins className="w-4 h-4" />+{stats.earnedCoins}
                </p>
                <p className="text-[11px] text-slate-500">
                  {stats.bonusCoins > 0 ? `+${stats.bonusCoins} pickup` : 'Base + Star'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {hasNextLevel && (
                <button
                  onClick={onNextLevel}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Next Level</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onRetry}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Replay</span>
                </button>
                <button
                  onClick={onOpenGarage}
                  className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Car className="w-4 h-4" />
                  <span>Garage</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <p className="text-xs font-medium text-red-400">
                Level {level.id} · {level.name}
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold text-white">
                Bumper Damaged
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Too many collisions with walls or parked vehicles. Take turns slower and use Brake + R gear to line up cleanly.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={onRetry}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onOpenLevels}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Levels
                </button>
                <button
                  onClick={onOpenGarage}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Garage
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
