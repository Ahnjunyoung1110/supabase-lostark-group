import { createClient } from "jsr:@supabase/supabase-js@2";

const LOPEC_SPEC_BASE = "https://lopec.kr/character/specPoint";
const LOPEC_EFFICIENCY_BASE = "https://lopec.kr/character/efficiency";
const LOSTARK_API_BASE = "https://developer-lostark.game.onstove.com";
const REQUEST_DELAY_MS = 300;

interface CharacterRow {
  id: string;
  character_name: string;
  user_id: string;
}

interface EfficiencyStats {
  cards: Record<string, number>;
  gemEffects: Record<string, { level: number | null; pct: number | null }>;
  gemEfficiencyBreakdown?: {
    efficiency: number;
    optionEfficiency?: number | null;
    pointEfficiency?: number | null;
  };
}

interface SpecResult {
  item_level: number | null;
  spec_score: number | null;
  tier: string | null;
  class_name: string | null;
  gem_efficiency_percent: number | null;
  bracelet_efficiency_percent: number | null;
  engraving_efficiency_percent: number | null;
  main_node_efficiency_percent: number | null;
  efficiency_stats: EfficiencyStats | null;
  source: "lopec" | "official";
  source_url: string;
  fetch_error: string | null;
}

type ParsedSpec = Omit<
  SpecResult,
  | "source"
  | "source_url"
  | "fetch_error"
  | "gem_efficiency_percent"
  | "bracelet_efficiency_percent"
  | "engraving_efficiency_percent"
  | "main_node_efficiency_percent"
  | "efficiency_stats"
>;

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function pickCardValue(cards: Record<string, number>, patterns: RegExp[]): number | null {
  const entry = Object.entries(cards).find(([label]) =>
    patterns.some((pattern) => pattern.test(label))
  );
  return entry?.[1] ?? null;
}

// GroupProfile_specLevel 클래스 패턴으로 값 추출 (해시 변경 내성)
function parseLopecSpecHtml(html: string): ParsedSpec | null {
  // specLevel 값 전체 추출 (순서: 아이템레벨, 로펙점수, 티어)
  const specLevelPattern = /class="GroupProfile_specLevel__\w+">([^<]+)/g;
  const specLevels: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = specLevelPattern.exec(html)) !== null) {
    specLevels.push(m[1].trim());
  }

  if (specLevels.length < 2) return null;

  const item_level = parseNumber(specLevels[0]);
  const spec_score = parseNumber(specLevels[1]);

  // 티어: /image/tier/{name}.png URL에서 추출
  const tierMatch = html.match(/\/image\/tier\/([^.]+)\.png/);
  const tier = tierMatch ? tierMatch[1] : null;

  // 직업명: GroupProfile_title 클래스에서 추출 (비어있을 수 있으므로 공식 API 보완)
  const titleMatch = html.match(/class="GroupProfile_title__\w+">([^<]+)</);
  const class_name = titleMatch ? titleMatch[1].trim() || null : null;

  return { item_level, spec_score, tier, class_name };
}

function parseGemEffectsFromSpecHtml(html: string): EfficiencyStats["gemEffects"] {
  const gemEffects: EfficiencyStats["gemEffects"] = {};
  const gemAreaMatch = html.match(/aria-label="젬 옵션"[\s\S]{0,20000}/);
  const gemArea = gemAreaMatch?.[0] ?? "";
  const gemPattern = /<div[^>]*class="[^"]*ArkgridData_topGemEffect__\w+[^"]*"[^>]*>[\s\S]*?class="[^"]*DetailSpec_name__\w+[^"]*"[^>]*>(.*?)<\/[^>]+>[\s\S]{0,500}?class="[^"]*DetailSpec_value__\w+[^"]*"[^>]*>(.*?)<\/[^>]+>[\s\S]*?<\/div>/g;
  let gemMatch: RegExpExecArray | null;
  while ((gemMatch = gemPattern.exec(gemArea)) !== null) {
    const name = stripTags(gemMatch[1]);
    const rawValue = stripTags(gemMatch[2]);
    if (!name || name === "젬") continue;
    gemEffects[name] = {
      level: parseNumber(name.match(/Lv\.?\s*\d+/i)?.[0] ?? null),
      pct: parseNumber(rawValue.includes("%") ? rawValue : null),
    };
  }
  return gemEffects;
}

