import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {buildCharacter} from "../src/game/character/model.ts";
import {creatureModel} from "../src/game/rpg/art/creatures.ts";
import {disposeSculpt} from "../src/game/art/sculpt.ts";
function inspect(root) {
  let triangles=0,meshes=0;
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh)return;meshes++;
    const g=o.geometry,p=g.attributes.position;
    assert.ok(p.count>0);
    for(const key of ["position","normal","color"]) {
      const a=g.attributes[key];if(a)for(const n of a.array)assert.ok(Number.isFinite(n),"non-finite "+key);
    }
    triangles+=(g.index?.count??p.count)/3;
  });
  const box=new THREE.Box3().setFromObject(root);
  assert.ok(!box.isEmpty());assert.ok(Number.isFinite(box.max.y));
  return {meshes,triangles};
}
test("dressed student binds before mounting and retains valid weighted limbs",()=>{
  const a=buildCharacter("#547c70",true,true),b=buildCharacter("#1a3f6d",false,false);
  for(const c of [a,b]) {
    const stats=inspect(c.group);
    assert.ok(stats.meshes<=8,"student stays batched");
    assert.ok(stats.triangles<22000,"student geometry budget");
    assert.ok(c.mesh.skeleton instanceof THREE.Skeleton);
    assert.ok(c.rig.bones.head.children.length>0);
    assert.ok(c.rig.bones.chest.children.some(x=>x.name==="canvas-backpack"));
    for(let i=0;i<c.mesh.geometry.attributes.skinWeight.count;i++) {
      const w=c.mesh.geometry.attributes.skinWeight;
      assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-4);
    }
    c.dispose();
  }
});
test("all four anomaly silhouettes have finite geometry and a cheaper low tier",()=>{
  for(const kind of ["quiz","report","exam","final"]) {
    const high=creatureModel(kind,true),low=creatureModel(kind,false);
    const h=inspect(high),l=inspect(low);
    assert.ok(h.meshes<=4);assert.ok(h.triangles<18000);
    assert.ok(l.triangles<h.triangles,"low detail removes satellite pages");
    assert.equal(Boolean(high.getObjectByName("clock-halo")),["exam","final"].includes(kind));
    disposeSculpt(high);disposeSculpt(low);
  }
});
test("procedural art cleanup disposes every owned mesh resource once",()=>{
  const model=creatureModel("final",true),counts=[];
  model.traverse(o=>{if(o.isMesh)for(const resource of [o.geometry,o.material]){
    const item={count:0};counts.push(item);resource.addEventListener("dispose",()=>item.count++);
  }});
  const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial());
  model.add(line);
  for(const resource of [line.geometry,line.material]) {
    const item={count:0};counts.push(item);resource.addEventListener("dispose",()=>item.count++);
  }
  disposeSculpt(model);assert.ok(counts.length>0);assert.ok(counts.every(x=>x.count===1));
});

