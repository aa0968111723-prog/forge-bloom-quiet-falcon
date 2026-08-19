import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { quality } from "../quality";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import {
  CURATED_PLANTS,
  scatterPlants,
  type PlantInstance,
  type PlantSpecies,
} from "../world-data/vegetation.ts";
import { VendorModel, type VendorInstance, type VendorTint, type VendorWind } from "./vendor";
import { applyWind } from "./wind";

/**
 * Campus planting.
 *
 * Placement comes entirely from `world-data/vegetation` — curated instances in
 * the reality corridor, deterministic scatter only in the backdrop. This file
 * only decides how each species is *drawn*, and batches everything into one
 * InstancedMesh per species part, so the whole campus's planting is a dozen
 * draw calls regardless of instance count.
 *
 * Trees are two- or three-part assemblies (trunk + one or two canopy layers)
 * rather than cones: 榕樹 (banyan) reads low and wide with a heavy trunk,
 * 樟樹 (camphor) taller and rounder, generic broadleaf in between. On the low
 * quality tier every canopy collapses to the single cheap blob.
 */
const dummy = new THREE.Object3D();

type SpeciesDraw = {
  /** trunk radius top/bottom, trunk height */
  trunk: [number, number, number] | null;
  trunkColor: string;
  /** canopy pieces: [radius, yOffset, squash] */
  canopy: [number, number, number][];
  canopyColor: string;
  /** ground-hugging pieces use a flattened sphere at this radius/height */
  mat?: "leaf" | "flower" | "moss";
};

const DRAW: Record<PlantSpecies, SpeciesDraw> = {
  banyan: {
    trunk: [0.34, 0.52, 2.6],
    trunkColor: "#5c4a38",
    canopy: [
      [2.9, 3.6, 0.62],
      [2.2, 4.6, 0.6],
    ],
    canopyColor: "#3d6242",
  },
  broadleaf: {
    trunk: [0.2, 0.3, 2.9],
    trunkColor: "#66503c",
    canopy: [
      [2.1, 4.0, 0.78],
      [1.5, 5.3, 0.7],
    ],
    canopyColor: "#48713f",
  },
  camphor: {
    trunk: [0.24, 0.36, 3.8],
    trunkColor: "#6e5a44",
    canopy: [
      [2.3, 5.2, 0.86],
      [1.6, 6.7, 0.8],
    ],
    canopyColor: "#557a44",
  },
  palm: {
    trunk: [0.16, 0.24, 5.6],
    trunkColor: "#8a7458",
    canopy: [[1.7, 5.9, 0.34]],
    canopyColor: "#3f6d3b",
  },
  shrub: {
    trunk: null,
    trunkColor: "#5c4a38",
    canopy: [[0.75, 0.55, 0.78]],
    canopyColor: "#3f6337",
  },
  azalea: {
    trunk: null,
    trunkColor: "#5c4a38",
    canopy: [[0.55, 0.42, 0.8]],
    canopyColor: "#5b7040",
    mat: "flower",
  },
  flowerbed: {
    trunk: null,
    trunkColor: "#5c4a38",
    canopy: [[0.55, 0.12, 0.28]],
    canopyColor: "#5d7342",
    mat: "flower",
  },
  groundcover: {
    trunk: null,
    trunkColor: "#5c4a38",
    canopy: [[0.85, 0.14, 0.24]],
    canopyColor: "#4c6b3c",
  },
  moss: {
    trunk: null,
    trunkColor: "#5c4a38",
    canopy: [[0.5, 0.05, 0.12]],
    canopyColor: "#4a6134",
    mat: "moss",
  },
};

/** Azalea bloom colours: 杜鵑 on this campus flowers pink through white. */
const BLOOMS = ["#d46a8a", "#c45c6a", "#e8a0b4", "#f3dce4"];

/**
 * Vendored CC0 models for the woody species (public/models/vendor/). The
 * drooping willow silhouette stands in for the campus banyans; scales bring
 * each file to the height the species should have. Palms and everything
 * herbaceous stay procedural. Colours are retinted from Quaternius' bright
 * stylised palette towards a wetter, sub-tropical green.
 */
const TREE_TINT: VendorTint = { Wood: "#6b5540", Green: "#4f7244", DarkGreen: "#3d5f3a" };

/**
 * Canopy sway (trunk "Wood" stays rigid). Heights are in the file's local
 * units — the Quaternius models are ~2.5–3.5 units tall before our scale.
 */
const TREE_WIND: VendorWind = {
  Green: { amplitude: 0.055, base: 0.6, top: 2.6 },
  DarkGreen: { amplitude: 0.055, base: 0.6, top: 2.6 },
};
const BUSH_WIND: VendorWind = {
  Green: { amplitude: 0.045, base: 0.1, top: 1.1 },
};

const VENDOR_TREES: Partial<
  Record<PlantSpecies, { url: string; scale: number; tint: VendorTint; wind: VendorWind }>
> = {
  banyan: { url: "/models/vendor/quaternius/Willow_1.glb", scale: 3.4, tint: TREE_TINT, wind: TREE_WIND },
  broadleaf: { url: "/models/vendor/quaternius/CommonTree_1.glb", scale: 3.3, tint: TREE_TINT, wind: TREE_WIND },
  camphor: { url: "/models/vendor/quaternius/CommonTree_3.glb", scale: 2.9, tint: TREE_TINT, wind: TREE_WIND },
  shrub: { url: "/models/vendor/quaternius/Bush_1.glb", scale: 0.9, tint: TREE_TINT, wind: BUSH_WIND },
};

