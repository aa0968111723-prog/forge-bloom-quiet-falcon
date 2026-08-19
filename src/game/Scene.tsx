import { CampusWorld } from "./CampusWorld";
import { Npcs } from "./Npcs";
import { Player } from "./Player";
import { useGame } from "./store";

export function GameScene() {
  const timeOfDay = useGame((s) => s.timeOfDay);
  return (
    <>
      <CampusWorld timeOfDay={timeOfDay} />
      <Npcs />
      <Player />
    </>
  );
}
