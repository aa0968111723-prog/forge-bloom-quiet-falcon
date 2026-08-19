import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { COLLIDERS, LANDMARKS, TIME_PRESETS, kenanY, terrainHeight, type TimeOfDay } from "./world";

const dummy = new THREE.Object3D();

const PALACE_ZS = [38.0, 30.8, 23.6, 16.4];
const PALACE_X = 10.7;
const PALACE_W = 6.9;
const PALACE_D = 5.15;

const labelCache = new Map<string, THREE.CanvasTexture>();

function makeCanvasTexture(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function makeLabelMap(text: string, fg = "#f3eee4", bg = "#1a3f6d", w = 768, h = 192) {
  const key = `${text}|${fg}|${bg}|${w}|${h}`;
  const hit = labelCache.get(key);
  if (hit) {
    hit.needsUpdate = true;
    return hit;
  }
  const t = makeCanvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.floor(h * 0.46)}px "Noto Serif TC", "WenQuanYi Zen Hei", serif`;
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
  labelCache.set(key, t);
  return t;
}

function makeLatticeMap() {
  return makeCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#f2e6c8";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#6e1812";
    ctx.lineWidth = 8;
    const n = 6;
    const g = 256 / n;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * g, 0);
      ctx.lineTo(i * g, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * g);
      ctx.lineTo(256, i * g);
      ctx.stroke();
    }
    ctx.strokeStyle = "#8b1e16";
    ctx.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * g, 0);
      ctx.lineTo(i * g + g, g);
      ctx.stroke();
    }
  });
}

function makeWindowMap(cols = 8, rows = 4) {
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#2f3a46";
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (c + r) % 3 === 0 ? "#8ec4de" : "#6ea8c8";
        ctx.fillRect(c * cw + 6, r * rh + 8, cw - 12, rh - 16);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(c * cw + 8, r * rh + 10, (cw - 16) * 0.35, (rh - 20) * 0.4);
      }
    }
  });
}

function useFontTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let gone = false;
    const kick = () => {
      if (!gone) {
        labelCache.clear();
        setTick((n) => n + 1);
      }
    };
    document.fonts.ready.then(kick).catch(() => {});
    document.fonts.addEventListener?.("loadingdone", kick);
    return () => {
      gone = true;
    };
  }, []);
  return tick;
}

const KENAN_STEPS: [number, number, number][] = [];
const KENAN_WALLS: [number, number, number][] = [];
const KENAN_BEDS: [number, number, number, number][] = [];
for (let i = 0; i < 56; i++) {
  const t = i / 55;
  const z = 81.8 - t * 15.6;
  const y = kenanY(z) ?? 0.1 + t * 7.1;
  KENAN_STEPS.push([0, y + 0.04, z]);
}
for (let i = 0; i < 76; i++) {
  const t = i / 75;
  const z = 61.8 - t * 17.6;
  const y = kenanY(z) ?? 7.4 + t * 8.8;
  KENAN_STEPS.push([0, y + 0.04, z]);
}
for (let i = 0; i < 20; i++) {
  const t = i / 19;
  const z = 81.5 - t * 15.6;
  const y = (kenanY(z) ?? 0.5) + 0.55;
  KENAN_WALLS.push([-3.72, y, z], [3.72, y, z]);
}
for (let i = 0; i < 24; i++) {
  const t = i / 23;
  const z = 61.5 - t * 17.6;
  const y = (kenanY(z) ?? 7.8) + 0.55;
  KENAN_WALLS.push([-3.72, y, z], [3.72, y, z]);
}
for (let i = 0; i < 18; i++) {
  const t = (i + 0.5) / 18;
  const z = 81.8 - t * 15.6;
  const top = Math.max(0.4, kenanY(z) ?? 0.12 + t * 7.1);
  KENAN_BEDS.push([0, top / 2, z, top]);
}
for (let i = 0; i < 20; i++) {
  const t = (i + 0.5) / 20;
  const z = 61.8 - t * 17.6;
  const top = kenanY(z) ?? 7.4 + t * 8.8;
  KENAN_BEDS.push([0, top / 2, z, top]);
}

function useCampusTextures() {
  const fontTick = useFontTick();
  const [grass, wall, roof, stone] = useTexture([
    "/textures/grass.jpg",
    "/textures/palace-wall.jpg",
    "/textures/roof.jpg",
    "/textures/stone.jpg",
  ]);
  const lattice = useMemo(() => makeLatticeMap(), []);
  const windows = useMemo(() => makeWindowMap(8, 4), []);
  const labels = useMemo(
    () => ({
      kenan: makeLabelMap("克難坡", "#f3eee4", "#5c1812"),
      steps: makeLabelMap("一百三十二階", "#f3eee4", "#5c1812", 720, 160),
      avenue: makeLabelMap("宮燈大道", "#5c1812", "#f3eee4"),
      statue: makeLabelMap("功在作人", "#f3eee4", "#3a2c1c", 640, 160),
      gate: makeLabelMap("淡江大學", "#1a3f6d", "#f3eee4", 900, 200),
      museum: makeLabelMap("海事博物館", "#f3eee4", "#1a3f6d", 900, 180),
      dolphin: makeLabelMap("立足淡江 放眼世界", "#1a3f6d", "#d8d3c8", 780, 160),
      library: makeLabelMap("覺生紀念圖書館", "#f3eee4", "#1a3f6d", 980, 180),
      gym: makeLabelMap("紹謨紀念體育館", "#f3eee4", "#1a3f6d", 900, 180),
      sing: makeLabelMap("唱自己的歌", "#f3eee4", "#3a2c1c", 640, 160),
      tigers: makeLabelMap("五虎崗傳奇", "#f3eee4", "#3a2c1c", 640, 160),
    }),
    [fontTick],
  );
  useLayoutEffect(() => {
    for (const t of [grass, wall, roof, stone, windows]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    grass.repeat.set(36, 28);
    wall.repeat.set(2.4, 1.7);
    roof.repeat.set(3.2, 2.2);
    stone.repeat.set(4, 16);
    windows.repeat.set(1, 1);
    lattice.wrapS = lattice.wrapT = THREE.RepeatWrapping;
    lattice.repeat.set(1, 1);
  }, [grass, wall, roof, stone, lattice, windows]);
  return { grass, wall, roof, stone, lattice, windows, labels };
}

function Terrain({ map }: { map: THREE.Texture }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(250, 190, 110, 84);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={map} color="#8aa86c" roughness={0.92} metalness={0} />
    </mesh>
  );
}

function Path({
  position,
  size,
  color = "#8b8376",
  map,
  rotY = 0,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  map?: THREE.Texture;
  rotY?: number;
}) {
  return (
    <mesh position={position} rotation={[0, rotY, 0]} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        map={map}
        color={color}
        roughness={0.88}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

function Stairs() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const bedRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current || !wallRef.current || !bedRef.current) return;
    KENAN_STEPS.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    KENAN_WALLS.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wallRef.current!.setMatrixAt(i, dummy.matrix);
    });
    KENAN_BEDS.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.set(1, p[3], 1);
      dummy.updateMatrix();
      bedRef.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    wallRef.current.instanceMatrix.needsUpdate = true;
    bedRef.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={bedRef} args={[undefined, undefined, KENAN_BEDS.length]} receiveShadow>
        <boxGeometry args={[7.5, 1, 1.05]} />
        <meshStandardMaterial color="#c8c0b4" roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={ref} args={[undefined, undefined, KENAN_STEPS.length]} receiveShadow>
        <boxGeometry args={[7.4, 0.16, 0.38]} />
        <meshStandardMaterial color="#d4cdc2" roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={wallRef} args={[undefined, undefined, KENAN_WALLS.length]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.82, 0.95]} />
        <meshStandardMaterial color="#9a9388" roughness={0.7} />
      </instancedMesh>
      <mesh position={[0, 0.1, 84.4]} receiveShadow>
        <boxGeometry args={[11, 0.2, 5.2]} />
        <meshStandardMaterial color="#cfc6b8" />
      </mesh>
      <mesh position={[0, 7.42, 64]} receiveShadow>
        <boxGeometry args={[8.2, 0.22, 4.2]} />
        <meshStandardMaterial color="#b7aea0" roughness={0.82} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <group key={`rail${s}`}>
          <mesh position={[s * 3.72, 4.05, 73.8]} rotation={[-Math.atan2(7.1, 15.6), 0, 0]}>
            <boxGeometry args={[0.06, 0.06, 17.2]} />
            <meshStandardMaterial color="#6a6560" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[s * 3.72, 12.1, 53.1]} rotation={[-Math.atan2(8.8, 17.6), 0, 0]}>
            <boxGeometry args={[0.06, 0.06, 19.4]} />
            <meshStandardMaterial color="#6a6560" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[s * 3.95, 7.95, 64]}>
            <boxGeometry args={[0.08, 0.7, 4.0]} />
            <meshStandardMaterial color="#8a8378" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 4.05, 73.8]} rotation={[-Math.atan2(7.1, 15.6), 0, 0]}>
        <boxGeometry args={[0.05, 0.05, 17.2]} />
        <meshStandardMaterial color="#6a6560" metalness={0.5} roughness={0.42} />
      </mesh>
    </group>
  );
}

function SignPlate({
  map,
  position,
  rotation = [0, 0, 0],
  size = [1.8, 0.46],
}: {
  map: THREE.Texture;
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={map} roughness={0.55} metalness={0.08} />
    </mesh>
  );
}

function PalaceRoof({
  width,
  depth,
  y,
  map,
}: {
  width: number;
  depth: number;
  y: number;
  map: THREE.Texture;
}) {
  const overW = width + 1.8;
  const overD = depth + 1.5;
  const roofH = 1.48;
  const r = (Math.max(overW, overD) / 2) * Math.SQRT2 * 0.98;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[overW + 0.22, 0.1, overD + 0.22]} />
        <meshStandardMaterial color="#5c1812" />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[overW + 0.02, 0.08, overD + 0.02]} />
        <meshStandardMaterial color="#c9a227" metalness={0.34} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.15 + roofH / 2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[r, roofH, 4]} />
        <meshStandardMaterial map={map} color="#3d7d58" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.15 + roofH + 0.05, 0]}>
        <boxGeometry args={[Math.min(overW, overD) * 0.42, 0.12, 0.2]} />
        <meshStandardMaterial color="#1a3d2c" />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={`k${s}`} position={[s * Math.min(overW, overD) * 0.18, 0.15 + roofH + 0.18, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#c9a227" metalness={0.48} roughness={0.35} />
        </mesh>
      ))}
      {([-1, 1] as const).flatMap((wx) =>
        ([-1, 1] as const).map((wz) => (
          <mesh
            key={`e${wx}${wz}`}
            position={[wx * (overW / 2 - 0.1), 0.32, wz * (overD / 2 - 0.1)]}
            rotation={[wz * -0.48, 0, wx * 0.34]}
          >
            <boxGeometry args={[0.58, 0.07, 0.14]} />
            <meshStandardMaterial color="#245a3c" />
          </mesh>
        )),
      )}
    </group>
  );
}

function PalaceHall({
  position,
  width,
  depth,
  rotY = 0,
  wall,
  roof,
  lattice,
  night,
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  rotY?: number;
  wall: THREE.Texture;
  roof: THREE.Texture;
  lattice: THREE.Texture;
  night: boolean;
}) {
  const wallH = 3.35;
  const cols = [-width * 0.38, -width * 0.13, width * 0.13, width * 0.38];
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.16, 0.12]} receiveShadow>
        <boxGeometry args={[width + 1.35, 0.32, depth + 1.65]} />
        <meshStandardMaterial color="#d5ccc0" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.1, depth / 2 + 0.95]} receiveShadow>
        <boxGeometry args={[width * 0.52, 0.2, 0.58]} />
        <meshStandardMaterial color="#cfc6b8" />
      </mesh>
      <mesh position={[0, 0.32 + wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, wallH, depth]} />
        <meshStandardMaterial map={wall} color="#b43a2e" roughness={0.68} />
      </mesh>
      <mesh position={[0, 1.42, depth / 2 + 0.04]}>
        <boxGeometry args={[0.86, 2.12, 0.08]} />
        <meshStandardMaterial color="#3a100c" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.58, depth / 2 + 0.09]}>
        <boxGeometry args={[0.16, 1.62, 0.04]} />
        <meshStandardMaterial color="#c9a227" metalness={0.3} roughness={0.45} />
      </mesh>
      {[-0.31, 0.31].map((s) => (
        <mesh key={`w${s}`} position={[s * width, 1.98, depth / 2 + 0.035]}>
          <boxGeometry args={[width * 0.26, 1.38, 0.05]} />
          <meshStandardMaterial
            map={lattice}
            color="#efe6c6"
            roughness={0.52}
            emissive="#efe6c6"
            emissiveIntensity={night ? 0.42 : 0.1}
          />
        </mesh>
      ))}
      {cols.map((x) => (
        <group key={`c${x}`} position={[x, 0, depth / 2 + 0.4]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 0.28, 10]} />
            <meshStandardMaterial color="#cfc6b8" roughness={0.75} />
          </mesh>
          <mesh position={[0, 1.88, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.145, 2.9, 10]} />
            <meshStandardMaterial color="#8b1e16" roughness={0.45} />
          </mesh>
          <mesh position={[0, 3.28, 0.12]}>
            <boxGeometry args={[0.28, 0.16, 0.4]} />
            <meshStandardMaterial color="#c9a227" metalness={0.22} roughness={0.48} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 3.42, depth / 2 + 0.4]}>
        <boxGeometry args={[width * 0.98, 0.14, 0.32]} />
        <meshStandardMaterial color="#6e1812" />
      </mesh>
      {[-width * 0.255, width * 0.255].map((x) => (
        <mesh key={`rail${x}`} position={[x, 1.12, depth / 2 + 0.4]}>
          <boxGeometry args={[width * 0.28, 0.05, 0.05]} />
          <meshStandardMaterial color="#c9a227" metalness={0.3} roughness={0.45} />
        </mesh>
      ))}
      {[-width * 0.22, width * 0.22].map((x) => (
        <group key={`lan${x}`} position={[x, 2.92, depth / 2 + 0.58]}>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 0.62, 6]} />
            <meshStandardMaterial
              color="#c45c4a"
              emissive={night ? "#ff8a3a" : "#5a180c"}
              emissiveIntensity={night ? 1.65 : 0.22}
              roughness={0.38}
            />
          </mesh>
          <mesh position={[0, 0.58, 0]}>
            <coneGeometry args={[0.26, 0.16, 6]} />
            <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <coneGeometry args={[0.05, 0.26, 5]} />
            <meshStandardMaterial color="#a33a2c" roughness={0.55} />
          </mesh>
        </group>
      ))}
      <PalaceRoof width={width} depth={depth} y={0.32 + wallH} map={roof} />
    </group>
  );
}

function AvenueColonnade({
  xSign,
  roof,
  night,
}: {
  xSign: number;
  roof: THREE.Texture;
  night: boolean;
}) {
  const colRef = useRef<THREE.InstancedMesh>(null);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const hatRef = useRef<THREE.InstancedMesh>(null);
  const tasselRef = useRef<THREE.InstancedMesh>(null);
  const x = xSign * 6.55;
  const z0 = 14.8;
  const z1 = 39.6;
  const n = 15;
  const midZ = (z0 + z1) / 2;
  const len = z1 - z0;
  const h = terrainHeight(x, midZ);

  useLayoutEffect(() => {
    if (!colRef.current || !baseRef.current || !capRef.current || !bodyRef.current || !hatRef.current || !tasselRef.current)
      return;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const z = z0 + t * len;
      const gy = terrainHeight(x, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, gy + 0.28, z);
      dummy.updateMatrix();
      baseRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, gy + 1.72, z);
      dummy.updateMatrix();
      colRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x - xSign * 0.55, gy + 3.02, z);
      dummy.updateMatrix();
      capRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x - xSign * 0.55, gy + 2.62, z);
      dummy.updateMatrix();
      bodyRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x - xSign * 0.55, gy + 3.18, z);
      dummy.updateMatrix();
      hatRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x - xSign * 0.55, gy + 2.18, z);
      dummy.updateMatrix();
      tasselRef.current.setMatrixAt(i, dummy.matrix);
    }
    for (const mesh of [colRef, baseRef, capRef, bodyRef, hatRef, tasselRef]) {
      mesh.current!.instanceMatrix.needsUpdate = true;
    }
  }, [x, xSign]);

  return (
    <group>
      <instancedMesh ref={baseRef} args={[undefined, undefined, n]}>
        <cylinderGeometry args={[0.2, 0.22, 0.32, 10]} />
        <meshStandardMaterial color="#cfc6b8" roughness={0.76} />
      </instancedMesh>
      <instancedMesh ref={colRef} args={[undefined, undefined, n]} castShadow>
        <cylinderGeometry args={[0.125, 0.15, 3.12, 10]} />
        <meshStandardMaterial color="#8b1e16" roughness={0.45} />
      </instancedMesh>
      <mesh position={[x - xSign * 0.18, h + 3.28, midZ]} castShadow>
        <boxGeometry args={[1.85, 0.14, len + 0.7]} />
        <meshStandardMaterial map={roof} color="#2a5c40" roughness={0.5} />
      </mesh>
      <mesh position={[x - xSign * 0.18, h + 3.44, midZ]}>
        <boxGeometry args={[0.32, 0.16, len + 0.55]} />
        <meshStandardMaterial color="#1a3d2c" />
      </mesh>
      <mesh position={[x - xSign * 0.18, h + 3.16, midZ]}>
        <boxGeometry args={[1.7, 0.1, len + 0.55]} />
        <meshStandardMaterial color="#6e1812" />
      </mesh>
      <instancedMesh ref={hatRef} args={[undefined, undefined, n]}>
        <coneGeometry args={[0.3, 0.18, 6]} />
        <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, n]}>
        <cylinderGeometry args={[0.26, 0.26, 0.05, 6]} />
        <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, n]} castShadow>
        <cylinderGeometry args={[0.26, 0.28, 0.82, 6]} />
        <meshStandardMaterial
          color="#c45c4a"
          emissive={night ? "#ff8a3a" : "#5a180c"}
          emissiveIntensity={night ? 1.55 : 0.22}
          roughness={0.38}
        />
      </instancedMesh>
      <instancedMesh ref={tasselRef} args={[undefined, undefined, n]}>
        <coneGeometry args={[0.06, 0.32, 5]} />
        <meshStandardMaterial color="#a33a2c" roughness={0.55} />
      </instancedMesh>
    </group>
  );
}

function FacadeWindows({
  size,
  map,
  night,
}: {
  size: [number, number, number];
  map: THREE.Texture;
  night: boolean;
}) {
  const [w, h, d] = size;
  const faces: [number, number, number, number, number, number][] = [
    [0, 0, d / 2 + 0.02, w * 0.9, h * 0.72, 0],
    [0, 0, -d / 2 - 0.02, w * 0.9, h * 0.72, Math.PI],
    [w / 2 + 0.02, 0, 0, d * 0.9, h * 0.72, Math.PI / 2],
    [-w / 2 - 0.02, 0, 0, d * 0.9, h * 0.72, -Math.PI / 2],
  ];
  return (
    <>
      {faces.map(([x, y, z, pw, ph, rot], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, rot, 0]}>
          <planeGeometry args={[pw, ph]} />
          <meshStandardMaterial
            map={map}
            color="#c5d0da"
            roughness={0.22}
            metalness={0.22}
            emissive="#6aa0c0"
            emissiveIntensity={night ? 0.32 : 0.08}
          />
        </mesh>
      ))}
    </>
  );
}

function HipRoofBuilding({
  position,
  size,
  floors,
  color,
  accent,
  windows,
  night,
}: {
  position: [number, number, number];
  size: [number, number, number];
  floors: number;
  color: string;
  accent: string;
  windows: THREE.Texture;
  night: boolean;
}) {
  const floorH = size[1] / floors;
  return (
    <group position={position}>
      {Array.from({ length: floors }, (_, i) => (
        <mesh key={i} position={[0, floorH * i + floorH / 2, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[
              size[0] - (i === floors - 1 ? 0.4 : 0),
              floorH - 0.08,
              size[2] - (i === floors - 1 ? 0.3 : 0),
            ]}
          />
          <meshStandardMaterial color={i % 2 ? color : accent} roughness={0.62} metalness={0.08} />
        </mesh>
      ))}
      <group position={[0, size[1] * 0.46, 0]}>
        <FacadeWindows size={[size[0], size[1] * 0.78, size[2]]} map={windows} night={night} />
      </group>
      <mesh position={[0, size[1] + 0.18, 0]}>
        <boxGeometry args={[size[0] + 0.35, 0.28, size[2] + 0.35]} />
        <meshStandardMaterial color="#6a7380" roughness={0.55} />
      </mesh>
    </group>
  );
}

function Library({
  windows,
  nameMap,
  night,
}: {
  windows: THREE.Texture;
  nameMap: THREE.Texture;
  night: boolean;
}) {
  const h = terrainHeight(12, -32);
  return (
    <group position={[12, h, -32]}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <group key={i}>
          <mesh position={[0, 0.85 + i * 1.52, -i * 0.18]} castShadow receiveShadow>
            <boxGeometry args={[18.2 - i * 0.22, 1.42, 11.6 - i * 0.12]} />
            <meshStandardMaterial color={i % 2 ? "#cfd6de" : "#b7c2ce"} roughness={0.58} />
          </mesh>
          <mesh position={[0, 0.85 + i * 1.52, 5.82 - i * 0.18]}>
            <planeGeometry args={[16.6 - i * 0.2, 0.92]} />
            <meshStandardMaterial
              map={windows}
              color="#d0dbe4"
              roughness={0.2}
              metalness={0.22}
              emissive="#6aa0c0"
              emissiveIntensity={night ? 0.3 : 0.08}
            />
          </mesh>
          <mesh position={[9.12 - i * 0.11, 0.85 + i * 1.52, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[10.4 - i * 0.1, 0.92]} />
            <meshStandardMaterial
              map={windows}
              color="#d0dbe4"
              roughness={0.2}
              metalness={0.2}
              emissive="#6aa0c0"
              emissiveIntensity={night ? 0.22 : 0.06}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.14, 8.2]} receiveShadow>
        <boxGeometry args={[14, 0.28, 7.2]} />
        <meshStandardMaterial color="#d8d3c8" roughness={0.82} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={`st${i}`} position={[0, 0.1 + i * 0.16, 11.4 - i * 0.75]} receiveShadow>
          <boxGeometry args={[11 - i * 0.5, 0.16, 0.9]} />
          <meshStandardMaterial color="#cfc6b8" />
        </mesh>
      ))}
      <mesh position={[0, 2.15, 6.55]} castShadow>
        <boxGeometry args={[9.2, 0.22, 3.4]} />
        <meshStandardMaterial color="#1a3f6d" />
      </mesh>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 1.25, 7.15]} castShadow>
          <boxGeometry args={[0.28, 2.15, 0.28]} />
          <meshStandardMaterial color="#1a3f6d" roughness={0.4} />
        </mesh>
      ))}
      <SignPlate map={nameMap} position={[0, 2.55, 6.78]} size={[5.6, 0.52]} />
      <mesh position={[-10.2, 5.5, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 11, 8]} />
        <meshStandardMaterial color="#4a5560" />
      </mesh>
      <mesh position={[-10.2, 11.1, 0]}>
        <boxGeometry args={[1.1, 0.55, 0.18]} />
        <meshStandardMaterial color="#1a3f6d" />
      </mesh>
    </group>
  );
}

function ShipMuseum({ nameMap }: { nameMap: THREE.Texture }) {
  const h = terrainHeight(50, -16);
  const hullWin = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 10; i++) {
      hullWin.push(
        <mesh key={`hw${row}-${i}`} position={[-6.15 + i * 1.26, 1.08 + row * 0.78, 2.7]}>
          <boxGeometry args={[0.7, 0.4, 0.05]} />
          <meshStandardMaterial color="#1a3f6d" roughness={0.18} metalness={0.32} />
        </mesh>,
      );
    }
  }
  return (
    <group position={[50, h, -16]} rotation={[0, 0.18, 0]}>
      <mesh position={[0, 0.06, 0.5]} receiveShadow>
        <boxGeometry args={[24, 0.12, 12]} />
        <meshStandardMaterial color="#c8c2b6" roughness={0.88} />
      </mesh>
      <mesh position={[0.15, 0.48, 0]} castShadow>
        <boxGeometry args={[15.4, 0.72, 5.55]} />
        <meshStandardMaterial color="#1a3f6d" roughness={0.45} />
      </mesh>
      <mesh position={[0.15, 1.58, 0]} castShadow receiveShadow>
        <boxGeometry args={[14.8, 2.2, 5.35]} />
        <meshStandardMaterial color="#f4f6f8" roughness={0.4} metalness={0.08} />
      </mesh>
      <mesh position={[7.35, 1.58, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <boxGeometry args={[3.9, 2.2, 3.9]} />
        <meshStandardMaterial color="#f4f6f8" roughness={0.4} />
      </mesh>
      <mesh position={[7.35, 0.48, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[3.95, 0.72, 3.95]} />
        <meshStandardMaterial color="#1a3f6d" roughness={0.45} />
      </mesh>
      <mesh position={[-7.55, 1.58, 0]} castShadow>
        <boxGeometry args={[1.35, 2.2, 5.05]} />
        <meshStandardMaterial color="#eef1f4" roughness={0.4} />
      </mesh>
      <mesh position={[0.35, 2.72, 0]} castShadow>
        <boxGeometry args={[17.6, 0.16, 5.9]} />
        <meshStandardMaterial color="#e8edf2" roughness={0.5} />
      </mesh>
      <mesh position={[-0.55, 3.78, 0]} castShadow>
        <boxGeometry args={[9.6, 1.9, 4.2]} />
        <meshStandardMaterial color="#f7f9fb" roughness={0.4} />
      </mesh>
      <mesh position={[1.55, 5.2, 0]} castShadow>
        <boxGeometry args={[4.7, 1.18, 3.4]} />
        <meshStandardMaterial color="#f7f9fb" roughness={0.38} />
      </mesh>
      <mesh position={[3.55, 6.42, 0]} castShadow>
        <cylinderGeometry args={[0.52, 0.7, 2.2, 12]} />
        <meshStandardMaterial color="#c45c4a" roughness={0.48} />
      </mesh>
      <mesh position={[3.55, 7.58, 0]}>
        <cylinderGeometry args={[0.55, 0.52, 0.28, 12]} />
        <meshStandardMaterial color="#1a1714" />
      </mesh>
      <mesh position={[-4.9, 6.7, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 7.8, 8]} />
        <meshStandardMaterial color="#4a5560" metalness={0.4} />
      </mesh>
      <mesh position={[-4.42, 10.25, 0]}>
        <planeGeometry args={[1.15, 0.55]} />
        <meshStandardMaterial color="#1a3f6d" side={THREE.DoubleSide} />
      </mesh>
      {hullWin}
      {[-3.5, -1.7, 0.1, 1.9, 3.6].map((x) => (
        <mesh key={`sw${x}`} position={[x, 3.78, 2.14]}>
          <boxGeometry args={[1.2, 0.72, 0.06]} />
          <meshStandardMaterial color="#1a3f6d" roughness={0.2} />
        </mesh>
      ))}
      {[-1.15, 0.15, 1.45].map((x) => (
        <mesh key={`bw${x}`} position={[1.55 + x, 5.25, 1.74]}>
          <boxGeometry args={[1.05, 0.55, 0.06]} />
          <meshStandardMaterial color="#7eb4d2" roughness={0.15} metalness={0.3} />
        </mesh>
      ))}
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={`rp${x}`} position={[x, 3.08, 2.88]}>
          <boxGeometry args={[0.05, 0.58, 0.05]} />
          <meshStandardMaterial color="#4a5560" metalness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 3.36, 2.88]}>
        <boxGeometry args={[13.4, 0.04, 0.04]} />
        <meshStandardMaterial color="#4a5560" metalness={0.45} />
      </mesh>
      <mesh position={[2.15, 1.58, 3.65]} rotation={[-0.42, 0, 0]} castShadow>
        <boxGeometry args={[1.45, 0.08, 2.9]} />
        <meshStandardMaterial color="#9aa3ae" />
      </mesh>
      {[-2.5, 2.5].map((x) => (
        <mesh key={`lb${x}`} position={[x, 3.12, -2.38]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.22, 1.2, 4, 8]} />
          <meshStandardMaterial color="#c45c4a" />
        </mesh>
      ))}
      <mesh position={[8.85, 1.35, 1.35]}>
        <torusGeometry args={[0.22, 0.05, 8, 14]} />
        <meshStandardMaterial color="#3a3c42" metalness={0.6} roughness={0.35} />
      </mesh>
      <SignPlate map={nameMap} position={[0.15, 2.48, 2.74]} size={[4.4, 0.5]} />
    </group>
  );
}

function Rotor({ radius, speed = 9 }: { radius: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[radius * 2, 0.03, 0.12]} />
        <meshStandardMaterial color="#2a2c32" />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[radius * 2, 0.03, 0.12]} />
        <meshStandardMaterial color="#2a2c32" />
      </mesh>
    </group>
  );
}

function JetAndHeli() {
  const h = terrainHeight(40, -10);
  return (
    <group position={[40, h, -10]}>
      <group rotation={[0, 0.62, 0]}>
        <mesh position={[0, 0.88, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.22, 5.35, 4, 10]} />
          <meshStandardMaterial color="#c5ccd4" metalness={0.55} roughness={0.32} />
        </mesh>
        <mesh position={[2.95, 0.88, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.18, 0.72, 8]} />
          <meshStandardMaterial color="#b7bec6" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[1.2, 1.12, 0]}>
          <sphereGeometry args={[0.22, 8, 6]} />
          <meshStandardMaterial color="#1a3f6d" roughness={0.15} metalness={0.4} />
        </mesh>
        <mesh position={[0.2, 0.84, 0.95]} rotation={[0.06, 0.38, 0.1]} castShadow>
          <boxGeometry args={[2.35, 0.05, 1.05]} />
          <meshStandardMaterial color="#9aa3ae" metalness={0.5} roughness={0.38} />
        </mesh>
        <mesh position={[0.2, 0.84, -0.95]} rotation={[-0.06, -0.38, -0.1]} castShadow>
          <boxGeometry args={[2.35, 0.05, 1.05]} />
          <meshStandardMaterial color="#9aa3ae" metalness={0.5} roughness={0.38} />
        </mesh>
        <mesh position={[-2.45, 1.42, 0]}>
          <boxGeometry args={[0.75, 1.12, 0.06]} />
          <meshStandardMaterial color="#8a93a0" metalness={0.45} />
        </mesh>
        <mesh position={[-2.28, 1.08, 0]}>
          <boxGeometry args={[0.7, 0.05, 1.2]} />
          <meshStandardMaterial color="#8a93a0" metalness={0.45} />
        </mesh>
        {([-1.15, 1.45] as const).map((x) => (
          <mesh key={x} position={[x, 0.32, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.52, 6]} />
            <meshStandardMaterial color="#2a2c32" />
          </mesh>
        ))}
      </group>
      <group position={[4.7, 0, 3.25]} rotation={[0, -0.42, 0]}>
        <mesh position={[0, 1.18, 0]} castShadow>
          <boxGeometry args={[2.2, 1.18, 1.38]} />
          <meshStandardMaterial color="#4a5c3a" roughness={0.55} />
        </mesh>
        <mesh position={[1.18, 1.22, 0]}>
          <sphereGeometry args={[0.56, 8, 6]} />
          <meshStandardMaterial color="#7aa0b8" roughness={0.15} metalness={0.25} />
        </mesh>
        <mesh position={[-2.2, 1.38, 0]} castShadow>
          <boxGeometry args={[2.5, 0.22, 0.22]} />
          <meshStandardMaterial color="#3a4a32" />
        </mesh>
        <mesh position={[-3.35, 1.72, 0]}>
          <boxGeometry args={[0.16, 0.72, 0.55]} />
          <meshStandardMaterial color="#3a4a32" />
        </mesh>
        <group position={[0, 1.88, 0]}>
          <Rotor radius={2.65} />
        </group>
        <mesh position={[-3.38, 1.78, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.72, 0.03, 0.08]} />
          <meshStandardMaterial color="#2a2c32" />
        </mesh>
        {([-0.55, 0.55] as const).map((z) => (
          <mesh key={z} position={[0.12, 0.42, z]}>
            <boxGeometry args={[2.45, 0.05, 0.08]} />
            <meshStandardMaterial color="#2a2c32" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ScrollSculpture() {
  const h = terrainHeight(0, -14);
  return (
    <group position={[0, h, -14]}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.35;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.58, 2.2, Math.sin(a) * 1.58]}
            rotation={[0.18, a + Math.PI / 2, 0.52]}
            castShadow
          >
            <torusGeometry args={[2.08, 0.13, 6, 24, Math.PI * 0.72]} />
            <meshStandardMaterial color="#e4d6b8" roughness={0.42} metalness={0.1} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[6.4, 6.4, 0.16, 32]} />
        <meshStandardMaterial color="#cfc6b8" roughness={0.8} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={`r${i}`} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.4 + i * 0.75, 1.48 + i * 0.75, 32]} />
          <meshStandardMaterial color={i % 2 ? "#d8d0c4" : "#b7aea0"} />
        </mesh>
      ))}
    </group>
  );
}

function BronzeFigure({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0.12, 0.42, 0.04]} rotation={[0.08, 0, 0.04]} castShadow>
        <capsuleGeometry args={[0.1, 0.7, 4, 6]} />
        <meshStandardMaterial color="#6e5c44" metalness={0.4} roughness={0.36} />
      </mesh>
      <mesh position={[-0.12, 0.42, 0.02]} rotation={[-0.04, 0, -0.05]} castShadow>
        <capsuleGeometry args={[0.1, 0.7, 4, 6]} />
        <meshStandardMaterial color="#6e5c44" metalness={0.4} roughness={0.36} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.42, 0.22, 10]} />
        <meshStandardMaterial color="#5c4a32" metalness={0.42} roughness={0.38} />
      </mesh>
      <mesh position={[0, 1.72, 0.04]} castShadow>
        <capsuleGeometry args={[0.26, 0.92, 4, 8]} />
        <meshStandardMaterial color="#6e5c44" metalness={0.4} roughness={0.36} />
      </mesh>
      <mesh position={[0, 2.42, 0.08]} castShadow>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color="#6e5c44" metalness={0.4} roughness={0.36} />
      </mesh>
      <mesh position={[0.36, 1.85, 0.12]} rotation={[0.2, 0, -0.5]} castShadow>
        <capsuleGeometry args={[0.085, 0.68, 3, 6]} />
        <meshStandardMaterial color="#6e5c44" metalness={0.4} roughness={0.36} />
      </mesh>
      <mesh position={[-0.36, 1.85, 0.06]} rotation={[0.08, 0, 0.38]} castShadow>
        <capsuleGeometry args={[0.085, 0.68, 3, 6]} />
        <meshStandardMaterial color="#6e5c44" metalness={0.4} roughness={0.36} />
      </mesh>
    </group>
  );
}

function StatuePlaza({ plaque }: { plaque: THREE.Texture }) {
  const h = terrainHeight(0, 42);
  const steps = [8.5, 7.5, 6.5, 5.5, 4.55, 3.6];
  return (
    <group position={[0, h, 42]}>
      {steps.map((r, i) => (
        <mesh key={r} position={[0, 0.12 * i, 0]} receiveShadow>
          <cylinderGeometry args={[r, r + 0.32, 0.24, 32]} />
          <meshStandardMaterial color={i % 2 ? "#d6cec2" : "#c4b9aa"} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.95, 1.18, 1.5, 12]} />
        <meshStandardMaterial color="#8a7a62" roughness={0.5} metalness={0.2} />
      </mesh>
      <SignPlate map={plaque} position={[0, 1.58, 1.12]} size={[1.55, 0.42]} />
      <group position={[0, 0.72, 0]}>
        <BronzeFigure />
      </group>
    </group>
  );
}

function DolphinBody({ sign }: { sign: number }) {
  return (
    <group position={[sign * 0.55, 1.85, 0]} rotation={[0.35, sign * 0.5, sign * 0.95]}>
      <mesh castShadow scale={[0.42, 0.32, 1.15]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#7ea8bc" roughness={0.32} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.02, -1.05]} rotation={[0.55, 0, 0]} castShadow>
        <boxGeometry args={[0.55, 0.08, 0.42]} />
        <meshStandardMaterial color="#6b93a8" />
      </mesh>
      <mesh position={[0, 0.28, 0.05]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.08, 0.32, 0.28]} />
        <meshStandardMaterial color="#6b93a8" />
      </mesh>
    </group>
  );
}

function Dolphins({ plaque }: { plaque: THREE.Texture }) {
  const h = terrainHeight(0, 7);
  return (
    <group position={[0, h, 7]}>
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <cylinderGeometry args={[4.8, 4.8, 0.14, 28]} />
        <meshStandardMaterial color="#9aa7a0" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[1.25, 1.45, 0.86, 10]} />
        <meshStandardMaterial color="#cfc6b8" />
      </mesh>
      <SignPlate map={plaque} position={[0, 0.72, 1.2]} size={[1.4, 0.32]} />
      <DolphinBody sign={-1} />
      <DolphinBody sign={1} />
    </group>
  );
}

function Tigers({ plaque }: { plaque: THREE.Texture }) {
  const h = terrainHeight(46, 16);
  return (
    <group position={[46, h, 16]}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 1.55, 0.22, Math.sin(a) * 1.55]} rotation={[0, a + Math.PI, 0]}>
            <mesh position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.22, 0.72, 4, 8]} />
              <meshStandardMaterial color="#7a5a32" metalness={0.42} roughness={0.35} />
            </mesh>
            {[
              [0.28, 0.18],
              [0.28, -0.18],
              [-0.28, 0.18],
              [-0.28, -0.18],
            ].map(([x, z], k) => (
              <mesh key={k} position={[x, 0.22, z]}>
                <capsuleGeometry args={[0.07, 0.28, 3, 6]} />
                <meshStandardMaterial color="#6e5230" metalness={0.4} roughness={0.38} />
              </mesh>
            ))}
            <mesh position={[0.55, 0.55, 0]} castShadow>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#8a6a44" metalness={0.42} roughness={0.35} />
            </mesh>
            <mesh position={[0.72, 0.5, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshStandardMaterial color="#7a5a32" metalness={0.4} roughness={0.35} />
            </mesh>
            {[-0.1, 0.1].map((z) => (
              <mesh key={`e${z}`} position={[0.5, 0.72, z]}>
                <coneGeometry args={[0.06, 0.12, 5]} />
                <meshStandardMaterial color="#8a6a44" metalness={0.4} />
              </mesh>
            ))}
            <mesh position={[-0.58, 0.55, 0]} rotation={[0, 0, 0.55]}>
              <capsuleGeometry args={[0.05, 0.48, 3, 5]} />
              <meshStandardMaterial color="#6e5230" metalness={0.4} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[2.55, 2.55, 0.22, 16]} />
        <meshStandardMaterial color="#6a5538" />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.85, 0.7, 0.22]} />
        <meshStandardMaterial color="#5a4630" />
      </mesh>
      <SignPlate map={plaque} position={[0, 0.72, 0.14]} size={[1.35, 0.32]} />
    </group>
  );
}

function SheepLawn({ plaque }: { plaque: THREE.Texture }) {
  const h = terrainHeight(24, -2);
  const sheep: [number, number][] = [
    [5.4, -2.8],
    [6.8, -1.2],
  ];
  return (
    <group position={[24, h, -2]}>
      <group position={[-2.4, 0, 1.2]}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.55, 0.68, 0.32, 10]} />
          <meshStandardMaterial color="#6a5538" />
        </mesh>
        <group position={[0, 0.12, 0]}>
          <BronzeFigure scale={0.95} />
        </group>
        <mesh position={[0.32, 1.62, 0.18]} rotation={[0.25, 0.15, -0.85]} castShadow>
          <boxGeometry args={[0.14, 0.88, 0.32]} />
          <meshStandardMaterial color="#5c4a32" metalness={0.45} roughness={0.4} />
        </mesh>
        <SignPlate map={plaque} position={[0, 0.42, 0.72]} size={[1.35, 0.32]} />
      </group>
      {sheep.map(([x, z], i) => (
        <group key={i} position={[x, 0.35, z]}>
          <mesh castShadow>
            <sphereGeometry args={[0.38, 10, 8]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
          </mesh>
          <mesh position={[0.34, 0.12, 0.1]} castShadow>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshStandardMaterial color="#1a1714" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ReadingGirl() {
  const h = terrainHeight(8, -22);
  return (
    <group position={[8, h, -22]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.75, 0.12, 0.55]} />
        <meshStandardMaterial color="#6a5538" />
      </mesh>
      <mesh position={[0, 0.42, -0.18]}>
        <boxGeometry args={[1.75, 0.42, 0.1]} />
        <meshStandardMaterial color="#5a4630" />
      </mesh>
      <mesh position={[0, 0.62, 0.04]} rotation={[0.55, 0, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.45, 4, 8]} />
        <meshStandardMaterial color="#c45c4a" />
      </mesh>
      <mesh position={[0, 1.02, 0.16]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#e2c2a4" />
      </mesh>
      <mesh position={[0.2, 0.68, 0.28]} rotation={[1.15, 0.25, 0]}>
        <boxGeometry args={[0.24, 0.02, 0.3]} />
        <meshStandardMaterial color="#1a3f6d" />
      </mesh>
    </group>
  );
}

function Benches() {
  const spots: [number, number, number][] = [
    [-2.55, 32, 0],
    [2.55, 32, Math.PI],
    [-2.55, 24.5, 0],
    [2.55, 24.5, Math.PI],
    [-2.55, 17.2, 0],
    [2.55, 17.2, Math.PI],
    [5.4, -12, -0.4],
    [-5.2, -11, 0.5],
  ];
  return (
    <group>
      {spots.map(([x, z, rot], i) => {
        const y = terrainHeight(x, z);
        return (
          <group key={i} position={[x, y, z]} rotation={[0, rot, 0]}>
            <mesh position={[0, 0.28, 0]} castShadow>
              <boxGeometry args={[1.35, 0.08, 0.42]} />
              <meshStandardMaterial color="#8a7a62" roughness={0.7} />
            </mesh>
            {[-0.55, 0.55].map((sx) => (
              <mesh key={sx} position={[sx, 0.16, 0]}>
                <boxGeometry args={[0.08, 0.28, 0.4]} />
                <meshStandardMaterial color="#6a5a44" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Flagpole() {
  const h = terrainHeight(-6.5, 47.5);
  return (
    <group position={[-6.5, h, 47.5]}>
      <mesh position={[0, 4.2, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 8.4, 8]} />
        <meshStandardMaterial color="#cfc6b8" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0.55, 7.85, 0]}>
        <planeGeometry args={[1.15, 0.7]} />
        <meshStandardMaterial color="#1a3f6d" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 0.24, 10]} />
        <meshStandardMaterial color="#8a7a62" />
      </mesh>
    </group>
  );
}

function Juexuan({ roof }: { roof: THREE.Texture }) {
  const h = terrainHeight(-24, 41);
  return (
    <group position={[-24, h, 41]}>
      {[-1.25, 1.25].flatMap((x) =>
        [-1.25, 1.25].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.7, z]} castShadow>
            <cylinderGeometry args={[0.11, 0.13, 3.15, 8]} />
            <meshStandardMaterial color="#8e2c22" />
          </mesh>
        )),
      )}
      <mesh position={[0, 3.28, 0]}>
        <boxGeometry args={[2.85, 0.12, 2.85]} />
        <meshStandardMaterial color="#6e1812" />
      </mesh>
      <mesh position={[0, 3.62, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.65, 1.42, 4]} />
        <meshStandardMaterial map={roof} color="#2f6b4f" />
      </mesh>
      <mesh position={[0, 4.42, 0]}>
        <boxGeometry args={[1.1, 0.12, 0.18]} />
        <meshStandardMaterial color="#1a3d2c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.15, 0.04, 0.7]}>
        <circleGeometry args={[2.45, 20]} />
        <meshStandardMaterial color="#3a6d8c" roughness={0.12} metalness={0.25} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-1.7 + i * 0.7, 0.38, -1.85]} castShadow>
          <dodecahedronGeometry args={[0.38 + (i % 2) * 0.1, 0]} />
          <meshStandardMaterial color="#8a8174" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.55, 1.6]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.12, 0.35]} />
        <meshStandardMaterial color="#c45c4a" />
      </mesh>
    </group>
  );
}

function Gate({ sign }: { sign: THREE.Texture }) {
  const h = terrainHeight(0, 90);
  return (
    <group position={[0, h, 90]}>
      {[-4.2, 4.2].map((x) => (
        <mesh key={x} position={[x, 2.1, 0]} castShadow>
          <boxGeometry args={[0.7, 4.2, 0.7]} />
          <meshStandardMaterial color="#1a3f6d" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 4.35, 0]} castShadow>
        <boxGeometry args={[9.4, 0.55, 0.7]} />
        <meshStandardMaterial color="#0d243f" />
      </mesh>
      <mesh position={[0, 4.98, 0.08]}>
        <boxGeometry args={[5.2, 0.82, 0.12]} />
        <meshStandardMaterial color="#f3eee4" />
      </mesh>
      <SignPlate map={sign} position={[0, 4.98, 0.16]} size={[4.6, 0.62]} />
    </group>
  );
}

function KenanTrees() {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const leaf = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const pts: [number, number, number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const z = 78 - i * 3.4;
      for (const s of [-1, 1]) {
        const x = s * (9.6 + (i % 3) * 0.8);
        const sc = 0.9 + (i % 4) * 0.08;
        pts.push([x, terrainHeight(x, z), z, sc]);
      }
    }
    return pts;
  }, []);
  useLayoutEffect(() => {
    if (!trunk.current || !leaf.current) return;
    positions.forEach((p, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(p[3], p[3], p[3]);
      dummy.position.set(p[0], p[1] + 1.05 * p[3], p[2]);
      dummy.updateMatrix();
      trunk.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0], p[1] + 2.7 * p[3], p[2]);
      dummy.updateMatrix();
      leaf.current!.setMatrixAt(i, dummy.matrix);
    });
    trunk.current.instanceMatrix.needsUpdate = true;
    leaf.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, positions.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 2.1, 6]} />
        <meshStandardMaterial color="#5a3d28" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={leaf} args={[undefined, undefined, positions.length]} castShadow>
        <sphereGeometry args={[1.15, 8, 6]} />
        <meshStandardMaterial color="#3f6b46" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}

function Trees() {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const leaf = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const pts: [number, number, number, number][] = [];
    for (let x = -72; x <= 72; x += 9) {
      for (let z = -48; z <= 38; z += 9) {
        if (z > 42 && Math.abs(x) < 10) continue;
        if (z > 10 && z < 42 && Math.abs(x) < 17) continue;
        if (Math.hypot(x, z + 14) < 12) continue;
        if (Math.hypot(x - 12, z + 32) < 16) continue;
        if (Math.hypot(x, z - 7) < 8) continue;
        if (Math.hypot(x - 50, z + 16) < 16) continue;
        if (Math.hypot(x - 46, z - 16) < 14) continue;
        if (Math.hypot(x - 36, z - 8) < 12) continue;
        if (Math.hypot(x + 24, z - 41) < 10) continue;
        const jx = x + ((x * 17) % 5) - 2;
        const jz = z + ((z * 11) % 5) - 2;
        const blocked = COLLIDERS.some(
          (b) => jx > b.minX - 2 && jx < b.maxX + 2 && jz > b.minZ - 2 && jz < b.maxZ + 2,
        );
        if (blocked) continue;
        const s = 0.85 + (((x + z) * 13) % 10) / 28;
        pts.push([jx, terrainHeight(jx, jz), jz, s]);
      }
    }
    return pts;
  }, []);

  useLayoutEffect(() => {
    if (!trunk.current || !leaf.current) return;
    positions.forEach((p, i) => {
      dummy.position.set(p[0], p[1] + 1.05 * p[3], p[2]);
      dummy.scale.set(p[3], p[3], p[3]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunk.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0], p[1] + 2.7 * p[3], p[2]);
      dummy.updateMatrix();
      leaf.current!.setMatrixAt(i, dummy.matrix);
    });
    trunk.current.instanceMatrix.needsUpdate = true;
    leaf.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, positions.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 2.1, 6]} />
        <meshStandardMaterial color="#5a3d28" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={leaf} args={[undefined, undefined, positions.length]} castShadow>
        <coneGeometry args={[1.35, 2.4, 7]} />
        <meshStandardMaterial color="#3f6b46" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}

function Azaleas() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const pts: [number, number, number, number][] = [];
    for (let i = 0; i < 20; i++) {
      const z = 39.2 - i * 1.28;
      const s = 0.85 + (i % 3) * 0.12;
      pts.push([-4.55, terrainHeight(-4.55, z) + 0.28, z, s], [4.55, terrainHeight(4.55, z) + 0.28, z, s]);
    }
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      const hx = 16 + Math.sin(t) * 1.7;
      const hz = 11.5 + Math.sin(t * 2) * 0.85 * Math.sign(Math.cos(t) || 1);
      pts.push([hx, terrainHeight(hx, hz) + 0.3, hz, 0.95]);
    }
    return pts;
  }, []);
  const colors = useMemo(() => {
    const arr = new Float32Array(positions.length * 3);
    const pink = new THREE.Color("#d46a8a");
    const rose = new THREE.Color("#c45c6a");
    const blush = new THREE.Color("#e8a0b4");
    const white = new THREE.Color("#f3dce4");
    const palette = [pink, rose, blush, white];
    positions.forEach((_, i) => {
      palette[i % 4].toArray(arr, i * 3);
    });
    return arr;
  }, [positions]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    positions.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.set(p[3], p[3] * 0.85, p[3]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  }, [positions, colors]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow>
      <sphereGeometry args={[0.4, 8, 6]} />
      <meshStandardMaterial color="#ffffff" roughness={0.7} vertexColors />
    </instancedMesh>
  );
}

function MountainAndRiver() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-128, -6.2, -8]} receiveShadow>
        <planeGeometry args={[90, 220]} />
        <meshStandardMaterial color="#2f6d8c" roughness={0.08} metalness={0.32} />
      </mesh>
      <mesh position={[-168, 22, -36]} rotation={[0, 0.18, 0]}>
        <coneGeometry args={[34, 62, 7]} />
        <meshStandardMaterial color="#4d5d52" roughness={0.95} />
      </mesh>
      <mesh position={[-182, 12, 4]} rotation={[0, -0.28, 0]}>
        <coneGeometry args={[26, 42, 6]} />
        <meshStandardMaterial color="#3f5148" roughness={0.95} />
      </mesh>
      <mesh position={[-154, 8, 32]}>
        <coneGeometry args={[18, 28, 6]} />
        <meshStandardMaterial color="#55685a" roughness={0.95} />
      </mesh>
      <mesh position={[-176, 6, -18]}>
        <coneGeometry args={[20, 22, 6]} />
        <meshStandardMaterial color="#46564c" roughness={0.95} />
      </mesh>
      {[-72, -58, -44].map((z, i) => (
        <mesh key={z} position={[-92 - i * 2, 1.2 + (i % 2) * 0.8, z]}>
          <boxGeometry args={[3.2 + i, 2.4 + i * 0.6, 4.4]} />
          <meshStandardMaterial color={i % 2 ? "#8a8174" : "#6a7380"} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Plaques() {
  return (
    <group>
      {LANDMARKS.map((l) => {
        const y = terrainHeight(l.x, l.z);
        return (
          <mesh key={l.id} rotation={[-Math.PI / 2, 0, 0]} position={[l.x, y + 0.06, l.z]}>
            <ringGeometry args={[0.7, 0.92, 20]} />
            <meshStandardMaterial color="#1a3f6d" roughness={0.45} metalness={0.12} />
          </mesh>
        );
      })}
    </group>
  );
}

function Volleyball() {
  const h = terrainHeight(18, 48);
  return (
    <group position={[18, h, 48]}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 16]} />
        <meshStandardMaterial color="#5d8a52" />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.06, 2.3, 9.2]} />
        <meshStandardMaterial color="#f3eee4" />
      </mesh>
    </group>
  );
}

export function CampusWorld({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const { grass, wall, roof, stone, lattice, windows, labels } = useCampusTextures();
  const preset = TIME_PRESETS[timeOfDay];
  const night = timeOfDay === "night";
  const bizY = terrainHeight(37, 8);
  const gymY = terrainHeight(53, 19);
  const csY = terrainHeight(-18, -27);
  const kenanSignY = terrainHeight(-3.4, 83.2);
  const avenueSignY = terrainHeight(-2.2, 21);

  return (
    <>
      <color attach="background" args={[preset.sky]} />
      <fog attach="fog" args={[preset.fog, preset.fogNear, preset.fogFar]} />
      <hemisphereLight args={[preset.hemiSky, preset.hemiGround, preset.hemiIntensity]} />
      <ambientLight intensity={night ? 0.08 : 0.18} />
      <directionalLight
        position={preset.sunPos}
        intensity={preset.sunIntensity}
        color={preset.sun}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={180}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      <mesh>
        <sphereGeometry args={[280, 24, 16]} />
        <meshBasicMaterial color={preset.sky} side={THREE.BackSide} fog={false} />
      </mesh>
      {timeOfDay === "sunset" && (
        <mesh position={[-95, 14, 22]}>
          <sphereGeometry args={[7.5, 16, 16]} />
          <meshBasicMaterial color="#ffd2a0" fog={false} />
        </mesh>
      )}
      {timeOfDay === "day" && (
        <mesh position={[52, 78, 22]}>
          <sphereGeometry args={[5.5, 12, 12]} />
          <meshBasicMaterial color="#fff6d6" fog={false} />
        </mesh>
      )}
      {night && (
        <>
          <mesh position={[28, 62, -50]}>
            <sphereGeometry args={[4.2, 12, 12]} />
            <meshBasicMaterial color="#e8eef4" fog={false} />
          </mesh>
          <pointLight position={[0, 20, 32]} color="#ffb070" intensity={9} distance={22} />
          <pointLight position={[0, 20, 22]} color="#ffb070" intensity={9} distance={22} />
          <pointLight position={[0, 20, 12]} color="#ffc08a" intensity={7} distance={20} />
          <pointLight position={[0, 19, -14]} color="#c9d4e8" intensity={6} distance={18} />
          <pointLight position={[50, 18, -12]} color="#e8eef4" intensity={7} distance={20} />
        </>
      )}

      <Terrain map={grass} />
      <MountainAndRiver />
      <Stairs />
      <Gate sign={labels.gate} />
      <Path
        position={[0, terrainHeight(0, 26.5) + 0.07, 26.5]}
        size={[6.4, 0.12, 27.2]}
        color="#d8d0c4"
        map={stone}
      />
      <Path position={[0, terrainHeight(0, -4) + 0.07, -4]} size={[5.2, 0.12, 26]} color="#cfc6b8" map={stone} />
      <Path position={[22, terrainHeight(22, -8) + 0.07, -8]} size={[26, 0.12, 4.0]} color="#b7aea0" />
      <Path position={[38, terrainHeight(38, 2) + 0.07, 2]} size={[4.0, 0.12, 34]} color="#b7aea0" />

      {PALACE_ZS.map((z) => (
        <PalaceHall
          key={`w${z}`}
          position={[-PALACE_X, terrainHeight(-PALACE_X, z), z]}
          width={PALACE_W}
          depth={PALACE_D}
          rotY={Math.PI / 2}
          wall={wall}
          roof={roof}
          lattice={lattice}
          night={night}
        />
      ))}
      {PALACE_ZS.map((z) => (
        <PalaceHall
          key={`e${z}`}
          position={[PALACE_X, terrainHeight(PALACE_X, z), z]}
          width={PALACE_W}
          depth={PALACE_D}
          rotY={-Math.PI / 2}
          wall={wall}
          roof={roof}
          lattice={lattice}
          night={night}
        />
      ))}
      <AvenueColonnade xSign={-1} roof={roof} night={night} />
      <AvenueColonnade xSign={1} roof={roof} night={night} />

      <group position={[-3.35, kenanSignY, 83.2]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.18, 1.7, 1.15]} />
          <meshStandardMaterial color="#8a7a62" roughness={0.7} />
        </mesh>
        <SignPlate map={labels.kenan} position={[0.12, 1.05, 0]} rotation={[0, Math.PI / 2, 0]} size={[1.05, 0.42]} />
      </group>
      <group position={[3.35, kenanSignY, 83.2]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[0.16, 1.4, 1.25]} />
          <meshStandardMaterial color="#8a7a62" roughness={0.7} />
        </mesh>
        <SignPlate map={labels.steps} position={[-0.1, 0.88, 0]} rotation={[0, -Math.PI / 2, 0]} size={[1.15, 0.38]} />
      </group>
      <group position={[-3.2, terrainHeight(-3.2, 45.6), 45.6]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[0.16, 1.55, 1.05]} />
          <meshStandardMaterial color="#8a7a62" roughness={0.7} />
        </mesh>
        <SignPlate map={labels.kenan} position={[0.11, 0.95, 0]} rotation={[0, Math.PI / 2, 0]} size={[0.95, 0.38]} />
      </group>
      <group position={[-2.15, avenueSignY, 21]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[0.16, 1.4, 1.35]} />
          <meshStandardMaterial color="#d8d0c4" roughness={0.65} />
        </mesh>
        <SignPlate map={labels.avenue} position={[0.1, 0.85, 0]} rotation={[0, Math.PI / 2, 0]} size={[1.25, 0.4]} />
      </group>

      <Juexuan roof={roof} />
      <Volleyball />
      <Library windows={windows} nameMap={labels.library} night={night} />
      <ReadingGirl />
      <HipRoofBuilding
        position={[-18, csY, -27]}
        size={[18, 11.2, 16]}
        floors={7}
        color="#c4b8a8"
        accent="#b5a894"
        windows={windows}
        night={night}
      />
      <HipRoofBuilding
        position={[37, bizY, 8]}
        size={[16, 11.2, 12]}
        floors={7}
        color="#9eb0c2"
        accent="#8aa0b4"
        windows={windows}
        night={night}
      />
      <group position={[53, gymY, 19]}>
        <mesh position={[0, 3.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[20, 6.6, 14]} />
          <meshStandardMaterial color="#d5dae0" roughness={0.62} />
        </mesh>
        <mesh position={[0, 3.3, 7.12]}>
          <planeGeometry args={[16.5, 4.4]} />
          <meshStandardMaterial
            map={windows}
            color="#c5d0da"
            roughness={0.22}
            metalness={0.2}
            emissive="#6aa0c0"
            emissiveIntensity={night ? 0.25 : 0.07}
          />
        </mesh>
        <mesh position={[0, 6.85, 0]} castShadow>
          <boxGeometry args={[21.2, 0.45, 15]} />
          <meshStandardMaterial color="#9aa7b4" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.6, 7.2]} castShadow>
          <boxGeometry args={[3.4, 3.2, 0.18]} />
          <meshStandardMaterial color="#1a3f6d" />
        </mesh>
        <SignPlate map={labels.gym} position={[0, 2.55, 7.32]} size={[3.1, 0.42]} />
        <mesh position={[0, 0.2, 0]} receiveShadow>
          <boxGeometry args={[22, 0.4, 16]} />
          <meshStandardMaterial color="#c8c2b6" />
        </mesh>
      </group>
      <ShipMuseum nameMap={labels.museum} />
      <JetAndHeli />
      <ScrollSculpture />
      <StatuePlaza plaque={labels.statue} />
      <Dolphins plaque={labels.dolphin} />
      <Tigers plaque={labels.tigers} />
      <SheepLawn plaque={labels.sing} />
      <KenanTrees />
      <Azaleas />
      <Trees />
      <Benches />
      <Flagpole />
      <Plaques />
    </>
  );
}
