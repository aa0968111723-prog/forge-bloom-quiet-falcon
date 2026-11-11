import { createFileRoute } from "@tanstack/react-router";
import { handleCloudRequest } from "@/server/cloud/http";

function dispatch({ request }: { request: Request }) {
  return handleCloudRequest(request);
}

export const Route = createFileRoute("/api/cloud/$")({
  server: {
    handlers: {
      GET: dispatch,
      POST: dispatch,
      PUT: dispatch,
      OPTIONS: dispatch,
    },
  },
});
