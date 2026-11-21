import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Coins,
  Pause,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  CameraMode,
  GearMode,
  HudTelemetry,
  LevelDefinition,
  SteerControlMode,
} from '../game/types';
import { DrivingInputState } from './GameViewport';

interface DrivingHUDProps {
  level: LevelDefinition;
  telemetry: HudTelemetry;
  totalCoins: number;
  cameraMode: CameraMode;
  soundEnabled: boolean;
  sensorEnabled: boolean;
  steerMode: SteerControlMode;
  inputRef: React.MutableRefObject<DrivingInputState>;
  onCycleCamera: () => void;
  onToggleSound: () => void;
  onToggleSensor: () => void;
  onPause: () => void;
  onOpenGarage: () => void;
}

const GEARS: GearMode[] = ['P', 'R', 'N', 'D'];
const MAX_WHEEL_DEG = 220;

function getArcColor(dist: number): string {
  if (dist < 0.85) return '#ef4444';
  if (dist < 1.65) return '#facc15';
  return '#22c55e';
}

function normalizeRad(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

export const DrivingHUD: React.FC<DrivingHUDProps> = ({
  level,
  telemetry,
  totalCoins,
  cameraMode,
  soundEnabled,
  sensorEnabled,
  steerMode,
  inputRef,
  onCycleCamera,
  onToggleSound,
  onToggleSensor,
  onPause,
  onOpenGarage,
}) => {
  const [gearUi, setGearUi] = useState<GearMode>(inputRef.current.gear);
  const [gasPressed, setGasPressed] = useState(false);
  const [brakePressed, setBrakePressed] = useState(false);
  const [arrowDir, setArrowDir] = useState<-1 | 0 | 1>(0);

  const wheelContainerRef = useRef<HTMLDivElement | null>(null);
  const wheelSvgRef = useRef<SVGSVGElement | null>(null);
  const wheelPointerIdRef = useRef<number | null>(null);
  const wheelAngleDegRef = useRef<number>(0);
  const wheelPrevPolarRef = useRef<number>(0);
  const wheelPrevXRef = useRef<number>(0);
  const wheelIsDraggingRef = useRef<boolean>(false);

  const shifterTrackRef = useRef<HTMLDivElement | null>(null);
  const shifterPointerIdRef = useRef<number | null>(null);

  // Sync only when keyboard shortcut changes inputRef.current.gear externally
  useEffect(() => {
    if (shifterPointerIdRef.current === null && telemetry.gear === inputRef.current.gear) {
      setGearUi(telemetry.gear);
    }
  }, [telemetry.gear, inputRef]);

  // Smooth spring auto-center for steering wheel when released & keyboard sync
  useEffect(() => {
    let rafId = 0;
    const updateVisualWheel = () => {
      if (!wheelIsDraggingRef.current) {
        if (Math.abs(inputRef.current.steerTarget) > 0.01) {
          const targetDeg = inputRef.current.steerTarget * MAX_WHEEL_DEG;
          wheelAngleDegRef.current += (targetDeg - wheelAngleDegRef.current) * 0.25;
        } else if (Math.abs(wheelAngleDegRef.current) > 0.4) {
          wheelAngleDegRef.current *= 0.78;
        } else {
          wheelAngleDegRef.current = 0;
        }
      }
      if (wheelSvgRef.current) {
        wheelSvgRef.current.style.transform = `rotate(${wheelAngleDegRef.current.toFixed(1)}deg)`;
      }
      rafId = requestAnimationFrame(updateVisualWheel);
    };
    rafId = requestAnimationFrame(updateVisualWheel);
    return () => cancelAnimationFrame(rafId);
  }, [inputRef]);

  const applyGear = (next: GearMode) => {
    soundEngine.unlock();
    if (inputRef.current.gear !== next) {
      inputRef.current.gear = next;
      setGearUi(next);
      soundEngine.playGearShift(next === 'R' ? 'R' : 'D');
    } else if (gearUi !== next) {
      setGearUi(next);
    }
  };

  const pickGearFromClientY = (clientY: number) => {
    const el = shifterTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.999, (clientY - rect.top) / rect.height));
    const idx = Math.floor(ratio * GEARS.length);
    applyGear(GEARS[idx]);
  };

  const onShifterDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    shifterPointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pickGearFromClientY(e.clientY);
  };

  const onShifterMove = (e: React.PointerEvent) => {
    if (shifterPointerIdRef.current !== e.pointerId) return;
    pickGearFromClientY(e.clientY);
  };

  const onShifterUp = (e: React.PointerEvent) => {
    if (shifterPointerIdRef.current !== e.pointerId) return;
    shifterPointerIdRef.current = null;
  };

  const startGas = (e: React.PointerEvent) => {
    e.preventDefault();
    soundEngine.unlock();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    inputRef.current.gas = true;
    setGasPressed(true);
  };
  const stopGas = () => {
    inputRef.current.gas = false;
    setGasPressed(false);
  };

  const startBrake = (e: React.PointerEvent) => {
    e.preventDefault();
    soundEngine.unlock();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    inputRef.current.brake = true;
    setBrakePressed(true);
  };
  const stopBrake = () => {
    inputRef.current.brake = false;
    setBrakePressed(false);
  };

  // Responsive ±220° Steering Wheel with precision response curve
  const onWheelDown = (e: React.PointerEvent) => {
    e.preventDefault();
    soundEngine.unlock();
    const el = wheelContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    wheelPointerIdRef.current = e.pointerId;
    wheelIsDraggingRef.current = true;
    wheelPrevPolarRef.current = Math.atan2(e.clientY - cy, e.clientX - cx);
    wheelPrevXRef.current = e.clientX;
    el.setPointerCapture(e.pointerId);
  };

  const onWheelMove = (e: React.PointerEvent) => {
    if (wheelPointerIdRef.current !== e.pointerId) return;
    const el = wheelContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = Math.hypot(dx, dy);

    let deltaDeg = 0;
    if (radius > 14) {
      const currPolar = Math.atan2(dy, dx);
      const dRad = normalizeRad(currPolar - wheelPrevPolarRef.current);
      wheelPrevPolarRef.current = currPolar;
      deltaDeg = (dRad * 180) / Math.PI;
    } else {
      deltaDeg = (e.clientX - wheelPrevXRef.current) * 2.1;
      wheelPrevPolarRef.current = Math.atan2(dy, dx);
    }
    wheelPrevXRef.current = e.clientX;

    wheelAngleDegRef.current = Math.max(
      -MAX_WHEEL_DEG,
      Math.min(MAX_WHEEL_DEG, wheelAngleDegRef.current + deltaDeg),
    );
    const linear = wheelAngleDegRef.current / MAX_WHEEL_DEG;
    const curved = Math.sign(linear) * Math.pow(Math.abs(linear), 1.15);
    inputRef.current.steerTarget = Math.max(-1, Math.min(1, curved));

    if (wheelSvgRef.current) {
      wheelSvgRef.current.style.transform = `rotate(${wheelAngleDegRef.current.toFixed(1)}deg)`;
    }
  };

  const onWheelUp = (e: React.PointerEvent) => {
    if (wheelPointerIdRef.current !== e.pointerId) return;
    wheelPointerIdRef.current = null;
    wheelIsDraggingRef.current = false;
    inputRef.current.steerTarget = 0;
  };

  const setSteerArrow = (dir: -1 | 0 | 1) => {
    soundEngine.unlock();
    inputRef.current.steerTarget = dir;
    setArrowDir(dir);
  };

  const camLabel =
    cameraMode === 'auto'
      ? '1 2 AUTO'
      : cameraMode === 'cam1'
        ? 'CAM 1'
        : cameraMode === 'cam2'
          ? 'CAM 2'
          : cameraMode === 'interior'
            ? 'INSIDE'
            : 'FREE LOOK';

  const leftDist =
    telemetry.gear === 'R'
      ? telemetry.sensorRearLeft
      : Math.min(telemetry.sensorRearLeft, telemetry.sensorFrontLeft);
  const rightDist =
    telemetry.gear === 'R'
      ? telemetry.sensorRearRight
      : Math.min(telemetry.sensorRearRight, telemetry.sensorFrontRight);
  const leftArcColor = getArcColor(leftDist);
  const rightArcColor = getArcColor(rightDist);
  const showSensorArcs = sensorEnabled && (leftDist < 6.0 || rightDist < 6.0);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            onClick={onPause}
            className="w-12 h-12 rounded-xl bg-black/45 hover:bg-black/65 border border-white/25 flex items-center justify-center text-white shadow-lg cursor-pointer transition-colors"
            title="Pause / Levels / Settings"
            aria-label="Pause Game"
          >
            <Pause className="w-6 h-6 fill-white" />
          </button>

          <div className="rounded-xl bg-black/50 border border-white/20 px-3 py-1.5 flex items-center gap-3 text-xs text-white shadow">
            <span className="font-display font-bold tracking-wide">LV {level.id}</span>
            <span className="text-white/40" aria-hidden="true">·</span>
            <span className="font-mono-num font-bold text-amber-300 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {totalCoins + telemetry.coinsCollectedInRun}
            </span>
            <span className="hidden sm:inline text-white/40" aria-hidden="true">·</span>
            <button
              onClick={onOpenGarage}
              className="hidden sm:flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
            >
              <Car className="w-3.5 h-3.5" />
              <span>Garage</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {telemetry.parkStatus !== 'driving' && (
            <div className="rounded-xl bg-black/75 border border-white/20 px-4 py-2 flex items-center gap-3 shadow-lg">
              {telemetry.parkStatus === 'wrong-direction' ? (
                <span className="text-xs font-bold text-amber-300">
                  Reverse Direction ({level.bay.requiredDirection === 'reverse' ? 'Back In' : 'Front In'})
                </span>
              ) : (
                <>
                  <span className="text-xs font-bold text-emerald-300 whitespace-nowrap">
                    {telemetry.parkStatus === 'hold-steady'
                      ? 'Hold / Shift P to Park'
                      : 'Aligning on Deck'}
                  </span>
                  <div className="w-24 sm:w-32 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-[width] duration-75"
                      style={{ width: `${Math.round(telemetry.parkProgress * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {(cameraMode === 'free' || cameraMode === 'interior') && (
            <div className="rounded-lg bg-black/45 px-3 py-1 text-[11px] font-medium text-white/90 tracking-wide">
              {cameraMode === 'free'
                ? 'Slide screen to orbit 360° around car'
                : 'Cockpit View · Slide screen to look left/right'}
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-start gap-3 sm:gap-4">
          <button
            onClick={onToggleSensor}
            className="flex flex-col items-center gap-0.5 cursor-pointer"
            title="Toggle Ultrasonic Parking Sensors"
          >
            <div
              className={`w-11 h-9 flex items-center justify-center transition-opacity ${
                sensorEnabled ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <svg viewBox="0 0 48 32" className="w-10 h-8 drop-shadow">
                <path d="M6 12 Q24 2 42 12" fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
                <path d="M10 19 Q24 11 38 19" fill="none" stroke="#facc15" strokeWidth="5" strokeLinecap="round" />
                <path d="M15 26 Q24 20 33 26" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-display text-[10px] font-bold tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {sensorEnabled ? 'SENSOR ON' : 'SENSOR OFF'}
            </span>
          </button>

          <button
            onClick={onToggleSound}
            className="flex flex-col items-center gap-0.5 cursor-pointer"
            title="Toggle Audio & Sensor Beeps"
          >
            <div
              className={`w-10 h-9 flex items-center justify-center transition-opacity ${
                soundEnabled ? 'opacity-100' : 'opacity-45'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-8 h-8 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
              ) : (
                <VolumeX className="w-8 h-8 text-slate-300 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
              )}
            </div>
            <span className="font-display text-[10px] font-bold tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {soundEnabled ? 'BEEP ON' : 'BEEP OFF'}
            </span>
          </button>

          <button
            onClick={onCycleCamera}
            className="flex flex-col items-center gap-0.5 cursor-pointer"
            title="Switch Camera View (C)"
          >
            <div className="w-10 h-9 flex items-center justify-center">
              <Camera className="w-8 h-8 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
            </div>
            <span className="font-display text-[10px] font-bold tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
              {camLabel}
            </span>
          </button>
        </div>
      </div>

      {/* BOTTOM CONTROLS ROW */}
      <div className="relative flex items-end justify-between gap-2 pb-1">
        {/* BOTTOM LEFT: Precision ±220° Steering Wheel */}
        <div className="pointer-events-auto flex items-end">
          {steerMode === 'wheel' ? (
            <div
              ref={wheelContainerRef}
              onPointerDown={onWheelDown}
              onPointerMove={onWheelMove}
              onPointerUp={onWheelUp}
              onPointerCancel={onWheelUp}
              className="w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              title="Turn steering wheel left or right (or A/D keys)"
            >
              <svg
                ref={wheelSvgRef}
                viewBox="0 0 180 180"
                className="w-full h-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)] will-change-transform"
              >
                <defs>
                  <linearGradient id="rimGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3f3f46" />
                    <stop offset="50%" stopColor="#27272a" />
                    <stop offset="100%" stopColor="#18181b" />
                  </linearGradient>
                  <linearGradient id="chromeSpoke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#94a3b8" />
                    <stop offset="50%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#64748b" />
                  </linearGradient>
                </defs>

                <circle cx="90" cy="90" r="74" fill="none" stroke="url(#rimGrad)" strokeWidth="18" />
                <circle cx="90" cy="90" r="82" fill="none" stroke="#52525b" strokeWidth="1.5" />
                <circle cx="90" cy="90" r="66" fill="none" stroke="#09090b" strokeWidth="1.5" />
                {/* Grip notches & amber top TDC marker */}
                <rect x="86" y="8" width="8" height="16" rx="2" fill="#f59e0b" />
                <circle cx="24" cy="64" r="2.2" fill="#71717a" />
                <circle cx="156" cy="64" r="2.2" fill="#71717a" />

                <path d="M20 82 L60 78 L60 100 L20 98 Z" fill="#27272a" stroke="#18181b" strokeWidth="1.5" />
                <path d="M160 82 L120 78 L120 100 L160 98 Z" fill="#27272a" stroke="#18181b" strokeWidth="1.5" />

                <rect x="34" y="83" width="14" height="12" rx="3" fill="#18181b" stroke="#52525b" strokeWidth="1" />
                <rect x="132" y="83" width="14" height="12" rx="3" fill="#18181b" stroke="#52525b" strokeWidth="1" />

                <rect x="74" y="108" width="9" height="54" rx="2" fill="url(#chromeSpoke)" />
                <rect x="97" y="108" width="9" height="54" rx="2" fill="url(#chromeSpoke)" />

                <rect x="58" y="66" width="64" height="50" rx="14" fill="#27272a" stroke="#18181b" strokeWidth="2.5" />
                <rect x="74" y="85" width="32" height="9" rx="2" fill="#e2e8f0" />
              </svg>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setSteerArrow(-1);
                }}
                onPointerUp={() => setSteerArrow(0)}
                onPointerCancel={() => setSteerArrow(0)}
                className={`w-16 h-16 sm:w-20 sm:h-16 rounded-xl border-2 flex items-center justify-center touch-none cursor-pointer transition-colors ${
                  arrowDir === -1 || telemetry.steerNorm < -0.2
                    ? 'bg-sky-400 text-slate-950 border-white'
                    : 'bg-black/65 text-white border-white/30'
                }`}
                aria-label="Steer Left"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setSteerArrow(1);
                }}
                onPointerUp={() => setSteerArrow(0)}
                onPointerCancel={() => setSteerArrow(0)}
                className={`w-16 h-16 sm:w-20 sm:h-16 rounded-xl border-2 flex items-center justify-center touch-none cursor-pointer transition-colors ${
                  arrowDir === 1 || telemetry.steerNorm > 0.2
                    ? 'bg-sky-400 text-slate-950 border-white'
                    : 'bg-black/65 text-white border-white/30'
                }`}
                aria-label="Steer Right"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM CENTER: Curved Ultrasonic Parking Sensor Arcs */}
        {showSensorArcs && (
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-2 sm:bottom-3">
            <svg viewBox="0 0 220 44" className="w-40 sm:w-56 h-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
              <path d="M12 16 Q60 28 106 28" fill="none" stroke={leftArcColor} strokeWidth="13" strokeLinecap="butt" />
              <path d="M114 28 Q160 28 208 16" fill="none" stroke={rightArcColor} strokeWidth="13" strokeLinecap="butt" />
            </svg>
          </div>
        )}

        {/* BOTTOM RIGHT: Tap + Vertical Slide P/R/N/D Shifter + Pedals */}
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <div
            ref={shifterTrackRef}
            onPointerDown={onShifterDown}
            onPointerMove={onShifterMove}
            onPointerUp={onShifterUp}
            onPointerCancel={onShifterUp}
            className="rounded-xl bg-gradient-to-b from-slate-100 to-slate-300 border-2 border-slate-700 p-1.5 shadow-2xl flex items-stretch gap-1.5 touch-none select-none cursor-pointer"
            title="Tap or slide vertically to shift P / R / N / D"
          >
            <div className="flex flex-col gap-1">
              {GEARS.map((g) => {
                const active = gearUi === g;
                return (
                  <div
                    key={g}
                    className={`w-11 h-8 sm:w-12 sm:h-9 rounded-md font-display font-bold text-base flex items-center justify-center transition-all ${
                      active
                        ? 'bg-white text-slate-950 shadow-[0_2px_6px_rgba(0,0,0,0.45)] ring-2 ring-slate-900 scale-105'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {g}
                  </div>
                );
              })}
            </div>
            <div className="w-3 rounded-full bg-slate-900 my-1 relative">
              <div
                className="absolute left-0.5 right-0.5 h-6 rounded-full bg-slate-300 transition-all duration-100"
                style={{
                  top:
                    gearUi === 'P'
                      ? '4%'
                      : gearUi === 'R'
                        ? '29%'
                        : gearUi === 'N'
                          ? '54%'
                          : '78%',
                }}
              />
            </div>
          </div>

          <div className="flex items-end gap-3.5 sm:gap-5">
            <button
              onPointerDown={startBrake}
              onPointerUp={stopBrake}
              onPointerCancel={stopBrake}
              className={`w-20 h-16 sm:w-24 sm:h-18 rounded-xl border-2 border-slate-900 p-2 flex flex-col justify-between touch-none cursor-pointer shadow-xl transition-transform ${
                brakePressed ? 'bg-red-200 scale-95 translate-y-0.5' : 'bg-slate-100 hover:bg-white'
              }`}
              aria-label="Brake Pedal"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="w-full h-1.5 rounded-full bg-slate-800 block" />
              ))}
            </button>

            <button
              onPointerDown={startGas}
              onPointerUp={stopGas}
              onPointerCancel={stopGas}
              className={`w-14 h-32 sm:w-16 sm:h-36 rounded-xl border-2 border-slate-900 p-2 flex flex-col justify-between touch-none cursor-pointer shadow-xl transition-transform ${
                gasPressed ? 'bg-[#0095d9] scale-95 translate-y-0.5' : 'bg-[#00b4ff] hover:bg-[#33c4ff]'
              }`}
              aria-label="Gas Pedal"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="w-full h-1.5 rounded-full bg-slate-900/90 block" />
              ))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
