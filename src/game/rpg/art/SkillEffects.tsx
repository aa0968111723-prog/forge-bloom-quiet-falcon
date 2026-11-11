import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRpg } from "../store";
import { DEPARTMENTS } from "../data";
import { terrainHeight } from "../../world";
import { disposeSculpt } from "../../art/sculpt";
import { useReducedArtMotion } from "../../art/motion";
import { quality } from "../../quality";
import { DEDICATED_SKILL_VFX } from "../../art/vfx/StructuralPulse";
import { BASIC_SWING_DURATION, basicSwingGeometry, basicSwingPose } from "../../art/vfx/basic-swing";
export type SkillFamily = "lattice" | "script" | "leaves" | "orbits" | "coins";
export function skillFamily(discipline: string): SkillFamily {
  if (["engineering","computing"].includes(discipline)) return "lattice";
  if (["humanities","language","international"].includes(discipline)) return "script";
  if (["health","education"].includes(discipline)) return "leaves";
  return discipline==="business" ? "coins" : "orbits";
}
function buildEffects(detailed:boolean) {
  const root=new THREE.Group();
  const material=()=>new THREE.MeshBasicMaterial({color:"#91ded3",transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  const add=(g:THREE.Group,geo:THREE.BufferGeometry,p:[number,number,number],r:[number,number,number]=[0,0,0])=>{
    const m=new THREE.Mesh(geo,material());m.position.set(...p);m.rotation.set(...r);g.add(m);return m;
  };
  for (const name of ["lattice","script","leaves","orbits","coins","basic"]) {
    const g=new THREE.Group();g.name=name;root.add(g);
    if(name==="basic") {
      // Arm-length vertical slash. The frame loop sweeps it; it is not scaled to range.
      add(g, basicSwingGeometry(detailed), [0, 1.28, -0.62]);
      continue;
    }
    add(g,new THREE.RingGeometry(.87,.89,48),[0,.018,0],[-Math.PI/2,0,0]);
    const n=detailed?8:4;
    if(name==="lattice") {
      for(let i=0;i<n;i++) {
        const a=i/n*Math.PI*2;
        const edges=new THREE.EdgesGeometry(new THREE.OctahedronGeometry(.065,0));
        const m=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({transparent:true,depthWrite:false}));
        m.position.set(Math.cos(a)*.50,.10,Math.sin(a)*.50);g.add(m);
        add(g,new THREE.RingGeometry(.085,.090,4),[Math.cos(a)*.72,.028,Math.sin(a)*.72],[-Math.PI/2,0,Math.PI/4]);
      }
      for(let i=0;i<3;i++)add(g,new THREE.TorusGeometry(.42,.006,3,4),[0,.07+i*.07,0],[-Math.PI/2,0,i*.30]);
    } else if(name==="script") {
      for(let i=0;i<n;i++) {
        const a=i/n*Math.PI*2,p=new THREE.PlaneGeometry(.16,.085,5,1),pos=p.attributes.position;
        for(let j=0;j<pos.count;j++)pos.setZ(j,Math.sin(pos.getX(j)*22)*.025);
        p.computeVertexNormals();
        add(g,p,[Math.cos(a)*.62,.11+(i%3)*.04,Math.sin(a)*.62],[.3,a,-.3]);
      }
      add(g,new THREE.TorusGeometry(.55,.008,4,40,Math.PI*1.6),[0,.06,0],[-Math.PI/2,0,.4]);
    } else if(name==="leaves") {
      for(let i=0;i<n;i++) {
        const a=i/n*Math.PI*2;
        const m=add(g,new THREE.SphereGeometry(.07,8,5),[Math.cos(a)*.60,.06+(i%2)*.09,Math.sin(a)*.60],[.4,-a,.5]);
        m.scale.set(.40,1.5,.15);
      }
      add(g,new THREE.RingGeometry(.56,.57,48),[0,.03,0],[-Math.PI/2,0,0]);
      add(g,new THREE.RingGeometry(.1,.12,4),[0,.08,0],[-Math.PI/2,0,Math.PI/4]);
    } else {
      for(let i=0;i<(detailed?3:2);i++) {
        add(g,new THREE.TorusGeometry(.48,.006,3,36),[0,.12,0],[i*Math.PI/3,Math.PI/3,i*.9]);
      }
      for(let i=0;i<n;i++) {
        const a=i/n*Math.PI*2;
        add(g,name==="coins"?new THREE.CylinderGeometry(.035,.035,.009,12):new THREE.OctahedronGeometry(.027),
          [Math.cos(a)*.58,.12,Math.sin(a)*.58],[.3,a,.4]);
      }
    }
  }
  root.name="discipline-effects";return root;
}
export function SkillEffects() {
  const reduced=useReducedArtMotion(), root=useRef<THREE.Group>(null);
  const effects=useMemo(()=>buildEffects(quality().tier==="high"),[]);
  useEffect(()=>()=>disposeSculpt(effects),[effects]);
  useFrame(()=>{
    const state=useRpg.getState(), fx=state.attackFx;
    const age=fx?state.clock-fx.at:Infinity, duration=fx?.skill ? .65 : BASIC_SWING_DURATION;
    if(!root.current)return;
    root.current.visible=Boolean(fx && age>=0 && age<duration && !state.interiorId);
    if(!fx || !root.current.visible)return;
    const t=age/duration;
    const groundY=terrainHeight(fx.x,fx.z);
    root.current.position.set(fx.x, groundY, fx.z);
    root.current.rotation.y=fx.yaw;
    const discipline=DEPARTMENTS.find(d=>d.id===state.departmentId)?.discipline??"science";
    // Disciplines with a dedicated effect draw their own skill; the basic swing stays here.
    if(fx.skill && DEDICATED_SKILL_VFX[discipline]){root.current.visible=false;return;}
    const name=fx.skill ? skillFamily(discipline) : "basic";
    // Skills that still fall through here expand to the real range. The slash does not.
    root.current.scale.setScalar(name==="basic" ? 1 : fx.range*(reduced ? .80 : .25+.75*t));
    const swing=basicSwingPose(age, reduced);
    for(const group of effects.children) {
      group.visible=group.name===name;
      if(!group.visible)continue;
      if(name==="basic"){group.position.x=swing.x;group.rotation.z=swing.roll;group.rotation.y=0;}
      else group.rotation.y=reduced?0:fx.skill?t*.65:0;
      group.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(!mesh.material)return;
        const m=mesh.material as THREE.MeshBasicMaterial;
        m.color.set(fx.color);m.opacity=name==="basic" ? swing.opacity : (1-t)*(reduced ? .40 : .80);
      });
    }
  });
  return <group ref={root} visible={false}><primitive object={effects}/></group>;
}

