import { createFileRoute } from "@tanstack/react-router";
import { handleCloudRequest } from "@/server/cloud/http";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handleCloudRequest(request),
    },
  },
});
