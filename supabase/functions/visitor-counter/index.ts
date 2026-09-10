const PRODUCTION_ORIGIN = "https://aleaf.is-a.dev";
const encoder = new TextEncoder();

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const url = new URL(origin);
    if (origin !== url.origin) return null;

    const isProduction = origin === PRODUCTION_ORIGIN;
    const isLocal = (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:");

    return isProduction || isLocal ? url.origin : null;
  } catch {
    return null;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };

  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeIpv4(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  const normalized: string[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    normalized.push(String(octet));
  }

  return normalized.join(".");
}

function parseIpv6Side(side: string): number[] | null {
  if (!side) return [];

  const parts = side.split(":");
  const parsed: number[] = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!part) return null;

    if (part.includes(".")) {
      if (index !== parts.length - 1) return null;
      const ipv4 = normalizeIpv4(part);
      if (!ipv4) return null;
      const octets = ipv4.split(".").map(Number);
      parsed.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      continue;
    }

    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
    parsed.push(Number.parseInt(part, 16));
  }

  return parsed;
}

function normalizeIpv6(value: string): string | null {
  if (value.includes("%")) return null;

  const compression = value.indexOf("::");
  if (compression !== -1 && compression !== value.lastIndexOf("::")) return null;

  const left = parseIpv6Side(compression === -1 ? value : value.slice(0, compression));
  const right = compression === -1 ? [] : parseIpv6Side(value.slice(compression + 2));
  if (!left || !right) return null;

  let groups: number[];
  if (compression === -1) {
    if (left.length !== 8) return null;
    groups = left;
  } else {
    const omitted = 8 - left.length - right.length;
    if (omitted < 1) return null;
    groups = [...left, ...Array(omitted).fill(0), ...right];
  }

  let bestStart = -1;
  let bestLength = 0;
  for (let start = 0; start < groups.length;) {
    if (groups[start] !== 0) {
      start++;
      continue;
    }

    let end = start;
    while (end < groups.length && groups[end] === 0) end++;
    if (end - start > bestLength && end - start >= 2) {
      bestStart = start;
      bestLength = end - start;
    }
    start = end;
  }

  const hex = groups.map((group) => group.toString(16));
  if (bestStart === -1) return hex.join(":");

  const before = hex.slice(0, bestStart).join(":");
  const after = hex.slice(bestStart + bestLength).join(":");
  return `${before}::${after}`;
}

function normalizeIp(value: string): string | null {
  let candidate = value.trim();
  if (!candidate) return null;

  const bracketed = candidate.match(/^\[([^\]]+)\](?::(\d{1,5}))?$/);
  if (bracketed) {
    if (bracketed[2] && Number(bracketed[2]) > 65535) return null;
    candidate = bracketed[1];
  }

  const ipv4 = normalizeIpv4(candidate);
  if (ipv4) return ipv4;

  const ipv4WithPort = candidate.match(/^(.+):(\d{1,5})$/);
  if (ipv4WithPort && Number(ipv4WithPort[2]) <= 65535) {
    const host = normalizeIpv4(ipv4WithPort[1]);
    if (host) return host;
  }

  return normalizeIpv6(candidate);
}

function clientIp(request: Request): string | null {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-forwarded-for")?.split(",", 1)[0] ?? null,
    request.headers.get("x-real-ip"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizeIp(candidate);
    if (normalized) return normalized;
  }

  return null;
}

async function hmacIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("origin");
  const origin = allowedOrigin(request);

  if (requestOrigin && !origin) {
    return jsonResponse({ error: "Request not allowed" }, 403, null);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Request not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders(origin),
        "Allow": "POST, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  const ip = clientIp(request);
  if (!ip) return jsonResponse({ error: "Unable to process request" }, 400, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hashSecret = Deno.env.get("VISITOR_HASH_SECRET") || serviceRoleKey;
  if (!supabaseUrl || !serviceRoleKey || !hashSecret) {
    return jsonResponse({ error: "Unable to process request" }, 500, origin);
  }

  try {
    const ipHash = await hmacIp(ip, hashSecret);
    const rpcResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/record_ip_visit`, {
      method: "POST",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_ip_hash: ipHash }),
    });

    if (!rpcResponse.ok) throw new Error("RPC failed");

    const result: unknown = await rpcResponse.json();
    const total = typeof result === "number"
      ? result
      : typeof result === "string" && /^\d+$/.test(result)
      ? Number(result)
      : null;
    if (total === null || !Number.isSafeInteger(total) || total < 0) {
      throw new Error("Invalid RPC response");
    }

    return jsonResponse({ total }, 200, origin);
  } catch {
    return jsonResponse({ error: "Unable to process request" }, 500, origin);
  }
});
