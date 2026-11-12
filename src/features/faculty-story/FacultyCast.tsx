import { Suspense, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Student } from "../../game/Student";
import { terrainHeight } from "../../game/world";
import { ArtBoundary } from "../../game/art/ArtBoundary";
import { useArtModel } from "../../game/art/assets";
import { CharacterAnimator } from "../../game/art/character/animator";
import { assemble } from "../../game/art/character/npc-assemble";
import { useRpg } from "../../game/rpg/store";
import { narrativeCatalog } from "../../game/rpg/narrative-bridge";
import { facultyGesture } from "./gesture";
import { facultyPosts, type FacultyPost } from "./posts";

const DRAW_RANGE = 48;
const QA = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qa") === "1";

function FacultyFigure({ post, gesture }: { post: FacultyPost; gesture: ReturnType<typeof facultyGesture> }) {
  const { root, clips } = useArtModel("char.npc-kit");
  const npc = useMemo(() => {
    const kitNode = root.getObjectByName("npc-kit");
    const data = kitNode?.userData as
      | {
          presets: Record<string, { parts: string[]; colors: Record<string, string>; build: FacultyPost["look"]["build"] }>;
        }
      | undefined;
    if (kitNode && data?.presets && !data.presets[post.look.id]) {
      kitNode.userData = {
        ...data,
        presets: {
          ...data.presets,
          [post.look.id]: {
            parts: [...post.look.parts],
            colors: { ...post.look.colors },
            build: post.look.build,
          },
        },
      };
    }
    return assemble(root, post.look.id);
  }, [root, post]);
  useEffect(() => npc.dispose, [npc]);
  const animator = useMemo(
    () =>
      new CharacterAnimator(root, clips, {
        upperBody: npc.kit.upperBody,
        layers: npc.kit.actionLayers,
        stride: npc.kit.stride,
        minRate: 0.4,
      }),
    [root, clips, npc],
  );
  useEffect(() => () => animator.dispose(), [animator]);
  useEffect(() => {
    if (gesture !== "idle") animator.play("interact");
  }, [animator, gesture]);
  useFrame((_, raw) => {
    animator.update(Math.min(raw, 0.08), 0);
    if (!QA) return;
    const arm = root.getObjectByName("upperArmR");
    const qa = (window.__facultyQA ??= { people: {} });
    qa.people[post.id] = {
      gesture,
      action: animator.current(),
      armX: arm?.quaternion.x ?? null,
    };
  });
  return <primitive object={root} />;
}

function Standing({ post, gesture }: { post: FacultyPost; gesture: ReturnType<typeof facultyGesture> }) {
  const y = terrainHeight(post.x, post.z);
  const yaw = Math.atan2(-(post.doorX - post.x), -(post.doorZ - post.z)) + Math.PI;
  const standIn = <Student speed={0} accent={post.look.colors.top ?? "#243044"} castShadow={false} />;
  return (
    <group position={[post.x, y, post.z]} rotation={[0, yaw, 0]}>
      <ArtBoundary id="char.npc-kit" fallback={standIn}>
        <Suspense fallback={standIn}>
          <FacultyFigure post={post} gesture={gesture} />
        </Suspense>
      </ArtBoundary>
    </group>
  );
}

/** Standing faculty. Presets are injected at runtime so the baked walker roster stays unchanged. */
export function FacultyCast() {
  const posts = useMemo(() => facultyPosts(), []);
  const [near, setNear] = useState<string[]>([]);
  const phase = useRpg((s) => s.narrativeUi?.phase ?? null);
  const eventId = useRpg((s) => s.narrativeUi?.eventId ?? null);
  const speaker = useMemo(() => {
    if (phase !== "talking" && phase !== "outcome") return null;
    return narrativeCatalog().events.find((event) => event.id === eventId)?.npcIds[0] ?? null;
  }, [phase, eventId]);
  useFrame(({ camera }) => {
    const next = posts
      .filter((post) => Math.hypot(camera.position.x - post.x, camera.position.z - post.z) < DRAW_RANGE)
      .map((post) => post.id);
    setNear((prev) => (prev.length === next.length && prev.every((id, index) => id === next[index]) ? prev : next));
  });
  return (
    <>
      {posts
        .filter((post) => near.includes(post.id))
        .map((post) => (
          <Standing key={post.id} post={post} gesture={speaker === post.id ? facultyGesture(phase) : "idle"} />
        ))}
    </>
  );
}
