import * as THREE from "three";
import { Sculpt } from "../art/sculpt.ts";
export const STUDENT_JADE = "#547c70";
const HAIR = "#3a2926", LIGHT_HAIR = "#49342d", INK = "#302726", SKIN = "#f0c7a7";
export function studentHead(hero: boolean) {
  const group = new THREE.Group(); group.name = hero ? "student-hero-head" : "student-npc-head";
  const skin = new Sculpt();
  skin.ellipsoid([.178,.205,.155], SKIN, [0,.075,0]);
  skin.ellipsoid([.12,.105,.125], SKIN, [0,-.036,.014]);
  for (const side of [-1,1]) {
    skin.ellipsoid([.032,.05,.025], SKIN, [side*.174,.056,0]);
    skin.ellipsoid([.018,.022,.008], "#dba58c", [side*.176,.052,.022]);
    skin.ellipsoid([.038,.022,.009], "#f2af9a", [side*.104,.008,.129]);
  }
  skin.ellipsoid([.018,.028,.018], "#edbb9a", [0,.028,.153]);
  const face = new Sculpt();
  for (const s of [-1,1]) {
    const x=s*.068;
    face.ellipsoid([.038,.029,.010], "#fff9ee", [x,.070,.139], [0,s*.25,s*-.08]);
    face.ellipsoid([.019,.024,.007], "#84563a", [x,.069,.149]);
    face.ellipsoid([.011,.019,.005], INK, [x,.070,.155]);
    face.ellipsoid([.007,.008,.003], "#ffffff", [x-.005,.079,.160]);
    face.beam([x-.033,.095,.148],[x+.030,.096,.148],.005,INK);
    face.beam([x-.028,.124,.137],[x+.025,.126,.137],.004,LIGHT_HAIR);
  }
  face.beam([-.023,-.029,.136],[0,-.035,.144],.0035,"#ae7062");
  face.beam([0,-.035,.144],[.023,-.029,.136],.0035,"#ae7062");
  const hair = new Sculpt();
  hair.add(new THREE.SphereGeometry(.185,16,10,0,Math.PI*2,0,Math.PI*.56),HAIR,[0,.112,-.025],[1,1.0,.96]);
  // Individually tapered locks, baked into the same mesh.
  for (let i=-3;i<=3;i++) {
    hair.ellipsoid([.040,.089,.032], i%2 ? HAIR : LIGHT_HAIR,
      [i*.040,.185-Math.abs(i)*.011,.119-Math.abs(i)*.008],[.18,0,-i*.14]);
  }
  for (const s of [-1,1]) {
    hair.ellipsoid([.052,.142,.070],HAIR,[s*.153,.016,-.025],[.12,0,s*-.12]);
    if (hero) hair.ellipsoid([.050,.115,.06],LIGHT_HAIR,[s*.126,-.052,-.092],[0,0,s*.2]);
  }
  if (hero) {
    hair.ellipsoid([.082,.072,.078],HAIR,[.045,.084,-.181]);
    hair.ellipsoid([.065,.105,.061],HAIR,[.059,-.019,-.190],[.3,0,-.2]);
    hair.ellipsoid([.031,.020,.020],"#d2a55e",[.045,.078,-.238]);
  }
  group.add(skin.mesh("skin"),face.mesh("face"),hair.mesh("hair",.62));
  return group;
}
export function studentOutfit(accent: string) {
  const outfit = new Sculpt();
  const ivory = "#f3e9d4";
  // Open overshirt, ivory inner tee, folded collar and button placket.
  outfit.box([.137,.28,.036],accent,[-.108,-.032,.149],[0,-.1,.035]);
  outfit.box([.137,.28,.036],accent,[.108,-.032,.149],[0,.1,-.035]);
  outfit.box([.078,.29,.018],ivory,[0,-.035,.173]);
  for (const side of [-1,1]) {
    outfit.box([.080,.087,.026],"#a7b7a0",[side*.070,.122,.123],[0,0,side*.36]);
    outfit.box([.052,.055,.019],"#719286",[side*.114,.028,.179]);
    outfit.box([.029,.32,.018],"#947d58",[side*.135,-.018,.197],[0,0,side*-.09]);
    for (const y of [-.11,-.015,.08]) outfit.ellipsoid([.006,.006,.004],"#d9c69f",[side*.055,y,.188]);
  }
  return outfit.mesh("overshirt-and-straps");
}
export function studentBackpack() {
  const group = new THREE.Group(); group.position.set(0,-.012,-.193); group.name="canvas-backpack";
  const bag = new Sculpt();
  bag.box([.272,.326,.16],"#c6a77d",[0,0,0],[0,0,0],.045);
  bag.box([.232,.104,.17],"#b59268",[0,.119,-.017],[0,0,0],.028);
  bag.box([.187,.115,.04],"#d1b58d",[0,-.068,-.092],[0,0,0],.019);
  bag.beam([-.10,.168,0],[-.07,.213,0],.011,"#7b6449");
  bag.beam([-.07,.213,0],[.07,.213,0],.011,"#7b6449");
  bag.beam([.07,.213,0],[.10,.168,0],.011,"#7b6449");
  for (const side of [-1,1]) {
    bag.box([.028,.20,.020],"#8c7050",[side*.077,.025,-.091]);
    bag.box([.039,.043,.012],"#e4c880",[side*.077,.013,-.106]);
    bag.box([.020,.025,.016],"#405e51",[side*.077,.014,-.113]);
  }
  // A real, modelled turtle charm: shell, head and flippers.
  bag.beam([.132,.102,-.05],[.185,-.025,-.07],.004,"#d9bd75");
  bag.ellipsoid([.049,.060,.023],"#5f9275",[.187,-.083,-.078],[0,0,.15]);
  bag.ellipsoid([.035,.042,.010],"#8eb08a",[.187,-.080,-.101]);
  bag.ellipsoid([.022,.024,.024],"#e1cca0",[.183,-.020,-.078]);
  for (const x of [-1,1]) for (const y of [-1,1])
    bag.ellipsoid([.014,.020,.012],"#dfc99b",[.187+x*.040,-.083+y*.036,-.078],[0,0,x*y*.7]);
  group.add(bag.mesh("stitched-pack-and-turtle")); return group;
}