function parseEfficiencyHtml(html: string): EfficiencyStats | null {
  const cards: Record<string, number> = {};
  const cardPattern = /<div[^>]*class="[^"]*EffGroupDashboard_defaultCardtitle__\w+[^"]*"[^>]*>\s*<h3[^>]*>(.*?)<\/h3>[\s\S]*?<span[^>]*class="[^"]*EffGroupDashboard_cardValue__\w+[^"]*"[^>]*>(.*?)<\/span>/g;
  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const label = stripTags(cardMatch[1]);
    const value = parseNumber(stripTags(cardMatch[2]));
    if (label && value !== null) cards[label] = value;
  }

  if (Object.keys(cards).length === 0) {
    return null;
  }

  return { cards, gemEffects: {} };
}

type LopecWebpackModule = (module: { exports: Record<string, unknown> }, exports: Record<string, unknown>, require: LopecRequire) => void;
type LopecRequire = ((id: number | string) => Record<string, unknown>) & {
  d: (exports: Record<string, unknown>, definition: Record<string, () => unknown>) => void;
  r: (exports: Record<string, unknown>) => void;
  n: (module: Record<string, unknown>) => (() => unknown) & { a?: () => unknown };
  o: (obj: Record<string, unknown>, prop: string) => boolean;
  O: (...args: unknown[]) => unknown;
};

type LopecParser = {
  profile?: { supportCheck?: boolean };
};

const lopecChunkCache = new Map<string, string>();

function extractFlightPayload(html: string): string {
  const scriptPattern = /<script>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g;
  const payloads: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as [number, string];
      if (typeof parsed[1] === "string") payloads.push(parsed[1]);
    } catch {
      // Ignore non-flight scripts. Older server-rendered values still cover the fallback path.
    }
  }
  return payloads.join("\n");
}

function extractJsonObject(source: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function extractLopecParser(html: string): LopecParser | null {
  const flight = extractFlightPayload(html);
  const keyIndex = flight.indexOf('"lostarkParser":');
  if (keyIndex < 0) return null;
  const start = flight.indexOf("{", keyIndex);
  if (start < 0) return null;
  const json = extractJsonObject(flight, start);
  if (!json) return null;
  try {
    return JSON.parse(json) as LopecParser;
  } catch {
    return null;
  }
}

function createLopecRequire(modules: Record<string, LopecWebpackModule>): LopecRequire {
  const cache: Record<string, { exports: Record<string, unknown> }> = {};
  const require = ((id: number | string) => {
    const key = String(id);
    if (cache[key]) return cache[key].exports;
    const moduleFn = modules[key];
    if (!moduleFn) throw new Error(`lopec module ${key} not found`);
    const webpackModule = { exports: {} as Record<string, unknown> };
    cache[key] = webpackModule;
    moduleFn(webpackModule, webpackModule.exports, require);
    return webpackModule.exports;
  }) as LopecRequire;
  require.d = (exports, definition) => {
    for (const key of Object.keys(definition)) {
      Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
    }
  };
  require.r = (exports) => {
    Object.defineProperty(exports, "__esModule", { value: true });
  };
  require.n = (module) => {
    const getter = module && module.__esModule ? () => module.default : () => module;
    (getter as (() => unknown) & { a?: () => unknown }).a = getter;
    return getter as (() => unknown) & { a?: () => unknown };
  };
  require.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
  require.O = (...args: unknown[]) => {
    const maybeCallback = args[args.length - 1];
    return typeof maybeCallback === "function" ? (maybeCallback as () => unknown)() : undefined;
  };
  return require;
}

async function fetchCachedText(url: string): Promise<string> {
  const cached = lopecChunkCache.get(url);
  if (cached) return cached;
  const text = await fetchHtml(url);
  lopecChunkCache.set(url, text);
  return text;
}

async function computeLopecGemEfficiency(html: string, pageUrl: string): Promise<EfficiencyStats["gemEfficiencyBreakdown"] | null> {
  const parser = extractLopecParser(html);
  if (!parser) return null;

  const modules: Record<string, LopecWebpackModule> = {};
  const globals = globalThis as {
    self?: unknown;
    webpackChunk_N_E?: unknown;
    window?: unknown;
    document?: unknown;
    location?: unknown;
  };
  const previousSelf = globals.self;
  const previousWebpackChunk = globals.webpackChunk_N_E;
  const previousWindow = globals.window;
  const previousDocument = globals.document;
  const previousLocation = globals.location;
  globals.self = globalThis;
  const webpackChunks = [] as unknown[] & {
    push: (chunk: [unknown, Record<string, LopecWebpackModule>]) => number;
  };
  webpackChunks.push = (chunk: [unknown, Record<string, LopecWebpackModule>]) => {
    Object.assign(modules, chunk[1]);
    return 0;
  };
  globals.webpackChunk_N_E = webpackChunks;
  globals.window = globalThis;
  globals.document = globals.document ?? {};
  globals.location = globals.location ?? new URL(pageUrl);

  try {
    const scriptUrls = Array.from(html.matchAll(/<script[^>]+src="([^"]+\.js)"/g))
      .map((match) => new URL(decodeHtml(match[1]), pageUrl).href);
    for (const scriptUrl of scriptUrls) {
      const chunk = await fetchCachedText(scriptUrl);
      // lopec computes the rendered gem efficiency in client chunks. We evaluate only the module
      // registry wrapper and intentionally ignore Next.js entry callbacks in createLopecRequire().
      new Function(chunk)();
    }

    const require = createLopecRequire(modules);
    const calculatorModule = parser.profile?.supportCheck ? require(38564) : require(32142);
    const calculator = parser.profile?.supportCheck ? calculatorModule.m9 : calculatorModule.cA;
    if (typeof calculator !== "function") return null;
    const result = calculator(parser) as {
      efficiency?: number | null;
      optionEfficiency?: number | null;
      pointEfficiency?: number | null;
    };
    return typeof result.efficiency === "number"
      ? {
          efficiency: result.efficiency,
          optionEfficiency: result.optionEfficiency ?? null,
          pointEfficiency: result.pointEfficiency ?? null,
        }
      : null;
  } catch (err) {
    console.error("[update-character-specs] gem 효율 계산 실패:", err);
    return null;
  } finally {
    globals.self = previousSelf;
    globals.webpackChunk_N_E = previousWebpackChunk;
    globals.window = previousWindow;
    globals.document = previousDocument;
    globals.location = previousLocation;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`lopec HTTP ${res.status}`);
  }

  return await res.text();
}

