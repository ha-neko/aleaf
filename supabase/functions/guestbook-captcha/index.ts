const PRODUCTION_ORIGIN = "https://aleaf.is-a.dev";
const DANBOORU_API = "https://danbooru.donmai.us/posts.json";
const DANBOORU_USER_AGENT = "aleaf.is-a.dev guestbook-captcha/2.0";
const POSTS_PER_PAGE = 40;

const STATIC_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const TOLERANCE = 6;
const PIECE_SIZE = 50;
const DISPLAY_WIDTH = 280;
const MIN_X = 8;
const MAX_X = DISPLAY_WIDTH - PIECE_SIZE - 8;

type DanbooruVariant = { type?: unknown; url?: unknown; file_ext?: unknown };
type DanbooruPost = {
  id?: unknown; rating?: unknown; tag_string_character?: unknown;
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
    "Vary": "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function positionToToken(pos: number): string {
  const rounded = Math.round(pos);
  const hex = Math.max(0, Math.min(999, rounded)).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

function safeImageUrl(asset: DanbooruPost["media_asset"]): string | null {
  if (!asset || typeof asset.file_ext !== "string" || !STATIC_IMAGE_EXTENSIONS.has(asset.file_ext.toLowerCase()) ||
    !Array.isArray(asset.variants)) return null;
  for (const v of asset.variants as DanbooruVariant[]) {
    if (!v || typeof v.url !== "string" || typeof v.file_ext !== "string" || !STATIC_IMAGE_EXTENSIONS.has(v.file_ext.toLowerCase())) continue;
    try {
      const u = new URL(v.url);
      if (u.origin === "https://cdn.donmai.us" &&
        (u.pathname.startsWith("/360x360/") || u.pathname.startsWith("/sample/")) &&
        !u.username && !u.password && !u.search) return u.href;
    } catch { /* skip */ }
  }
  return null;
}

async function fetchMizukiImage(): Promise<string> {
  const tags = "akiyama_mizuki solo rating:general";
  const pages = shuffle([1, 2, 3, 4, 5]);
  for (const page of pages) {
    const url = new URL(DANBOORU_API);
    url.searchParams.set("tags", tags);
    url.searchParams.set("limit", String(POSTS_PER_PAGE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("only", "id,rating,tag_string_character,media_asset");
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "Accept": "application/json", "User-Agent": DANBOORU_USER_AGENT },
        signal: AbortSignal.timeout(8000),
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
      const img = safeImageUrl(p.media_asset);
      if (img) candidates.push(img);
    }
    if (candidates.length > 0) return candidates[randomInt(candidates.length)];
  }
  throw new Error("No Mizuki image found");
}

async function proxyImage(imageUrl: string, origin: string | null): Promise<Response> {
  let parsed: URL;
  try { parsed = new URL(imageUrl); } catch { return json({ error: "Invalid URL" }, 400, origin); }
  if (parsed.origin !== "https://cdn.donmai.us" ||
    (!parsed.pathname.startsWith("/360x360/") && !parsed.pathname.startsWith("/sample/"))) {
    return json({ error: "URL not allowed" }, 403, origin);
  }
  try {
    const up = await fetch(imageUrl, {
      headers: { "User-Agent": DANBOORU_USER_AGENT, "Accept": "image/*" },
      signal: AbortSignal.timeout(10000),
    });
    if (!up.ok || !up.body) return json({ error: "Image unavailable" }, 502, origin);
    return new Response(up.body, {
      status: 200,
      headers: {
        "Content-Type": up.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch { return json({ error: "Image unavailable" }, 502, origin); }
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

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const requestOrigin = request.headers.get("origin");
  const origin = allowedOrigin(request);
  if (requestOrigin && !origin) return json({ error: "Request not allowed" }, 403, null);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

  const imageUrlParam = url.searchParams.get("image_url");
  if (imageUrlParam && request.method === "GET") return proxyImage(imageUrlParam, origin);

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors(origin), "Allow": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Unable to generate challenge" }, 500, origin);

  try {
    const imageUrl = await fetchMizukiImage();
    const targetX = MIN_X + randomInt(MAX_X - MIN_X + 1);
    const proxyBase = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/guestbook-captcha`;
    const proxyUrl = `${proxyBase}?image_url=${encodeURIComponent(imageUrl)}`;

    const expectedTokens: string[] = [];
    for (let offset = -TOLERANCE; offset <= TOLERANCE; offset++) {
      const px = targetX + offset;
      if (px >= 0 && px <= MAX_X) expectedTokens.push(positionToToken(px));
    }

    const rpcResponse = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/create_guestbook_captcha_challenge`,
      {
        method: "POST",
        headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_expected_tokens: expectedTokens }),
      },
    );
    if (!rpcResponse.ok) return json({ error: "Unable to generate challenge" }, 500, origin);

    const challenge = parseChallenge(await rpcResponse.json());
    if (!challenge) return json({ error: "Unable to generate challenge" }, 500, origin);

    return json({
      challenge_id: challenge.challenge_id,
      expires_at: challenge.expires_at,
      image_url: proxyUrl,
      display_width: DISPLAY_WIDTH,
      piece_size: PIECE_SIZE,
      target_x: targetX,
      min_x: MIN_X,
      max_x: MAX_X,
    }, 200, origin);
  } catch {
    return json({ error: "Unable to generate challenge" }, 500, origin);
  }
});
