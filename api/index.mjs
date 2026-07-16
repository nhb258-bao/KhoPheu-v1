import { createDefaultApplication } from "../app.mjs";

let application;

function apiRoute(request) {
  const rewritten = new URL(request.url || "/", "http://localhost");
  const queryRoute = request.query?.__route;
  const routeValue = Array.isArray(queryRoute)
    ? queryRoute.join("/")
    : queryRoute ?? rewritten.searchParams.get("__route") ?? "";
  const route = String(routeValue).replace(/^\/+|\/+$/g, "");
  rewritten.searchParams.delete("__route");
  return `/api/${route}${rewritten.search}`;
}

function getApplication() {
  if (!application) application = createDefaultApplication().application;
  return application;
}

function sendInitializationError(response, error) {
  if (response.headersSent) {
    response.destroy(error);
    return;
  }

  const body = Buffer.from(
    JSON.stringify({
      message: "Máy chủ không thể khởi tạo.",
      error: { code: "SERVER_INITIALIZATION_FAILED" },
    }),
  );
  response.writeHead(500, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

export default async function handler(request, response) {
  try {
    request.url = apiRoute(request);
    await getApplication()(request, response);
  } catch (error) {
    console.error("[vercel] Không thể khởi tạo ứng dụng:", error);
    sendInitializationError(response, error);
  }
}