type Batch = {
  species: PlantSpecies;
  plants: PlantInstance[];
};

function batches(density: number, range: number): Batch[] {
  const all = [...CURATED_PLANTS, ...scatterPlants(density)];
  const bySpecies = new Map<PlantSpecies, PlantInstance[]>();
  for (const p of all) {
    const list = bySpecies.get(p.species) ?? [];
    list.push(p);
    bySpecies.set(p.species, list);
  }
  void range;
  return [...bySpecies.entries()].map(([species, plants]) => ({ species, plants }));
}

function TrunkLayer({ batch }: { batch: Batch }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const draw = DRAW[batch.species];
  const trunk = draw.trunk!;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    batch.plants.forEach((p, i) => {
      const y = sampleGroundElevation(p.x, p.z);
      dummy.position.set(p.x, y + (trunk[2] * p.scale) / 2, p.z);
      dummy.rotation.set(0, p.rotationY, 0);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [batch, trunk]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, batch.plants.length]} castShadow>
      <cylinderGeometry args={[trunk[0], trunk[1], trunk[2], 7]} />
      <meshStandardMaterial color={draw.trunkColor} roughness={0.92} />
    </instancedMesh>
  );
}

function CanopyLayer({
  batch,
  layer,
  simple,
}: {
  batch: Batch;
  layer: number;
  simple: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const draw = DRAW[batch.species];
  const [radius, yOff, squash] = draw.canopy[layer];
  const isBloom = draw.mat === "flower";

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    batch.plants.forEach((p, i) => {
      const y = sampleGroundElevation(p.x, p.z);
      dummy.position.set(p.x, y + yOff * p.scale, p.z);
      dummy.rotation.set(0, p.rotationY, 0);
      dummy.scale.set(p.scale, p.scale * squash, p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (isBloom && !mesh.instanceColor) {
      // A real azalea hedge is foliage first: roughly a third of the plants
      // carry blossom, and even those keep a green cast.
      const colours = new Float32Array(batch.plants.length * 3);
      const foliage = new THREE.Color(draw.canopyColor);
      batch.plants.forEach((p, i) => {
        const seed = (i * 7 + Math.abs(Math.round(p.x * 13 + p.z * 5))) % 9;
        const c =
          seed < 3
            ? new THREE.Color(BLOOMS[seed % BLOOMS.length]).lerp(foliage, 0.55)
            : foliage.clone();
        c.toArray(colours, i * 3);
      });
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colours, 3);
    }
    mesh.computeBoundingSphere();
  }, [batch, yOff, squash, isBloom, draw.canopyColor]);

  const segments = simple ? 6 : batch.species === "palm" ? 5 : 9;
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: isBloom ? "#ffffff" : draw.canopyColor,
      roughness: 0.9,
    });
    // Even the cheap blob canopies breathe; shrubs and beds sway less.
    applyWind(m, { amplitude: radius > 1 ? 0.16 : 0.05, base: -radius, top: radius });
    return m;
  }, [isBloom, draw.canopyColor, radius]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, material, batch.plants.length]}
      castShadow={!simple && layer === 0}
      receiveShadow
    >
      {batch.species === "palm" ? (
        <coneGeometry args={[radius, radius * 0.9, segments]} />
      ) : (
        <sphereGeometry args={[radius, segments, Math.max(4, segments - 2)]} />
      )}
    </instancedMesh>
  );
}

export function Vegetation() {
  const q = quality();
  const mats = useTamkangMaterials();
  const groups = useMemo(() => batches(q.vegetationDensity, q.vegetationRange), [q]);

  return (
    <group>
      {groups.map((batch) => {
        const vendor = q.simpleTrees ? undefined : VENDOR_TREES[batch.species];
        if (vendor) {
          const instances: VendorInstance[] = batch.plants.map((p) => ({
            x: p.x,
            // Rooted slightly below grade so a trunk on a bank never floats on
            // its downhill side.
            y: sampleGroundElevation(p.x, p.z) - 0.18,
            z: p.z,
            scale: vendor.scale * p.scale,
            rotationY: p.rotationY,
          }));
          return (
            <VendorModel
              key={batch.species}
              url={vendor.url}
              instances={instances}
              tint={vendor.tint}
              wind={vendor.wind}
            />
          );
        }
        const draw = DRAW[batch.species];
        const layers = q.simpleTrees ? 1 : draw.canopy.length;
        return (
          <group key={batch.species}>
            {draw.trunk && <TrunkLayer batch={batch} />}
            {Array.from({ length: layers }).map((_, layer) => (
              <CanopyLayer key={layer} batch={batch} layer={layer} simple={q.simpleTrees} />
            ))}
          </group>
        );
      })}
      {/* Moss decals along the damp lower flight use the real moss material. */}
      <MossPatches wet={surface(mats["kenan/moss"], {})} />
    </group>
  );
}

function MossPatches({ wet }: { wet: ReturnType<typeof surface> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const patches = useMemo(() => CURATED_PLANTS.filter((p) => p.species === "moss"), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    patches.forEach((p, i) => {
      dummy.position.set(p.x, sampleGroundElevation(p.x, p.z) + 0.015, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, p.rotationY);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [patches]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, patches.length]}>
      <circleGeometry args={[0.55, 10]} />
      <meshStandardMaterial {...wet} transparent opacity={0.9} polygonOffset polygonOffsetFactor={-3} />
    </instancedMesh>
  );
}
