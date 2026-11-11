import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Sculpt, disposeSculpt } from "../art/sculpt";
import { quality } from "../quality";
import { propsOfKind } from "../world-data/props";
import { sampleGroundElevation } from "../world-data/elevation";
import { LIBRARY, PALACE, palaceHallZs } from "../world-data/landmarks";
/** Decorative detail only: never changes the measured footprints or walkability. */
export function buildCampusCraft(detailed: boolean) {
  const group=new THREE.Group();group.name="palace-campus-craft";
  const stone=new Sculpt(), flowers=new Sculpt(), roofs=new Sculpt();
  for(let i=0;i<18;i++) {
    const z=-24-i*10;
    for(const side of [-1,1]) {
      const x=side*5.6, y=sampleGroundElevation(x,z);
      // Low planting, kept outside the 6m main paving.
      stone.box([.70,.13,1.70],"#c4b9a0",[x,y+.07,z],[0,0,0],.04);
      for(let f=0;f<(detailed?9:4);f++) {
        const fx=x+Math.sin(f*2.4+i)*.23,fz=z+Math.cos(f*1.7)*.61,fy=sampleGroundElevation(fx,fz);
        flowers.ellipsoid([.16,.16,.14],"#527c58",[fx,fy+.20,fz]);
        if(f%2===0) {
          const color=["#d9879f","#ddae9b","#b9a3cf","#e7d8bc"][(i+f)%4];
          for(let petal=0;petal<(detailed?5:3);petal++) {
            const a=petal*Math.PI*.4;
            flowers.ellipsoid([.06,.025,.04],color,[fx+Math.cos(a)*.06,fy+.36,fz+Math.sin(a)*.06]);
          }
          flowers.ellipsoid([.025,.02,.025],"#e8c77f",[fx,fy+.38,fz]);
        }
      }
    }
  }
  // Tile-roll ribs and warm structural brackets are baked into two meshes,
  // rather than mounting hundreds of independently rendered roof elements.
  for(const z of palaceHallZs())for(const side of [-1,1]) {
    const x=side*PALACE.offsetX,y=sampleGroundElevation(x,z)+.55+PALACE.storeyHeight;
    for(const slope of [-1,1]) {
      for(let r=-7;r<=7;r+=detailed?1:2) {
        roofs.beam([x,y+3.44,z+r],[x+slope*7.44,y+.10,z+r*1.10],.034,r%2?"#4c8067":"#376653");
      }
      roofs.beam([x+slope*7.48,y+.14,z-15.45],[x+slope*7.48,y+.14,z+15.45],.065,"#467a60");
    }
    const front=x-side*7.9;
    for(let bay=-3;bay<=3;bay++) {
      const bz=z+bay*3.65;
      stone.box([.15,.25,.40],"#d9cba8",[front,y-.46,bz]);
      roofs.box([.48,.13,.35],"#7d4934",[front,y-.24,bz]);
    }
  }
  // The existing lantern positions stay authoritative; detail wraps their glass.
  for(const lamp of propsOfKind("lantern-post")) {
    const y=sampleGroundElevation(lamp.x,lamp.z)+3.65;
    for(let edge=0;edge<6;edge++) {
      const a=edge/6*Math.PI*2+Math.PI/6;
      roofs.beam([lamp.x+Math.cos(a)*.30,y+.04,lamp.z+Math.sin(a)*.30],
        [lamp.x+Math.cos(a)*.30,y+.68,lamp.z+Math.sin(a)*.30],.018,"#69583a");
    }
    if(detailed)roofs.ellipsoid([.07,.12,.07],"#b69a59",[lamp.x,y+1.04,lamp.z]);
  }
  const [lx,lz]=LIBRARY.center, ly=sampleGroundElevation(lx,lz);
  for(let floor=0;floor<LIBRARY.floors;floor++) {
    const width=LIBRARY.width-(floor<3?0:floor<6?8:18);
    const depth=LIBRARY.length-(floor<3?0:floor<6?5:9);
    const offset=floor<3?0:floor<6?-1.5:-3;
    const y=ly+1.1+floor*LIBRARY.floorHeight+LIBRARY.floorHeight*.55;
    for(const side of [-1,1]) {
      for(let x=-width/2+3;x<width/2-1;x+=detailed?3.5:7)
        roofs.box([.07,LIBRARY.floorHeight*.58,.10],"#84998d",[lx+x,y,lz+offset+side*(depth/2+.085)]);
      stone.box([width-1.8,.12,.28],"#dfcfb1",[lx,y+1.15,lz+offset+side*(depth/2+.09)]);
    }
  }
  group.add(stone.mesh("stone-and-brackets"),flowers.mesh("azalea-underplanting"),roofs.mesh("glazed-tile-rolls",.55));
  return group;
}
export function CampusCraft() {
  const detail=quality().tier==="high";
  const model=useMemo(()=>buildCampusCraft(detail),[detail]);
  useEffect(()=>()=>disposeSculpt(model),[model]);
  return <primitive object={model}/>;
}

