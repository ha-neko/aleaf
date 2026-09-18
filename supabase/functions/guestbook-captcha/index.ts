const PRODUCTION_ORIGIN = "https://aleaf.is-a.dev";
const DANBOORU_API = "https://danbooru.donmai.us/posts.json";
const DANBOORU_USER_AGENT = "aleaf.is-a.dev guestbook-captcha/2.0";
const POSTS_PER_PAGE = 40;
const STATIC_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const DISPLAY_SIZE = 300;
const PIECE_SIZE = 68;
const BOARD_PADDING = 24;
const MAX_PIECE_COORD = DISPLAY_SIZE - PIECE_SIZE - BOARD_PADDING;

type DanbooruVariant = { type?: unknown; url?: unknown; file_ext?: unknown };
type DanbooruPost = {
  id?: unknown; rating?: unknown; tag_string_character?: unknown;
  image_width?: unknown; image_height?: unknown;
  media_asset?: { file_ext?: unknown; variants?: unknown } | null;
};

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return (origin === PRODUCTION_ORIGIN ||
      ((url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        (url.protocol === "http:" || url.protocol === "https:")))
      ? url.origin : null;
  } catch { return null; }
}

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Vary": "Origin", "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });
}

function randomInt(max: number): number {
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = randomInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function safeImageUrl(asset: DanbooruPost["media_asset"]): string | null {
  if (!asset || typeof asset.file_ext !== "string" || !STATIC_IMAGE_EXTENSIONS.has(asset.file_ext.toLowerCase()) ||
    !Array.isArray(asset.variants)) return null;
  for (const v of asset.variants as DanbooruVariant[]) {
    if (!v || typeof v.url !== "string" || typeof v.file_ext !== "string" || !STATIC_IMAGE_EXTENSIONS.has(v.file_ext.toLowerCase())) continue;
    try {
      const u = new URL(v.url);
      if (u.origin === "https://cdn.donmai.us" &&
        u.pathname.startsWith("/360x360/") &&
        !u.username && !u.password && !u.search) return u.href;
    } catch { /* skip */ }
  }
  return null;
}

async function fetchMizukiImage(): Promise<string> {
  const tags = "akiyama_mizuki solo rating:general";
  const pages = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const page of pages) {
    const url = new URL(DANBOORU_API);
    url.searchParams.set("tags", tags);
    url.searchParams.set("limit", String(POSTS_PER_PAGE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("only", "id,rating,tag_string_character,image_width,image_height,media_asset");
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { "Accept": "application/json", "User-Agent": DANBOORU_USER_AGENT },
        signal: AbortSignal.timeout(12000),
      });
    } catch { continue; }
    if (!res.ok) continue;
    const body: unknown = await res.json();
    if (!Array.isArray(body)) continue;
    const candidates: string[] = [];
    for (const post of body) {
      if (!post || typeof post !== "object") continue;
      const p = post as DanbooruPost;
      if (p.rating !== "g") continue;
      const chars = typeof p.tag_string_character === "string" ? p.tag_string_character : "";
      if (!chars.includes("akiyama_mizuki")) continue;
      // Only accept truly square (1:1) images
      if (typeof p.image_width !== "number" || typeof p.image_height !== "number") continue;
      if (p.image_width !== p.image_height) continue;
      const img = safeImageUrl(p.media_asset);
      if (img) candidates.push(img);
    }
    if (candidates.length > 0) return candidates[randomInt(candidates.length)];
  }
  throw new Error("No Mizuki image found");
}

