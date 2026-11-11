import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useArtModel } from "../assets";
import { CharacterAnimator } from "./animator";
import { assemble } from "./npc-assemble";

export function NpcCharacter({ presetId, speed }: { presetId: string; speed: number }) {
  const { root, clips } = useArtModel("char.npc-kit");
  const npc = useMemo(() => assemble(root, presetId), [root, presetId]);
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
  useFrame((_, raw) => animator.update(Math.min(raw, 0.08), speed));
  return <primitive object={root} />;
}
