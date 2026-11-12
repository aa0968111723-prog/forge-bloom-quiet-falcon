import { useEffect, useLayoutEffect, useMemo, useRef, type JSX } from "react";
import * as THREE from "three";
import { quality } from "../quality";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { libraryRampTriangles } from "../world-data/library-ramp.ts";
import { railingSegmentFrame } from "../world-data/railing-frame.ts";
import { NOTICE_LINES } from "../world-data/notice-copy.ts";
import { PROPS, railingPostBases, type PropInstance, type PropKind } from "../world-data/props.ts";
import { VendorModel, type VendorInstance } from "./vendor";

/**
 * Campus small objects — the detail pass.
 *
 * Placement lives in `world-data/props`; this file owns only how each kind is
 * drawn. Every kind is one InstancedMesh per part, so ~280 props cost a couple
 * dozen draw calls. Strip props (gutters, railings, tactile strips, planters)
 * scale a unit box along the instance's `length`.
 *
 * The modelling rule from the issue: right type in the right place beats
 * polygon count. A bench is four boxes; what matters is that it faces the
 * avenue, sits by the landing, and casts a shadow.
 */
const dummy = new THREE.Object3D();

type Part = {
  /** unit geometry, built once per kind */
  geometry: THREE.BufferGeometry;
  material: JSX.IntrinsicElements["meshStandardMaterial"];
  /** local transform applied before the instance transform */
  offset?: [number, number, number];
  /** if true the part's Z scale follows instance.length */
  stretchZ?: boolean;
  castShadow?: boolean;
  /** Draw the shared notice lines on this face. */
  paper?: boolean;
};

function box(w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d);
}
function cyl(rTop: number, rBottom: number, h: number, seg = 8) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg);
}

const METAL_DARK = { color: "#3c4043", roughness: 0.5, metalness: 0.55 } as const;
const METAL_GREY = { color: "#8c8880", roughness: 0.42, metalness: 0.55 } as const;
const WOOD = { color: "#7a5a3a", roughness: 0.82 } as const;
const CONCRETE = { color: "#b0aca2", roughness: 0.9 } as const;

