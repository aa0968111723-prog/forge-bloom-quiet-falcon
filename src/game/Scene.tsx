import { Npcs } from "./Npcs";
import { Player } from "./Player";
import { useGame } from "./store";
import { World } from "./world/World";

export function GameScene() {
  const timeOfDay = useGame((s) => s.timeOfDay);
  return (
    <>
      <World timeOfDay={timeOfDay} />
      <Npcs />
      <Player />
    </>
  );
}