async function fetchLopec(characterName: string): Promise<SpecResult> {
  const specUrl = `${LOPEC_SPEC_BASE}/${encodeURIComponent(characterName)}`;
  const efficiencyUrl = `${LOPEC_EFFICIENCY_BASE}/${encodeURIComponent(characterName)}`;
  try {
    const html = await fetchHtml(specUrl);

    // 캐릭터 없음 (404 페이지 내 메시지)
    if (html.includes("찾지 못했습니다") || html.includes("캐릭터를 찾을 수 없")) {
      throw new Error("lopec: 캐릭터를 찾을 수 없습니다");
    }

    const parsed = parseLopecSpecHtml(html);
    if (!parsed || parsed.item_level === null) {
      throw new Error("lopec: 스펙 데이터 파싱 실패");
    }

    const specGemEffects = parseGemEffectsFromSpecHtml(html);
    const computedGemEfficiency = await computeLopecGemEfficiency(html, specUrl);
    let efficiencyStats: EfficiencyStats | null = null;
    try {
      await sleep(REQUEST_DELAY_MS);
      efficiencyStats = parseEfficiencyHtml(await fetchHtml(efficiencyUrl));
    } catch (err) {
      // 효율 페이지는 보조 데이터이므로 실패해도 기본 스펙 갱신은 유지한다.
      console.error("[update-character-specs] 효율 페이지 파싱 실패:", err);
      efficiencyStats = null;
    }

    const cards = efficiencyStats?.cards ?? {};
    const gemEffects = {
      ...(efficiencyStats?.gemEffects ?? {}),
      ...specGemEffects,
    };
    const gemEffectValues = Object.values(gemEffects)
      .map((effect) => effect.pct)
      .filter((pct): pct is number => pct !== null);
    const fallbackGemEfficiency = gemEffectValues.length > 0
      ? Number(gemEffectValues.reduce((sum, pct) => sum + pct, 0).toFixed(2))
      : null;
    const gem_efficiency_percent = computedGemEfficiency?.efficiency
      ?? pickCardValue(cards, [
        /젬.*효율/,
        /보석.*효율/,
        /겁화.*효율/,
        /작열.*효율/,
      ])
      ?? fallbackGemEfficiency;
    const bracelet_efficiency_percent = pickCardValue(cards, [/팔찌.*효율/]);
    const engraving_efficiency_percent = pickCardValue(cards, [/각인.*효율/]);
    const main_node_efficiency_percent = pickCardValue(cards, [/메인\s*노드.*효율/, /메인노드.*효율/]);
    const mergedEfficiencyStats = Object.keys(cards).length > 0 || Object.keys(gemEffects).length > 0 || computedGemEfficiency
      ? { cards, gemEffects, ...(computedGemEfficiency ? { gemEfficiencyBreakdown: computedGemEfficiency } : {}) }
      : null;

    return {
      ...parsed,
      gem_efficiency_percent,
      bracelet_efficiency_percent,
      engraving_efficiency_percent,
      main_node_efficiency_percent,
      efficiency_stats: mergedEfficiencyStats,
      source: "lopec",
      source_url: specUrl,
      fetch_error: null,
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

async function fetchOfficialApi(characterName: string, apiKey: string): Promise<SpecResult> {
  const url = `${LOSTARK_API_BASE}/armories/characters/${encodeURIComponent(characterName)}/profiles`;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`공식 API HTTP ${res.status}`);
    }

    const data = await res.json();
    const item_level = data?.ItemAvgLevel
      ? parseNumber(String(data.ItemAvgLevel))
      : null;
    const class_name = data?.CharacterClassName || null;

    return {
      item_level,
      spec_score: null,
      tier: null,
      class_name,
      gem_efficiency_percent: null,
      bracelet_efficiency_percent: null,
      engraving_efficiency_percent: null,
      main_node_efficiency_percent: null,
      efficiency_stats: null,
      source: "official",
      source_url: url,
      fetch_error: "lopec 파싱 실패 — 공식 API 폴백",
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lostarkApiKey = Deno.env.get("LOSTARK_API_KEY") ?? "";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let ids: string[] | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    ids = Array.isArray(body?.ids) ? body.ids : undefined;
  } catch (err) {
    console.error("[update-character-specs] 요청 body 파싱 실패:", err);
    ids = undefined;
  }

  // 대상 캐릭터 조회
  let query = supabase.from("characters").select("id, character_name, user_id");
  if (ids && ids.length > 0) {
    // ids 검증: 실제 존재하는 uuid인지 확인
    const { data: validRows, error: validErr } = await supabase
      .from("characters")
      .select("id")
      .in("id", ids);
    if (validErr) {
      return new Response(JSON.stringify({ error: validErr.message }), { status: 500 });
    }
    const validIds = (validRows ?? []).map((r: { id: string }) => r.id);
    query = query.in("id", validIds);
  }

  const { data: characters, error: fetchErr } = await query;
  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  const results: Array<{ id: string; character_name: string; status: string; error?: string }> = [];

  for (const char of (characters as CharacterRow[])) {
    await sleep(REQUEST_DELAY_MS);

    let specResult: SpecResult;

    try {
      specResult = await fetchLopec(char.character_name);
    } catch (lopecErr) {
      // lopec 실패 → 공식 API 폴백
      const lopecErrMsg = lopecErr instanceof Error ? lopecErr.message : String(lopecErr);
      if (lostarkApiKey) {
        try {
          specResult = await fetchOfficialApi(char.character_name, lostarkApiKey);
          specResult.fetch_error = `lopec 실패(${lopecErrMsg}) — 공식 API 폴백`;
        } catch (officialErr) {
          const officialErrMsg = officialErr instanceof Error ? officialErr.message : String(officialErr);
          // 둘 다 실패: fetch_error만 업데이트, 기존 데이터 유지
          await supabase
            .from("characters")
            .update({
              fetch_error: `lopec: ${lopecErrMsg} / 공식API: ${officialErrMsg}`,
              last_fetched_at: new Date().toISOString(),
            })
            .eq("id", char.id);

          results.push({ id: char.id, character_name: char.character_name, status: "error", error: officialErrMsg });
          continue;
        }
      } else {
        // 공식 API 키 없음: fetch_error만 기록
        await supabase
          .from("characters")
          .update({
            fetch_error: lopecErrMsg,
            last_fetched_at: new Date().toISOString(),
          })
          .eq("id", char.id);

        results.push({ id: char.id, character_name: char.character_name, status: "error", error: lopecErrMsg });
        continue;
      }
    }

    // 성공 upsert
    const { error: upsertErr } = await supabase
      .from("characters")
      .update({
        class_name: specResult.class_name,
        item_level: specResult.item_level,
        spec_score: specResult.spec_score,
        tier: specResult.tier,
        gem_efficiency_percent: specResult.gem_efficiency_percent,
        bracelet_efficiency_percent: specResult.bracelet_efficiency_percent,
        engraving_efficiency_percent: specResult.engraving_efficiency_percent,
        main_node_efficiency_percent: specResult.main_node_efficiency_percent,
        efficiency_stats: specResult.efficiency_stats,
        source: specResult.source,
        source_url: specResult.source_url,
        last_fetched_at: new Date().toISOString(),
        fetch_error: specResult.fetch_error,
      })
      .eq("id", char.id);

    if (upsertErr) {
      results.push({ id: char.id, character_name: char.character_name, status: "error", error: upsertErr.message });
    } else {
      results.push({ id: char.id, character_name: char.character_name, status: "ok" });
    }
  }

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    error: results.filter((r) => r.status === "error").length,
    results,
  };

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
