import { createFileRoute } from "@tanstack/react-router";
import { CampusGame } from "@/components/game/CampusGame";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  return <CampusGame />;
}