/** Part list per prop kind. Geometries are shared across instances. */
function buildParts(kind: PropKind): Part[] {
  switch (kind) {
    case "lantern-post":
      // Drawn by LanternAvenue with the full material set; skip here.
      return [];
    case "street-lamp":
      return [
        { geometry: cyl(0.06, 0.09, 4.6), material: METAL_DARK, offset: [0, 2.3, 0], castShadow: true },
        { geometry: box(0.09, 0.09, 1.0), material: METAL_DARK, offset: [0, 4.58, 0.42] },
        { geometry: box(0.34, 0.12, 0.62), material: { color: "#e8e4d8", roughness: 0.3, emissive: "#fff2c9", emissiveIntensity: 0 }, offset: [0, 4.5, 0.86] },
      ];
    case "bench":
      return [
        { geometry: box(1.7, 0.07, 0.46), material: WOOD, offset: [0, 0.46, 0], castShadow: true },
        { geometry: box(1.7, 0.34, 0.06), material: WOOD, offset: [0, 0.74, -0.22] },
        { geometry: box(0.09, 0.46, 0.42), material: METAL_DARK, offset: [-0.72, 0.23, 0] },
        { geometry: box(0.09, 0.46, 0.42), material: METAL_DARK, offset: [0.72, 0.23, 0] },
      ];
    case "bin":
      return [
        { geometry: cyl(0.28, 0.24, 0.78, 10), material: { color: "#2f5d43", roughness: 0.6, metalness: 0.2 }, offset: [0, 0.4, 0], castShadow: true },
        { geometry: cyl(0.3, 0.3, 0.06, 10), material: METAL_DARK, offset: [0, 0.82, 0] },
      ];
    case "sign-post":
      return [
        { geometry: cyl(0.045, 0.05, 2.4, 6), material: METAL_GREY, offset: [0, 1.2, 0], castShadow: true },
        { geometry: box(1.15, 0.75, 0.05), material: { color: "#245c3d", roughness: 0.5 }, offset: [0, 2.05, 0] },
      ];
    case "name-plate":
      return [{ geometry: box(0.08, 0.5, 1.6), material: { color: "#f0ebe0", roughness: 0.5 }, offset: [0, 1.9, 0] }];
    case "drain-grate":
      return [{ geometry: box(0.42, 0.05, 0.6), material: { ...METAL_DARK, color: "#43464a" }, offset: [0, 0.03, 0] }];
    case "gutter":
      return [{ geometry: box(0.36, 0.06, 1), material: { color: "#5c5f61", roughness: 0.8 }, offset: [0, 0.015, 0], stretchZ: true }];
    case "railing":
      // Drawn by RailingRun so the bars follow the ramp instead of one level box.
      return [];
    case "bollard":
      return [{ geometry: cyl(0.09, 0.11, 0.85, 8), material: CONCRETE, offset: [0, 0.42, 0], castShadow: true }];
    case "utility-box":
      return [
        { geometry: box(0.9, 1.25, 0.5), material: { color: "#7d8a80", roughness: 0.55, metalness: 0.25 }, offset: [0, 0.66, 0], castShadow: true },
        { geometry: box(0.94, 0.06, 0.54), material: METAL_DARK, offset: [0, 1.32, 0] },
      ];
    case "hydrant":
      return [
        { geometry: cyl(0.13, 0.15, 0.72, 8), material: { color: "#b8342a", roughness: 0.45, metalness: 0.2 }, offset: [0, 0.36, 0], castShadow: true },
        { geometry: new THREE.SphereGeometry(0.14, 8, 6), material: { color: "#b8342a", roughness: 0.45, metalness: 0.2 }, offset: [0, 0.76, 0] },
        { geometry: cyl(0.05, 0.05, 0.34, 6), material: { color: "#8f2a22", roughness: 0.5 }, offset: [0, 0.5, 0] },
      ];
    case "ac-unit":
      return [
        { geometry: box(0.84, 0.62, 0.32), material: { color: "#d8d5cc", roughness: 0.55 }, offset: [0, 0.6, 0], castShadow: true },
        { geometry: cyl(0.22, 0.22, 0.05, 12), material: METAL_DARK, offset: [0, 0.6, 0.17] },
      ];
    case "tactile-strip":
      return [{ geometry: box(0.6, 0.03, 1), material: { color: "#d9bc55", roughness: 0.8 }, offset: [0, 0.02, 0], stretchZ: true }];
    case "ramp":
      return [];
    case "planter":
      return [
        { geometry: box(0.8, 0.45, 1), material: CONCRETE, offset: [0, 0.22, 0], stretchZ: true, castShadow: true },
        { geometry: box(0.66, 0.1, 0.9), material: { color: "#4a3a2b", roughness: 0.95 }, offset: [0, 0.44, 0], stretchZ: true },
      ];
    case "potted-plant":
      return [
        { geometry: cyl(0.2, 0.16, 0.34, 8), material: { color: "#9a5a40", roughness: 0.8 }, offset: [0, 0.17, 0], castShadow: true },
        { geometry: new THREE.SphereGeometry(0.32, 7, 6), material: { color: "#41633a", roughness: 0.9 }, offset: [0, 0.56, 0] },
      ];
    case "noticeboard":
      return [
        { geometry: box(1.9, 1.1, 0.08), material: { color: "#4a3a2c", roughness: 0.7 }, offset: [0, 1.45, 0], castShadow: true },
        { geometry: box(1.7, 0.9, 0.02), material: { color: "#f6f1e4", roughness: 0.6 }, offset: [0, 1.45, 0.05], paper: true },
        { geometry: cyl(0.05, 0.05, 1.0, 6), material: METAL_DARK, offset: [-0.8, 0.5, 0] },
        { geometry: cyl(0.05, 0.05, 1.0, 6), material: METAL_DARK, offset: [0.8, 0.5, 0] },
      ];
  }
}

function LibraryRampMesh() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(libraryRampTriangles().flat(2));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial {...CONCRETE} />
    </mesh>
  );
}

