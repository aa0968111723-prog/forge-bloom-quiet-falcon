import { createFileRoute } from "@tanstack/react-router";
import AdventureApp from "@/game/rpg/AdventureApp";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  return <AdventureApp />;
}
