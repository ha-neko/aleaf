const PRODUCTION_ORIGIN = "https://aleaf.is-a.dev";
const DANBOORU_API = "https://danbooru.donmai.us/posts.json";
const DANBOORU_USER_AGENT = "aleaf.is-a.dev guestbook-captcha/1.0";
const POSTS_PER_PAGE = 100;
const RECENT_PAGE_COUNT = 8;
const MAX_PAGE_ATTEMPTS = 4;

const STATIC_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const BLOCKED_TAGS = new Set([
  "anus",
  "ass",
  "ass_focus",
  "bare_breasts",
  "bikini",
  "bikini_bottom",
  "bikini_top",
  "bottomless",
  "bra",
  "breast_focus",
  "breasts",
  "cameltoe",
  "cleavage",
  "clothes_lift",
  "completely_nude",
  "covered_nipples",
  "erection",
  "groin",
  "groin_tendon",
  "lingerie",
  "micro_bikini",
  "midriff",
  "naked",
  "naked_apron",
  "naked_shirt",
  "navel",
  "nipples",
  "no_bra",
  "nude",
  "open_clothes",
  "panties",
  "pantyshot",
  "penis",
  "pubic_hair",
  "pussy",
  "see-through",
  "see-through_clothes",
  "sex",
  "sexually_suggestive",
  "shirt_lift",
  "sideboob",
  "skirt_lift",
  "swimsuit",
  "thong",
  "topless",
  "underboob",
  "underwear",
  "underwear_only",
  "unbuttoned_clothes",
  "upskirt",
  "wet_clothes",
]);
const BLOCKED_TAG_PARTS = [
  "bikini",
  "breast",
  "cameltoe",
  "cleavage",
  "lingerie",
  "nipple",
  "nude",
  "panties",
  "see-through",
  "swimsuit",
  "underwear",
];

type DanbooruVariant = {
  type?: unknown;
  url?: unknown;
  file_ext?: unknown;
};

type DanbooruPost = {
  id?: unknown;
  rating?: unknown;
  tag_string?: unknown;
  tag_string_general?: unknown;
  tag_string_character?: unknown;
  media_asset?: {
    file_ext?: unknown;
    variants?: unknown;
  } | null;
};

type Candidate = {
  id: number;
  imageUrl: string;
};

class SourceError extends Error {}

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
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function randomInt(maxExclusive: number): number {
  const maximum = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value); while (value[0] >= maximum);
  return value[0] % maxExclusive;
}

function shuffle<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function tagSet(value: unknown): Set<string> | null {
  if (typeof value !== "string") return null;
  return new Set(value.split(/\s+/).filter(Boolean));
}

function containsBlockedTag(tags: Set<string>): boolean {
  for (const tag of tags) {
    if (BLOCKED_TAGS.has(tag) || BLOCKED_TAG_PARTS.some((part) => tag.includes(part))) return true;
  }
  return false;
}

function safeImageUrl(mediaAsset: DanbooruPost["media_asset"]): string | null {
  if (!mediaAsset || typeof mediaAsset.file_ext !== "string" ||
    !STATIC_IMAGE_EXTENSIONS.has(mediaAsset.file_ext.toLowerCase()) ||
    !Array.isArray(mediaAsset.variants)) {
    return null;
  }

  const variants = mediaAsset.variants as DanbooruVariant[];
  for (const desiredType of ["360x360", "sample"]) {
    const variant = variants.find((item) => item?.type === desiredType);
    if (!variant || typeof variant.url !== "string" || typeof variant.file_ext !== "string" ||
      !STATIC_IMAGE_EXTENSIONS.has(variant.file_ext.toLowerCase())) continue;

    try {
      const url = new URL(variant.url);
      const expectedPrefix = desiredType === "360x360" ? "/360x360/" : "/sample/";
      if (url.origin === "https://cdn.donmai.us" && url.pathname.startsWith(expectedPrefix) &&
        !url.username && !url.password && !url.search && !url.hash) {
        return url.href;
      }
    } catch {
      // Ignore malformed upstream variant URLs.
    }
  }

  return null;
}

