import { createFileRoute } from "@tanstack/react-router";
import AdventureApp from "@/game/rpg/AdventureApp";
import "@/game/rpg/adventure.css";
import { CloudSaveDock } from "@/features/cloud-save/CloudSaveDock";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  return (
    <>
      <AdventureApp />
      <CloudSaveDock />
    </>
  );
}
