import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function parseCookies(header = "") {
  const cookies = Object.create(null);
  for (const part of String(header).split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export class SessionManager {
  #sessions = new Map();

  constructor({ secret, ttlMs = 8 * 60 * 60 * 1_000, cookieName = "khopheu_session" }) {
    this.secret = secret;
    this.ttlMs = ttlMs;
    this.cookieName = cookieName;
  }

  #signature(id) {
    return createHmac("sha256", this.secret).update(id).digest("base64url");
  }

  #token(id) {
    return `${id}.${this.#signature(id)}`;
  }

  #idFromToken(token) {
    if (!token) return null;
    const separator = token.lastIndexOf(".");
    if (separator <= 0) return null;
    const id = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    return safeEqual(signature, this.#signature(id)) ? id : null;
  }

  create(username) {
    this.prune();
    const id = randomBytes(32).toString("base64url");
    this.#sessions.set(id, { username, expiresAt: Date.now() + this.ttlMs });
    return this.#token(id);
  }

  read(cookieHeader) {
    const token = parseCookies(cookieHeader)[this.cookieName];
    const id = this.#idFromToken(token);
    if (!id) return null;
    const session = this.#sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      if (id) this.#sessions.delete(id);
      return null;
    }
    return { username: session.username, expiresAt: session.expiresAt };
  }

  destroy(cookieHeader) {
    const token = parseCookies(cookieHeader)[this.cookieName];
    const id = this.#idFromToken(token);
    if (id) this.#sessions.delete(id);
  }

  cookie(token, { secure = false, clear = false } = {}) {
    const attributes = [
      `${this.cookieName}=${clear ? "" : token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${clear ? 0 : Math.floor(this.ttlMs / 1000)}`,
    ];
    if (secure) attributes.push("Secure");
    return attributes.join("; ");
  }

  prune() {
    const now = Date.now();
    for (const [id, session] of this.#sessions) {
      if (session.expiresAt <= now) this.#sessions.delete(id);
    }
  }
}

export function credentialsMatch(actualUsername, actualPassword, expectedUsername, expectedPassword) {
  const userDigest = createHmac("sha256", "username").update(String(actualUsername ?? "")).digest();
  const expectedUserDigest = createHmac("sha256", "username").update(String(expectedUsername)).digest();
  const passwordDigest = createHmac("sha256", "password").update(String(actualPassword ?? "")).digest();
  const expectedPasswordDigest = createHmac("sha256", "password").update(String(expectedPassword)).digest();
  const usernameMatches = timingSafeEqual(userDigest, expectedUserDigest);
  const passwordMatches = timingSafeEqual(passwordDigest, expectedPasswordDigest);
  return usernameMatches && passwordMatches;
}
