import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRpg } from "../store";
import { DEPARTMENTS } from "../data";
import { terrainHeight } from "../../world";
import { disposeSculpt } from "../../art/sculpt";
import { useReducedArtMotion } from "../../art/motion";
import { quality } from "../../quality";
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
      add(g,new THREE.TorusGeometry(.78,.018,4,28,2.1),[0,.14,0],[-Math.PI/2,0,.55]);
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
    const age=fx?state.clock-fx.at:Infinity, duration=fx?.skill ? .65 : .30;
    if(!root.current)return;
    root.current.visible=Boolean(fx && age>=0 && age<duration && !state.interiorId);
    if(!fx || !root.current.visible)return;
    const t=age/duration;
    root.current.position.set(fx.x,terrainHeight(fx.x,fx.z)+.10,fx.z);
    root.current.rotation.y=fx.yaw;
    const scale=fx.range*(reduced ? .80 : .25+.75*t);
    root.current.scale.setScalar(scale);
    const name=fx.skill ? skillFamily(DEPARTMENTS.find(d=>d.id===state.departmentId)?.discipline??"science") : "basic";
    for(const group of effects.children) {
      group.visible=group.name===name;
      if(!group.visible)continue;
      group.rotation.y=reduced?0:fx.skill?t*.65:0;
      group.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(!mesh.material)return;
        const m=mesh.material as THREE.MeshBasicMaterial;
        m.color.set(fx.color);m.opacity=(1-t)*(reduced ? .40 : .80);
      });
    }
  });
  return <group ref={root} visible={false}><primitive object={effects}/></group>;
}

