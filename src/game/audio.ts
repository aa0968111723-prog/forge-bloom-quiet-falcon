/**
 * Procedural campus audio — no samples, everything synthesised in WebAudio.
 *
 * The soundscape is three layers:
 *  - wind: filtered noise whose gusts follow a slow LFO; the campus baseline
 *  - birds at day / crickets at night, sparse and randomised so they never loop
 *  - footsteps voiced by surface: a knock on stone paving, a soft brush on
 *    grass — read from the ground the player is actually standing on
 */
export type FootSurface = "stone" | "grass";
export type AmbienceMood = "day" | "night";

class CampusAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private chirpTimer: number | null = null;
  private mood: AmbienceMood = "day";
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
    this.startWind();
    this.scheduleChirps();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.ctx.currentTime, 0.05);
    }
  }

  /** Day birdsong vs night crickets; also nudges the wind tone. */
  setMood(mood: AmbienceMood) {
    this.mood = mood;
    if (this.windFilter && this.ctx) {
      this.windFilter.frequency.setTargetAtTime(mood === "night" ? 420 : 640, this.ctx.currentTime, 1.2);
    }
  }

  footstep(now: number, sprint: boolean, surface: FootSurface = "stone") {
    if (!this.ctx || !this.master || this.muted) return;
    const gap = sprint ? 280 : 420;
    if (now - this.lastStep < gap) return;
    this.lastStep = now;
    const t = this.ctx.currentTime;
    if (surface === "stone") {
      // Short knock: filtered noise burst + low thump.
      const noise = this.noiseBurst(0.05);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900 + Math.random() * 500;
      bp.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      noise.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      noise.start(t);
    } else {
      // Grass: softer, darker swish.
      const noise = this.noiseBurst(0.09);
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700 + Math.random() * 300;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      noise.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      noise.start(t);
    }
    // Both get a faint low thump for weight.
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 70 + Math.random() * 20;
    og.gain.setValueAtTime(0.06, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og);
    og.connect(this.master);
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

  /** Looping noise buffer through a lowpass whose gain breathes on an LFO. */
  private startWind() {
    if (!this.ctx || !this.master) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(4);
    noise.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 640;
    lp.Q.value = 0.4;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    // Gusts: a slow LFO modulating the wind gain around its base.
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.028;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    noise.connect(lp);
    lp.connect(gain);
    gain.connect(this.master);
    noise.start();
    lfo.start();
    this.windGain = gain;
    this.windFilter = lp;
  }

  /** Sparse randomised bird chirps (day) or cricket pulses (night). */
  private scheduleChirps() {
    if (!this.ctx) return;
    const next = 2200 + Math.random() * 5200;
    this.chirpTimer = window.setTimeout(() => {
      if (this.ctx && !this.muted && this.ctx.state === "running") {
        if (this.mood === "day") this.birdChirp();
        else this.cricket();
      }
      this.scheduleChirps();
    }, next);
  }

  private birdChirp() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < notes; i++) {
      const start = t + i * (0.09 + Math.random() * 0.06);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), start);
      osc.frequency.exponentialRampToValueAtTime(base * (0.8 + Math.random() * 0.15), start + 0.07);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.05, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0005, start + 0.09);
      osc.connect(g);
      g.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.1);
    }
  }

  private cricket() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const pulses = 4 + Math.floor(Math.random() * 4);
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < pulses; i++) {
      const start = t + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.02, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0005, start + 0.04);
      osc.connect(g);
      g.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.05);
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const rate = this.ctx!.sampleRate;
    const buffer = this.ctx!.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    // Pinkish noise: successive averaging tames the hiss.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + white * 0.4) / 1.4;
      data[i] = last * 2.2;
    }
    return buffer;
  }

  private noiseBurst(seconds: number): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuffer(seconds);
    return src;
  }
}

export const campusAudio = new CampusAudio();