function candidateFromPost(post: DanbooruPost, isMizuki: boolean): Candidate | null {
  if (!Number.isSafeInteger(post.id) || (post.id as number) <= 0 || post.rating !== "g") return null;

  const allTags = tagSet(post.tag_string);
  const generalTags = tagSet(post.tag_string_general);
  const characterTags = tagSet(post.tag_string_character);
  if (!allTags || !generalTags || !characterTags || !generalTags.has("solo") || containsBlockedTag(allTags)) {
    return null;
  }

  const hasMizuki = characterTags.has("akiyama_mizuki");
  if (hasMizuki !== isMizuki) return null;
  if (!isMizuki && (!generalTags.has("pink_hair") || !generalTags.has("pink_eyes"))) return null;

  const imageUrl = safeImageUrl(post.media_asset);
  return imageUrl ? { id: post.id as number, imageUrl } : null;
}

async function fetchPage(tags: string, page: number): Promise<DanbooruPost[]> {
  const url = new URL(DANBOORU_API);
  url.searchParams.set("tags", tags);
  url.searchParams.set("limit", String(POSTS_PER_PAGE));
  url.searchParams.set("page", String(page));
  url.searchParams.set(
    "only",
    "id,rating,tag_string,tag_string_general,tag_string_character,media_asset",
  );

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": DANBOORU_USER_AGENT,
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new SourceError();
  }

  if (!response.ok) throw new SourceError();

  try {
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every((item) => item !== null && typeof item === "object")) {
      throw new SourceError();
    }
    return body as DanbooruPost[];
  } catch {
    throw new SourceError();
  }
}

async function collectCandidates(isMizuki: boolean, count: number): Promise<Candidate[]> {
  const tags = isMizuki
    ? "akiyama_mizuki solo rating:general"
    : "pink_hair pink_eyes rating:general";
  const pages = shuffle(Array.from({ length: RECENT_PAGE_COUNT }, (_, index) => index + 1));
  const candidates = new Map<number, Candidate>();
  const urls = new Set<string>();

  for (const page of pages.slice(0, MAX_PAGE_ATTEMPTS)) {
    const posts = await fetchPage(tags, page);
    for (const post of posts) {
      const candidate = candidateFromPost(post, isMizuki);
      if (!candidate || candidates.has(candidate.id) || urls.has(candidate.imageUrl)) continue;
      candidates.set(candidate.id, candidate);
      urls.add(candidate.imageUrl);
    }
    if (candidates.size >= count) break;
  }

  if (candidates.size < count) throw new SourceError();
  return shuffle([...candidates.values()]).slice(0, count);
}

function parseChallenge(value: unknown): { challenge_id: string; expires_at: string } | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const record = candidate as Record<string, unknown>;
  if (typeof record.challenge_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.challenge_id) ||
    typeof record.expires_at !== "string" || !Number.isFinite(Date.parse(record.expires_at))) {
    return null;
  }

  return { challenge_id: record.challenge_id, expires_at: record.expires_at };
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Unable to generate challenge" }, 500, origin);
  }

  try {
    const [mizukiPosts, distractorPosts] = await Promise.all([
      collectCandidates(true, 3),
      collectCandidates(false, 6),
    ]);
    const usedPostIds = new Set<number>();
    const mizukiTokens: string[] = [];
    const choices = shuffle([...mizukiPosts, ...distractorPosts].map((post, index) => {
      if (usedPostIds.has(post.id)) throw new SourceError();
      usedPostIds.add(post.id);

      const token = crypto.randomUUID();
      if (index < mizukiPosts.length) mizukiTokens.push(token);
      return { token, image_url: post.imageUrl };
    }));

    const rpcResponse = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/create_guestbook_captcha_challenge`,
      {
        method: "POST",
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_expected_tokens: mizukiTokens }),
      },
    );
    if (!rpcResponse.ok) {
      return jsonResponse({ error: "Unable to generate challenge" }, 500, origin);
    }

    let challenge: { challenge_id: string; expires_at: string } | null = null;
    try {
      challenge = parseChallenge(await rpcResponse.json());
    } catch {
      // Treat malformed database responses as an internal failure.
    }
    if (!challenge) return jsonResponse({ error: "Unable to generate challenge" }, 500, origin);

    return jsonResponse({ ...challenge, choices }, 200, origin);
  } catch (error) {
    const status = error instanceof SourceError ? 503 : 500;
    return jsonResponse({ error: "Unable to generate challenge" }, status, origin);
  }
});
