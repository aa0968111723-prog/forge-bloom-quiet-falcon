import { useEffect, useState } from "react";
/** Honour OS motion preference, including changes while the game is open. */
export function useReducedArtMotion() {
  const [reduced,setReduced]=useState(()=>typeof matchMedia!=="undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(()=>{
    const m=matchMedia("(prefers-reduced-motion: reduce)"), update=()=>setReduced(m.matches);
    update();m.addEventListener("change",update);return()=>m.removeEventListener("change",update);
  },[]);
  return reduced;
}

