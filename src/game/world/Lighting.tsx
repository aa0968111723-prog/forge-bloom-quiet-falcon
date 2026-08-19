import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { quality } from "../quality";
import { useGame } from "../store";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";

/**
 * Sky, sun, fog and exposure for the five Tamsui presets.
 *
 * Deliberate restraint: no bloom pass, no god rays. The presets carry their own
 * exposure (set on the renderer, ACES tonemapped) and the fog exists for aerial
 * perspective over a ~400 m corridor, not mood. The sun's shadow camera follows
 * the player so a fixed-size shadow map stays sharp wherever you are, instead of
 * being stretched across the whole campus.
 */
export function Lighting({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const preset = TIME_PRESETS[timeOfDay];
  const q = quality();
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = preset.exposure;
  }, [gl, preset.exposure]);

  // Keep the sun's shadow frustum centred on the player, so a fixed-size
  // shadow map stays sharp along a 400 m corridor.
  useFrame((state) => {
    const light = state.scene.getObjectByName("tk-sun") as THREE.DirectionalLight | null;
    if (!light) return;
    const { playerX, playerZ } = useGame.getState();
    light.target.position.set(playerX, 0, playerZ);
    light.position.set(
      playerX + preset.sunPos[0] * 0.35,
      preset.sunPos[1] * 0.35,
      playerZ + preset.sunPos[2] * 0.35,
    );
    light.target.updateMatrixWorld();
  });

  const shadows = q.shadows && preset.shadowStrength > 0;

  return (
    <>
      {/* Background colour only matters for the first frame; the Sky dome
          covers every pixel after that. */}
      <color attach="background" args={[preset.sky]} />
      <fog attach="fog" args={[preset.fog, preset.fogNear, preset.fogFar]} />
      <hemisphereLight args={[preset.hemiSky, preset.hemiGround, preset.hemiIntensity]} />
      <ambientLight intensity={preset.ambientIntensity} />
      <directionalLight
        name="tk-sun"
        position={preset.sunPos}
        intensity={preset.sunIntensity}
        color={preset.sun}
        castShadow={shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-camera-near={2}
        shadow-camera-far={520}
        shadow-camera-left={-q.shadowExtent}
        shadow-camera-right={q.shadowExtent}
        shadow-camera-top={q.shadowExtent}
        shadow-camera-bottom={-q.shadowExtent}
        shadow-bias={-0.0004}
        shadow-normalBias={0.5}
      />
      {preset.disc && (
        <mesh position={preset.disc.position}>
          <sphereGeometry args={[preset.disc.radius, 14, 12]} />
          <meshBasicMaterial color={preset.disc.color} fog={false} />
        </mesh>
      )}
    </>
  );
}
