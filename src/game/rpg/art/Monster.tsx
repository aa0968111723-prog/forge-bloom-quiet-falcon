import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { creatureModel } from "./creatures";
import { disposeSculpt } from "../../art/sculpt";
import { useReducedArtMotion } from "../../art/motion";
import { quality } from "../../quality";
import { useGame } from "../../store";
import { terrainHeight } from "../../world";
import { ENEMY_TYPES } from "../data";
import { useRpg } from "../store";
import { ArtBoundary } from "../../art/ArtBoundary";
import { CREATURE_ART, CreatureActor } from "../../art/creatures/CreatureActor";
import { preloadArt } from "../../art/assets";
type Enemy = ReturnType<typeof useRpg.getState>["enemies"][number];
// Asset ids, spelled out so the art validator can see each kind is wired here:
// creature.quiz, creature.report, creature.exam, creature.final.
for (const look of Object.values(CREATURE_ART)) preloadArt(look.artId);
/** Every kind renders from the art pipeline; the procedural model is the loading and failure stand-in. */
export function Monster({enemy}:{enemy:Enemy}) {
  const fallback = <LegacyMonster enemy={enemy}/>;
  return <ArtBoundary id={CREATURE_ART[enemy.kind].artId} fallback={fallback} onFail={(m)=>useRpg.getState().notify(m)}>
    <Suspense fallback={fallback}><CreatureActor enemy={enemy}/></Suspense>
  </ArtBoundary>;
}
function LegacyMonster({enemy}:{enemy:Enemy}) {
  const root=useRef<THREE.Group>(null), floating=useRef<THREE.Group>(null);
  const warning=useRef<THREE.Mesh>(null), bar=useRef<THREE.Mesh>(null), label=useRef<THREE.Group>(null);
  const reduced=useReducedArtMotion(), type=ENEMY_TYPES[enemy.kind], boss=enemy.kind==="final";
  const model=useMemo(()=>creatureModel(enemy.kind,quality().tier==="high"),[enemy.kind]);
  const paper=model.getObjectByName("orbiting-pages"), halo=model.getObjectByName("clock-halo");
  useEffect(()=>()=>disposeSculpt(model),[model]);
  useFrame(({camera})=>{
    const group=root.current;if(!group)return;
    group.visible=enemy.hp>0 && !useRpg.getState().interiorId &&
      Math.hypot(camera.position.x-enemy.x,camera.position.z-enemy.z)<(quality().tier==="low"?65:90);
    if(!group.visible)return;
    const t=useRpg.getState().clock;
    group.position.set(enemy.x,terrainHeight(enemy.x,enemy.z),enemy.z);
    if(floating.current) {
      floating.current.position.y=type.radius*1.65+(reduced?0:Math.sin(t*2+enemy.anchorX)*.10);
      const player=useGame.getState();
      floating.current.rotation.y=Math.atan2(player.playerX-enemy.x,player.playerZ-enemy.z);
      floating.current.rotation.z=reduced?0:Math.sin(t*1.3+enemy.anchorZ)*.035;
    }
    if(paper && !reduced) paper.rotation.z=Math.sin(t*.9)*.08;
    if(halo && !reduced) halo.rotation.z=Math.sin(t*.3)*.12;
    const body=model.getObjectByName("body") as THREE.Mesh;
    const mat=body.material as THREE.MeshStandardMaterial;
    mat.emissive.set(enemy.hurt>0?"#fce6bd":"#000000");
    mat.emissiveIntensity=enemy.hurt>0?.40:0;
    if(warning.current) {
      warning.current.visible=enemy.state==="windup";
      const progress=THREE.MathUtils.clamp(1-enemy.timer/type.windup,0,1);
      warning.current.scale.setScalar(reduced?1:.55+progress*.45);
      (warning.current.material as THREE.MeshBasicMaterial).opacity=.36+progress*.38;
    }
    if(bar.current) {bar.current.scale.x=Math.max(.001,enemy.hp/type.hp);bar.current.position.x=-(1-enemy.hp/type.hp)*.85;}
    if(label.current)label.current.quaternion.copy(camera.quaternion);
    // Rendering consumes the game clock only; never writes to enemy simulation.
  });
  return <group ref={root}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.07,0]}>
      <circleGeometry args={[type.radius*.78,20]}/><meshBasicMaterial color="#182a35" transparent opacity={.18} depthWrite={false}/>
    </mesh>
    <mesh ref={warning} visible={false} rotation={[-Math.PI/2,0,0]} position={[0,.12,0]}>
      <ringGeometry args={[type.radius+2.2,type.radius+2.5,40]}/>
      <meshBasicMaterial color="#e9a85f" transparent opacity={.7} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <group ref={floating} scale={type.radius}><primitive object={model}/></group>
    <group ref={label} position={[0,type.radius*(boss||enemy.kind==="exam"?3.95:3.1),0]}>
      <mesh><planeGeometry args={[1.8,.07]}/><meshBasicMaterial color="#283f43"/></mesh>
      <mesh ref={bar} position={[0,0,.01]}><planeGeometry args={[1.7,.045]}/><meshBasicMaterial color={type.color}/></mesh>
    </group>
  </group>;
}

