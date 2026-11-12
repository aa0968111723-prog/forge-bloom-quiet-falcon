import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, Matrix4, type InstancedMesh } from "three";
import { ROOM_TABLE_SIZE, ROOM_TABLES, gymFloorMarks } from "./interior-layout";

type Point = [number, number, number];
type Box = { at: Point; size: Point; color: string };

const ROOM_FINISHES = {
  palace: { wall: "#c6bba1", trim: "#79392c", floor: "#77685a", seam: "#887869" },
  library: { wall: "#b4bfaf", trim: "#466359", floor: "#978b70", seam: "#a4977a" },
  museum: { wall: "#8eaaae", trim: "#2c505e", floor: "#52636a", seam: "#607279" },
  gym: { wall: "#b4c0a8", trim: "#46685f", floor: "#b88755", seam: "#c29565" },
};

type DetailedRoom = keyof typeof ROOM_FINISHES;

export function detailedRoom(id: string): DetailedRoom | undefined {
  return Object.hasOwn(ROOM_FINISHES, id) ? (id as DetailedRoom) : undefined;
}

export function roomFinish(room: DetailedRoom) {
  return ROOM_FINISHES[room];
}

function box(at: Point, size: Point, color: string): Box {
  return { at, size, color };
}

function RoomBoxes({ items, shadows = false }: { items: Box[]; shadows?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const color = new Color();
    items.forEach(({ at, size, color: tint }, index) => {
      matrix.makeScale(...size).setPosition(...at);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={shadows} receiveShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

function wallAndFloor(room: DetailedRoom, floor: number) {
  const { trim, seam } = roomFinish(room);
  const museum = room === "museum";
  const gym = room === "gym";
  const detail = [
    box([0, 0.2, -7.38], [19, 0.4, 0.1], trim),
    box([0, 3.95, -7.36], [19, 0.19, 0.14], trim),
    box([0, 3.63, 7.36], [5.1, 0.22, 0.18], trim),
  ];
  for (const side of [-1, 1]) {
    const wallX = side * 9.37;
    detail.push(
      box([wallX, 0.28, 0], [0.16, 0.56, 15], trim),
      box([wallX, 3.95, 0], [0.16, 0.19, 15], trim),
      box([side * 2.5, 1.8, 7.36], [0.15, 3.6, 0.18], trim),
    );
    for (const z of [-4.6, 0, 4.6]) {
      const height = gym ? 1.1 : 2.15;
      const y = gym ? 3.06 : 2.36;
      detail.push(
        box([wallX, y, z], [0.13, height + 0.22, 2.85], trim),
        box([wallX - side * 0.07, y, z], [0.035, height, 2.6],
          museum ? "#4b7481" : "#ccd5bf"),
        box([wallX - side * 0.12, y, z], [0.07, 0.09, 2.7], trim),
      );
      for (const offset of [-0.65, 0, 0.65]) {
        detail.push(box([wallX - side * 0.12, y, z + offset], [0.07, height, 0.07], trim));
      }
    }
  }
  for (let row = -12; row <= 12; row++) {
    detail.push(box([0, 0.004, row * 0.6], [19.5, 0.008, 0.025], seam));
    for (let joint = -2; joint <= 2; joint++) {
      const x = joint * 3.5 + (row % 2 === 0 ? 0.6 : -0.9);
      detail.push(box([x, 0.004, row * 0.6 + 0.3], [0.025, 0.008, 0.6], seam));
    }
  }
  if (gym) {
    const line = "#e7d9b9";
    for (const mark of gymFloorMarks()) {
      detail.push(
        box(
          [mark.position[0], mark.position[1], mark.position[2]],
          [mark.size[0], mark.size[1], mark.size[2]],
          line,
        ),
      );
    }
  } else {
    const panel = museum ? "#233e4b" : trim;
    for (const x of [-6.6, 6.6]) {
      detail.push(
        box([x, 2.25, -7.35], [2.4, 1.55, 0.13], panel),
        box([x, 2.73, -7.26], [1.95, 0.06, 0.06], "#c1ab75"),
        box([x, 2.29, -7.26], [1.5, 0.035, 0.06], "#b4a890"),
        box([x, 1.99, -7.26], [floor % 2 ? 1.1 : 1.65, 0.035, 0.06], "#b4a890"),
      );
    }
  }
  return detail;
}

function studyTables(room: "palace" | "library") {
  const library = room === "library";
  const top = library ? "#a58252" : "#916248";
  const legs = library ? "#536858" : "#674535";
  return ROOM_TABLES.flatMap(({ x, z }, index) => [
    box([x, 0.82, z], [ROOM_TABLE_SIZE.width, 0.12, ROOM_TABLE_SIZE.depth], top),
    box([x, 0.71, z + 0.48], [1.64, 0.14, 0.09], legs),
    ...[-1, 1].flatMap((side) =>
      [-1, 1].map((end) => box([x + side * 0.72, 0.38, z + end * 0.39], [0.12, 0.76, 0.12], legs)),
    ),
    box([x - 0.25, 0.9, z - 0.09], [0.45, 0.045, 0.3], index % 2 ? "#ddd2a9" : "#b4c6b4"),
    box([x + 0.37, 0.9, z + 0.14], [0.33, 0.043, 0.25], library ? "#455f65" : "#856b56"),
  ]);
}

function museumCases() {
  return ROOM_TABLES.flatMap(({ x, z }, index) => [
    box([x, 0.38, z], [1.56, 0.76, 0.86], "#304c58"),
    box([x, 0.8, z], [ROOM_TABLE_SIZE.width, 0.09, ROOM_TABLE_SIZE.depth], "#638487"),
    box([x, 1.49, z], [1.76, 0.055, 1.05], "#54777b"),
    ...[-1, 1].flatMap((side) =>
      [-1, 1].map((end) => box([x + side * 0.84, 1.16, z + end * 0.5], [0.043, 0.68, 0.043], "#799595")),
    ),
    box([x, 0.88, z], [1.32, 0.07, 0.56], "#33444b"),
    box([x, 1.01, z], [1.19, 0.19, 0.43], "#ab704a"),
    box([x + 0.08, 1.13, z], [0.89, 0.07, 0.36], "#d4ba88"),
    box([x - 0.22, 1.22, z], [0.35, 0.16, 0.27], index % 2 ? "#d9dfcf" : "#6d8b8e"),
    box([x + 0.3, 1.25, z], [0.037, 0.29, 0.038], "#a89260"),
    box([x, 0.92, z + 0.35], [0.38, 0.045, 0.13], "#e1ce9d"),
  ]);
}

export function InteriorDetails({ room, floor }: { room: DetailedRoom; floor: number }) {
  // These finishes are game art. Layout and entrance dimensions retain the
  // existing game-space measurements until site surveys are available.
  const shell = useMemo(() => wallAndFloor(room, floor), [room, floor]);
  const furniture = useMemo(() => {
    if (room === "museum") return museumCases();
    if (room === "gym") return [];
    return studyTables(room);
  }, [room]);
  return (
    <>
      <RoomBoxes items={shell} />
      {furniture.length > 0 && <RoomBoxes items={furniture} shadows />}
    </>
  );
}
