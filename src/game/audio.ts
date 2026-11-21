class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private enabled = true;
  private lastBeepTime = 0;
  private unlocked = false;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public unlock(): void {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.initEngineLoop();
      this.unlocked = true;
    } catch {
      // Web Audio blocked or unavailable
    }
  }

  private initEngineLoop(): void {
    if (!this.ctx || this.engineOsc) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = 52;

    filter.type = 'lowpass';
    filter.frequency.value = 170;
    filter.Q.value = 2.2;

    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();

    this.engineOsc = osc;
    this.engineFilter = filter;
    this.engineGain = gain;
  }

  public updateEngine(speedNorm: number, active: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const now = this.ctx.currentTime;
    if (!this.enabled || !active || this.ctx.state !== 'running') {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const clamped = Math.min(1, Math.max(0, speedNorm));
    const freq = 48 + clamped * 96;
    const cutoff = 150 + clamped * 380;
    const vol = 0.025 + clamped * 0.04;

    this.engineOsc.frequency.setTargetAtTime(freq, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.06);
    this.engineGain.gain.setTargetAtTime(vol, now, 0.08);
  }

  public updateParkingSensor(distance: number, active: boolean): void {
    if (!this.enabled || !active || !this.ctx || this.ctx.state !== 'running') return;
    if (distance > 3.2) return;

    const nowMs = performance.now();
    // Interval shrinks from 520ms at 3.2m to 130ms at <0.7m
    const t = Math.max(0, Math.min(1, (distance - 0.5) / 2.7));
    const interval = 130 + t * 390;

    if (nowMs - this.lastBeepTime >= interval) {
      this.lastBeepTime = nowMs;
      this.playTone(distance < 0.85 ? 1150 : 880, 0.07, 'sine', 0.06);
    }
  }

  public playGearShift(gear: 'D' | 'R'): void {
    if (!this.enabled) return;
    this.unlock();
    this.playTone(gear === 'R' ? 520 : 660, 0.06, 'triangle', 0.08);
  }

  public playCoin(): void {
    if (!this.enabled) return;
    this.unlock();
    this.playTone(987.77, 0.08, 'sine', 0.09);
    window.setTimeout(() => {
      this.playTone(1318.51, 0.14, 'sine', 0.09);
    }, 65);
  }

  public playConeBump(): void {
    if (!this.enabled) return;
    this.unlock();
    this.playTone(180, 0.09, 'triangle', 0.08, 95);
  }

  public playCrash(): void {
    if (!this.enabled) return;
    this.unlock();
    this.playTone(125, 0.24, 'sawtooth', 0.14, 42);
    this.playTone(75, 0.28, 'square', 0.08, 35);
  }

  public playClick(): void {
    if (!this.enabled) return;
    this.unlock();
    this.playTone(620, 0.035, 'sine', 0.05);
  }

  public playLevelWin(): void {
    if (!this.enabled) return;
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      window.setTimeout(() => {
        this.playTone(freq, idx === notes.length - 1 ? 0.35 : 0.14, 'triangle', 0.1);
      }, idx * 95);
    });
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFreq?: number,
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Safe fallback
    }
  }

  public stopEngine(): void {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }
}

export const soundEngine = new ProceduralSoundEngine();