function RailingRun({ instances }: { instances: PropInstance[] }) {
  const posts = useMemo(() => instances.flatMap((rail) => railingPostBases(rail)), [instances]);
  const bars = useMemo(() => {
    const out: ReturnType<typeof railingSegmentFrame>[] = [];
    for (const rail of instances) {
      const bases = railingPostBases(rail);
      for (let i = 1; i < bases.length; i++) {
        for (const height of [0.96, 0.55]) {
          out.push(
            railingSegmentFrame(
              { ...bases[i - 1], y: bases[i - 1].y + height },
              { ...bases[i], y: bases[i].y + height },
            ),
          );
        }
      }
    }
    return out;
  }, [instances]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    posts.forEach((post, i) => {
      dummy.position.set(post.x, post.y + 0.51, post.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [posts]);
  if (posts.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, posts.length]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 1.02, 6]} />
        <meshStandardMaterial {...METAL_GREY} />
      </instancedMesh>
      {bars.map((bar, i) => (
        <mesh key={i} position={[bar.x, bar.y, bar.z]} quaternion={bar.quaternion} castShadow>
          <boxGeometry args={[0.05, 0.05, bar.length]} />
          <meshStandardMaterial {...METAL_GREY} />
        </mesh>
      ))}
    </group>
  );
}

function noticePaperTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#f6f1e4";
  ctx.fillRect(0, 0, 512, 288);
  ctx.strokeStyle = "#4a3a2c";
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, 476, 252);
  ctx.fillStyle = "#2a241c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  NOTICE_LINES.forEach((line, index) => {
    ctx.font = index === 0 ? "700 72px 'Microsoft JhengHei', sans-serif" : "500 42px 'Microsoft JhengHei', sans-serif";
    ctx.fillText(line, 256, index === 0 ? 118 : 196);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function PartLayer({ part, instances }: { part: Part; instances: PropInstance[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const paper = useMemo(() => (part.paper ? noticePaperTexture() : null), [part.paper]);
  useEffect(() => () => paper?.dispose(), [paper]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    instances.forEach((p, i) => {
      const y = sampleGroundElevation(p.x, p.z);
      const off = part.offset ?? [0, 0, 0];
      const stretch = part.stretchZ ? (p.length ?? 1) : 1;
      dummy.position.set(p.x, y, p.z);
      dummy.rotation.set(0, p.rotationY, 0);
      dummy.scale.set(p.scale, p.scale, 1);
      dummy.updateMatrix();
      const local = new THREE.Matrix4()
        .makeScale(1, 1, stretch)
        .setPosition(off[0], off[1], off[2]);
      dummy.matrix.multiply(local);
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances, part]);
  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, undefined, instances.length]}
      castShadow={part.castShadow ?? false}
      receiveShadow
    >
      <meshStandardMaterial {...part.material} map={paper ?? undefined} />
    </instancedMesh>
  );
}

/**
 * KayKit City Builder Bits (CC0) stand-ins for the props whose shape a box
 * cannot fake. The files are authored tiny (a bench is 0.4 units long), so
 * each entry carries the scale that brings it to real size.
 */
const VENDOR_PROPS: Partial<Record<PropKind, { url: string; scale: number }>> = {
  bench: { url: "/models/vendor/kaykit/bench.gltf", scale: 4.2 },
  hydrant: { url: "/models/vendor/kaykit/firehydrant.gltf", scale: 3.4 },
  "street-lamp": { url: "/models/vendor/kaykit/streetlight.gltf", scale: 4.7 },
};

export function Props({ lampsOn: _lampsOn }: { lampsOn: boolean }) {
  const q = quality();

  const byKind = useMemo(() => {
    const map = new Map<PropKind, PropInstance[]>();
    for (const p of PROPS) {
      if (p.kind === "lantern-post") continue; // drawn by LanternAvenue
      const list = map.get(p.kind) ?? [];
      list.push(p);
      map.set(p.kind, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <group>
      {byKind.map(([kind, instances]) => {
        const vendor = q.tier === "high" ? VENDOR_PROPS[kind] : undefined;
        if (vendor) {
          const vendorInstances: VendorInstance[] = instances.map((p) => ({
            x: p.x,
            y: sampleGroundElevation(p.x, p.z),
            z: p.z,
            scale: vendor.scale * p.scale,
            rotationY: p.rotationY,
          }));
          return <VendorModel key={kind} url={vendor.url} instances={vendorInstances} />;
        }
        if (kind === "ramp") return <LibraryRampMesh key={kind} />;
        const parts = buildParts(kind);
        return (
          <group key={kind}>
            {parts.map((part, i) => (
              <PartLayer key={i} part={part} instances={instances} />
            ))}
            {kind === "railing" && <RailingRun instances={instances} />}
          </group>
        );
      })}
    </group>
  );
}