async function proxyImage(imageUrl: string): Promise<Response> {
  let parsed: URL;
  try { parsed = new URL(imageUrl); } catch { return new Response("Bad URL", { status: 400 }); }
  if (parsed.origin !== "https://cdn.donmai.us" || !parsed.pathname.startsWith("/360x360/")) {
    return new Response("Not allowed", { status: 403 });
  }
  try {
    const up = await fetch(imageUrl, {
      headers: { "User-Agent": DANBOORU_USER_AGENT, "Accept": "image/*" },
      signal: AbortSignal.timeout(10000),
    });
    if (!up.ok || !up.body) return new Response("Unavailable", { status: 502 });
    return new Response(up.body, {
      status: 200,
      headers: {
        "Content-Type": up.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch { return new Response("Unavailable", { status: 502 }); }
}

function parseChallenge(v: unknown): { challenge_id: string; expires_at: string } | null {
  const c = Array.isArray(v) ? v[0] : v;
  if (!c || typeof c !== "object") return null;
  const r = c as Record<string, unknown>;
  if (typeof r.challenge_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.challenge_id) ||
    typeof r.expires_at !== "string" || !Number.isFinite(Date.parse(r.expires_at))) return null;
  return { challenge_id: r.challenge_id, expires_at: r.expires_at };
}

function randomPieceCoordinate(): { x: number; y: number } {
  return {
    x: BOARD_PADDING + randomInt(MAX_PIECE_COORD - BOARD_PADDING + 1),
    y: BOARD_PADDING + randomInt(MAX_PIECE_COORD - BOARD_PADDING + 1),
  };
}

function pieceDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeDistinctPieceCoordinates(): Array<{ x: number; y: number }> {
  const coordinates: Array<{ x: number; y: number }> = [];
  for (let attempts = 0; coordinates.length < 3 && attempts < 200; attempts++) {
    const candidate = randomPieceCoordinate();
    if (coordinates.every((existing) => pieceDistance(existing, candidate) >= PIECE_SIZE * 1.15)) {
      coordinates.push(candidate);
    }
  }
  if (coordinates.length !== 3) {
    return [
      { x: BOARD_PADDING, y: BOARD_PADDING },
      { x: MAX_PIECE_COORD, y: BOARD_PADDING },
      { x: Math.round((DISPLAY_SIZE - PIECE_SIZE) / 2), y: MAX_PIECE_COORD },
    ];
  }
  return coordinates;
}

function makeTokenBundle(): string[] {
  return [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const requestOrigin = request.headers.get("origin");
  const origin = allowedOrigin(request);
  if (requestOrigin && !origin) return json({ error: "Request not allowed" }, 403, null);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

  // Image proxy mode
  const imageUrlParam = url.searchParams.get("image_url");
  if (imageUrlParam && request.method === "GET") return proxyImage(imageUrlParam);

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors(origin), "Allow": "POST, GET, OPTIONS", "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing config" }, 500, origin);

  try {
    const imageUrl = await fetchMizukiImage();
    const [target, decoyA, decoyB] = makeDistinctPieceCoordinates();
    const proxyBase = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/guestbook-captcha`;
    const proxyUrl = `${proxyBase}?image_url=${encodeURIComponent(imageUrl)}`;

    // The database requires exactly three expected tokens. Each visible piece
    // receives an opaque bundle of three; only the matching crop gets this one.
    const expectedTokens = makeTokenBundle();
    const pieces = shuffle([
      { source_x: target.x, source_y: target.y, tokens: expectedTokens },
      { source_x: decoyA.x, source_y: decoyA.y, tokens: makeTokenBundle() },
      { source_x: decoyB.x, source_y: decoyB.y, tokens: makeTokenBundle() },
    ]).map((piece, index) => ({ id: `piece-${index + 1}`, ...piece }));

    const rpcResponse = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/create_guestbook_captcha_challenge`,
      {
        method: "POST",
        headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_expected_tokens: expectedTokens }),
      },
    );
    if (!rpcResponse.ok) return json({ error: "RPC failed" }, 500, origin);

    const challenge = parseChallenge(await rpcResponse.json());
    if (!challenge) return json({ error: "Invalid challenge" }, 500, origin);

    return json({
      challenge_id: challenge.challenge_id,
      expires_at: challenge.expires_at,
      image_url: proxyUrl,
      display_width: DISPLAY_SIZE,
      display_height: DISPLAY_SIZE,
      piece_size: PIECE_SIZE,
      target_x: target.x,
      target_y: target.y,
      pieces,
    }, 200, origin);
  } catch (e) {
    console.error("[captcha] error:", String(e));
    return json({ error: "Server error" }, 500, origin);
  }
});
