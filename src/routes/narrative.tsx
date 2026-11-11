import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const NarrativePreview = lazy(() =>
  import("@/features/narrative/preview/NarrativePreview").then((mod) => ({
    default: mod.NarrativePreview,
  })),
);

export const Route = createFileRoute("/narrative")({
  ssr: false,
  component: NarrativeRoute,
});

function NarrativeRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-base text-paper">正在讀取敘事預覽…</p>}>
      <NarrativePreview />
    </Suspense>
  );
}
