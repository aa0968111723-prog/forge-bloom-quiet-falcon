import * as THREE from "three";
import { Sculpt } from "../../art/sculpt.ts";
import type { EnemyKind } from "../data";
const PAPER="#f2e5ca", INK="#292941", GOLD="#cda768", JADE="#70c8b5";
/** Folded sheet with a subtle curl: silhouette comes from geometry, not a box. */
function sheet(width:number,height:number) {
  const g=new THREE.PlaneGeometry(width,height,4,8), p=g.attributes.position;
  for(let i=0;i<p.count;i++) {
    const y=p.getY(i), x=p.getX(i);
    p.setZ(i,Math.sin(y/height*Math.PI*2)*width*.13+Math.abs(x/width)*.09);
  }
  g.computeVertexNormals(); return g;
}
export function creatureModel(kind: EnemyKind, detailed = true) {
  const root=new THREE.Group(); root.name="anomaly-"+kind;
  const body=new Sculpt(), trim=new Sculpt(), orbit=new Sculpt();
  const pages=detailed?7:3;
  if(kind==="quiz") {
    body.add(sheet(1.18,1.65),PAPER,[0,0,0]);
    body.add(sheet(.86,.65),"#d9c7a9",[0,-.63,-.05],[1,1,1],[.35,0,-.15]);
    for(const s of [-1,1]) {
      trim.ellipsoid([.20,.105,.024],INK,[s*.27,.20,.14],[0,0,s*.23]);
      trim.ellipsoid([.075,.068,.025],"#e8b568",[s*.25,.18,.168]);
      trim.ellipsoid([.031,.048,.016],INK,[s*.25,.18,.19]);
      trim.ellipsoid([.023,.021,.012],"#fff7dd",[s*.25-.02,.21,.207]);
      trim.beam([s*.12,.38,.15],[s*.45,.48,.14],.026,INK);
    }
    trim.beam([-.14,-.17,.15],[0,-.23,.18],.014,INK);
    trim.beam([0,-.23,.18],[.18,-.13,.14],.014,INK);
    trim.beam([.18,-.45,.16],[.43,-.22,.16],.026,"#b65055");
    trim.beam([.43,-.45,.16],[.18,-.22,.16],.026,"#b65055");
    for(let i=0;i<4;i++) trim.box([.67-i*.05,.012,.009],"#c5b59d",[-.03,.66-i*.068,.145]);
  } else if(kind==="report") {
    body.box([1.40,1.65,.40],"#3c4564",[0,0,0],[0,0,-.10],.07);
    body.box([1.26,1.45,.26],PAPER,[.08,-.02,.13],[0,0,-.10]);
    body.box([1.41,1.67,.06],"#4c597c",[.02,0,.30],[0,0,-.10]);
    body.box([1.04,.35,.025],"#e4d3b6",[.02,.40,.341],[0,0,-.10]);
    for(let i=0;i<3;i++) {
      trim.add(new THREE.TorusGeometry(.105,.026,5,12),GOLD,[-.59,.45-i*.40,.36]);
      trim.box([.16,.11,.055],["#bf8a9e","#94bda1","#c5a673"][i],[.76,.55-i*.38,.25]);
    }
    for(const s of [-1,1]) {
      body.box([.49,.43,.39],"#40465e",[s*.88,-.28,0],[0,0,s*.4]);
      body.box([.37,.39,.36],PAPER,[s*1.12,-.65,.04],[0,0,s*-.2]);
      body.box([.39,.32,.65],"#303c53",[s*.43,-1.05,.12],[0,0,s*.2]);
    }
    trim.add(new THREE.OctahedronGeometry(.25,0),"#bc9cf4",[0,-.17,.55]);
    for(const s of [-1,1]) trim.beam([s*.17,.10,.36],[s*.47,.22,.36],.030,INK);
  } else {
    const boss=kind==="final", dark=boss?"#2d304d":"#456477";
    body.add(new THREE.ConeGeometry(.70,1.65,7,1,true),dark,[0,-.10,0],[1,1,.65],[Math.PI,0,0]);
    body.box([.65,.74,.35],dark,[0,.56,0],[0,0,.05]);
    body.add(new THREE.OctahedronGeometry(.34,0),INK,[0,1.05,.02],[1,.9,.7]);
    for(const s of [-1,1]) {
      body.box([.52,.16,.39],dark,[s*.48,.72,0],[0,0,s*.43]);
      body.box([.22,.66,.25],dark,[s*.68,.32,.02],[0,0,s*.23]);
      trim.beam([s*.13,1.09,.27],[s*.32,1.10,.17],.025,GOLD);
      trim.beam([s*.20,.51,.26],[s*.37,-.72,.12],.025,GOLD);
    }
    trim.add(new THREE.OctahedronGeometry(.17,0),boss?"#e4b97c":JADE,[0,.41,.30]);
    const halo=new THREE.Group();halo.name="clock-halo";halo.position.set(0,1.14,-.20);
    const clock=new Sculpt();
    clock.add(new THREE.TorusGeometry(.90,.027,6,48),GOLD);
    for(let i=0;i<12;i++) {
      const a=i/12*Math.PI*2;
      clock.box([.026,i%3===0?.16:.09,.025],GOLD,[Math.sin(a)*.82,Math.cos(a)*.82,0],[0,0,-a]);
    }
    clock.beam([0,0,.025],[.35,.38,.025],.022,GOLD);
    clock.beam([0,0,.04],[-.1,.60,.04],.015,GOLD);
    halo.add(clock.mesh("deadline-clock",.45));root.add(halo);
  }
  for(let i=0;i<pages;i++) {
    const a=i/pages*Math.PI*2, r=kind==="quiz" ? .96 : 1.18;
    orbit.add(sheet(.25+i%2*.12,.38),PAPER,[(i%2?1:-1)*(r+Math.cos(a)*.14),Math.sin(a)*.65,Math.sin(a)*r*.35],[1,1,1],[.2,a,i*.41]);
  }
  const bodyMesh=body.mesh("body"), trimMesh=trim.mesh("ink-and-gold",.56);
  (bodyMesh.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
  const satellite=orbit.mesh("orbiting-pages");(satellite.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
  root.add(bodyMesh,trimMesh,satellite);
  root.userData.artKind=kind; root.userData.artVersion=1;
  return root;
}

