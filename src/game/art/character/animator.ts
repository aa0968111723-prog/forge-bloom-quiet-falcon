import * as THREE from "three";

/**
 * Layered character animation for kit characters.
 *
 * Locomotion (idle / walk / run) runs in an AnimationMixer with weights driven
 * by ground speed, exactly as before. One-shot actions (attack, skill, dodge,
 * hurt, interact) are evaluated from their clip tracks *after* the mixer and
 * slerped over the bones their layer owns, so an upper-body swipe keeps the
 * running legs and a full-body dodge takes the whole skeleton.
 *
 * Actions only ever start from real game events; this class owns no combat
 * state and never decides whether anything hits.
 */
export type ActionLayer = "upper" | "full";

type Sampler = {
  bone: THREE.Object3D;
  kind: "quaternion" | "position";
  interpolant: THREE.Interpolant;
};

type OneShot = {
  name: string;
  duration: number;
  layer: ActionLayer;
  samplers: Sampler[];
};

type Active = { shot: OneShot; time: number; speed: number };

const WALK_FULL = 2.2;
const RUN_START = 4.2;
const RUN_FULL = 6.6;
const FADE_IN = 0.05;
const FADE_OUT = 0.12;

export type AnimatorOptions = {
  upperBody: string[];
  layers: Record<string, ActionLayer>;
  stride: { walk: number; run: number };
};

export class CharacterAnimator {
  readonly mixer: THREE.AnimationMixer;
  private readonly idle: THREE.AnimationAction;
  private readonly walk: THREE.AnimationAction;
  private readonly run: THREE.AnimationAction;
  private readonly shots = new Map<string, OneShot>();
  private readonly upper: Set<string>;
  private readonly stride: { walk: number; run: number };
  private active: Active[] = [];
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  weights = { idle: 1, walk: 0, run: 0, walkRate: 1 };

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[], options: AnimatorOptions) {
    this.mixer = new THREE.AnimationMixer(root);
    const clip = (name: string) => {
      const found = clips.find((c) => c.name === name);
      if (!found) throw new Error(`animation clip "${name}" missing from kit`);
      return found;
    };
    this.idle = this.mixer.clipAction(clip("idle"));
    this.walk = this.mixer.clipAction(clip("walk"));
    this.run = this.mixer.clipAction(clip("run"));
    for (const action of [this.idle, this.walk, this.run]) {
      action.play();
      action.setEffectiveWeight(0);
    }
    this.idle.setEffectiveWeight(1);
    this.upper = new Set(options.upperBody);
    this.stride = options.stride;

    for (const [name, layer] of Object.entries(options.layers)) {
      const c = clips.find((x) => x.name === name);
      if (!c) continue;
      const samplers: Sampler[] = [];
      for (const track of c.tracks) {
        const [boneName, prop] = track.name.split(".");
        const bone = root.getObjectByName(boneName);
        if (!bone || (prop !== "quaternion" && prop !== "position")) continue;
        // Quaternion tracks return a slerping interpolant from this factory.
        const interpolant = track.InterpolantFactoryMethodLinear(new Float32Array(track.getValueSize()));
        samplers.push({ bone, kind: prop, interpolant });
      }
      this.shots.set(name, { name, duration: c.duration, layer, samplers });
    }
  }

  has(name: string) {
    return this.shots.has(name);
  }

  /** Start (or restart) a one-shot action. */
  play(name: string, speed = 1) {
    const shot = this.shots.get(name);
    if (!shot) return;
    // A new action of the same layer replaces the old one.
    this.active = this.active.filter((a) => a.shot.layer !== shot.layer && a.shot.name !== name);
    this.active.push({ shot, time: 0, speed });
  }

  /** Name of the action currently holding the most weight, for tests and HUD. */
  current() {
    return this.active.length ? this.active[this.active.length - 1].shot.name : null;
  }

  update(delta: number, speed: number) {
    const moving = THREE.MathUtils.smoothstep(speed, 0.15, WALK_FULL);
    const running = THREE.MathUtils.smoothstep(speed, RUN_START, RUN_FULL);
    const idleW = 1 - moving;
    const runW = moving * running;
    const walkW = moving * (1 - running);
    this.idle.setEffectiveWeight(idleW);
    this.walk.setEffectiveWeight(walkW);
    this.run.setEffectiveWeight(runW);
    const clamp = (x: number) => THREE.MathUtils.clamp(x, 0.55, 2.4);
    this.walk.timeScale = clamp(speed / this.stride.walk);
    this.run.timeScale = clamp(speed / this.stride.run);
    if (walkW > 0.001 && runW > 0.001) {
      const walkClip = this.walk.getClip();
      const runClip = this.run.getClip();
      const phase = (this.walk.time % walkClip.duration) / walkClip.duration;
      this.run.time = phase * runClip.duration;
    }
    this.weights = { idle: idleW, walk: walkW, run: runW, walkRate: this.walk.timeScale };
    this.mixer.update(delta);

    for (const a of this.active) {
      a.time += delta * a.speed;
      const { duration, layer, samplers } = a.shot;
      const fade = Math.min(1, a.time / FADE_IN, (duration - a.time) / FADE_OUT);
      const weight = THREE.MathUtils.clamp(fade, 0, 1);
      if (weight <= 0) continue;
      const t = Math.min(a.time, duration);
      for (const s of samplers) {
        if (layer === "upper" && !this.upper.has(s.bone.name)) continue;
        const out = s.interpolant.evaluate(t) as Float32Array;
        if (s.kind === "quaternion") {
          this.q.fromArray(out);
          s.bone.quaternion.slerp(this.q, weight);
        } else {
          this.v.fromArray(out);
          s.bone.position.lerp(this.v, weight);
        }
      }
    }
    this.active = this.active.filter((a) => a.time < a.shot.duration);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.active = [];
  }
}
