import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import handler from "../api/index.mjs";

test("Vercel Function chuyển tiếp đúng các tuyến API", async (context) => {
  const server = createServer((request, response) => {
    const incoming = new URL(request.url || "/", "http://localhost");
    const route = incoming.pathname.replace(/^\/api\/?/, "");
    if (route === "login") {
      request.body = { username: "invalid", password: "invalid" };
    }
    incoming.pathname = "/api/index";
    incoming.searchParams.set("__route", route);
    request.url = `${incoming.pathname}${incoming.search}`;
    void handler(request, response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const origin = `http://127.0.0.1:${server.address().port}`;
  const sessionResponse = await fetch(`${origin}/api/session`);
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(await sessionResponse.json(), { authenticated: false });

  const validationResponse = await fetch(`${origin}/api/bootstrap?date=khong-hop-le`);
  assert.equal(validationResponse.status, 400);
  assert.equal((await validationResponse.json()).error.code, "BAD_REQUEST");

  const loginResponse = await fetch(`${origin}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(loginResponse.status, 401);
  assert.equal((await loginResponse.json()).error.code, "INVALID_CREDENTIALS");
});
