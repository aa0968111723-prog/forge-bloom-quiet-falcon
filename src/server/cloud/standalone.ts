import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { auth } from "../../lib/auth/server.ts";
import { closeDb } from "../../lib/db.ts";
import { handleCloudRequest } from "./http.ts";

const MAX_BODY = 262_144;

export async function startGameServer(options?: { host?: string; port?: number }) {
  const host = options?.host ?? (process.env.HOST?.trim() || "0.0.0.0");
  const port = options?.port ?? Number(process.env.PORT ?? 8080);
  const server = createServer((req, res) => {
    void handleNodeRequest(req, res).catch((err) => {
      console.error("[game-services] request failed", err instanceof Error ? err.name : "error");
      if (res.headersSent) return;
      res.statusCode = 500;
      res.end("internal");
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  const boundHost = typeof address === "object" && address ? address.address : host;
  return {
    host: boundHost,
    port: boundPort,
    url: `http://127.0.0.1:${boundPort}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await closeDb();
    },
  };
}

async function handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = String(req.headers.host ?? "127.0.0.1");
  const method = (req.method ?? "GET").toUpperCase();
  const declared = Number(req.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    res.statusCode = 413;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({ error: { code: "payload_too_large", message: "請求超過大小上限。" } }),
    );
    return;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY) {
      res.statusCode = 413;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({ error: { code: "payload_too_large", message: "請求超過大小上限。" } }),
      );
      return;
    }
    chunks.push(buffer);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
  const request = new Request(`http://${host}${req.url ?? "/"}`, {
    method,
    headers,
    body,
  });
  const path = new URL(request.url).pathname;
  const response = path.startsWith("/api/auth/")
    ? await auth.handler(request)
    : path.startsWith("/api/cloud/") || path === "/api/health" || path === "/api/ready"
      ? await handleCloudRequest(request)
      : new Response("not found", { status: 404 });
  await send(res, response);
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) res.appendHeader("set-cookie", cookie);
  const payload = Buffer.from(await response.arrayBuffer());
  res.end(payload);
}
