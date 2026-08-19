class CampusAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: OscillatorNode | null = null;
  private ambGain: GainNode | null = null;
  private lastStep = 0;
  muted = false;

  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.22;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.startAmbient();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.ctx.currentTime, 0.05);
    }
  }

  footstep(now: number, sprint: boolean) {
    if (!this.ctx || !this.master || this.muted) return;
    const gap = sprint ? 280 : 420;
    if (now - this.lastStep < gap) return;
    this.lastStep = now;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 90 + Math.random() * 40;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  stamp() {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = [392, 494, 587];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55 + i * 0.05);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(t + i * 0.04);
      osc.stop(t + 0.6);
    });
  }

  private startAmbient() {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;
    g.gain.value = 0.04;
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    this.ambient = osc;
    this.ambGain = g;
  }
}

export const campusAudio = new CampusAudio();
