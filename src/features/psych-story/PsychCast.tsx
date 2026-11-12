import { useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Student } from "../../game/Student";
import { terrainHeight } from "../../game/world";
import { psychPosts, type PsychPost } from "./posts";

const DRAW_RANGE = 48;

function Standing({ post }: { post: PsychPost }) {
  const y = terrainHeight(post.x, post.z);
  const yaw = Math.atan2(-(post.doorX - post.x), -(post.doorZ - post.z)) + Math.PI;
  return (
    <group position={[post.x, y, post.z]} rotation={[0, yaw, 0]}>
      <Student speed={0} accent="#3d5a80" castShadow={false} />
    </group>
  );
}

/** One classmate. The mesh is the existing student, not a new character kit. */
export function PsychCast() {
  const posts = useMemo(() => psychPosts(), []);
  const [near, setNear] = useState<string[]>([]);
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
          <Standing key={post.id} post={post} />
        ))}
    </>
  );
}
