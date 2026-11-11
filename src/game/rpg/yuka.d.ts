declare module "yuka" {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
  }
  export class SeekBehavior {
    constructor(target: Vector3);
  }
  export class Vehicle {
    position: Vector3;
    velocity: Vector3;
    maxSpeed: number;
    /** Yuka's steering force cap, in the same units as the published class. */
    maxForce: number;
    steering: { add(behavior: SeekBehavior): void };
    update(delta: number): this;
  }
}
