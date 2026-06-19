import { createClient } from "jsr:@supabase/supabase-js@2";

const LOPEC_BASE = "https://lopec.kr/character/specPoint";
const LOSTARK_API_BASE = "https://developer-lostark.game.onstove.com";
const REQUEST_DELAY_MS = 300;

interface CharacterRow {
  id: string;
  character_name: string;
  user_id: string;
}

interface SpecResult {
  item_level: number | null;
  spec_score: number | null;
  tier: string | null;
  class_name: string | null;
  source: "lopec" | "official";
  source_url: string;
  fetch_error: string | null;
}

// GroupProfile_specLevel 클래스 패턴으로 값 추출 (해시 변경 내성)
function parseLopecHtml(html: string): Omit<SpecResult, "source" | "source_url" | "fetch_error"> | null {
  // specLevel 값 전체 추출 (순서: 아이템레벨, 로펙점수, 티어)
  const specLevelPattern = /class="GroupProfile_specLevel__\w+">([^<]+)/g;
  const specLevels: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = specLevelPattern.exec(html)) !== null) {
    specLevels.push(m[1].trim());
  }

  if (specLevels.length < 2) return null;

  const item_level = parseFloat(specLevels[0].replace(/,/g, "")) || null;
  const spec_score = parseFloat(specLevels[1].replace(/,/g, "")) || null;

  // 티어: /image/tier/{name}.png URL에서 추출
  const tierMatch = html.match(/\/image\/tier\/([^.]+)\.png/);
  const tier = tierMatch ? tierMatch[1] : null;

  // 직업명: GroupProfile_title 클래스에서 추출 (비어있을 수 있으므로 공식 API 보완)
  const titleMatch = html.match(/class="GroupProfile_title__\w+">([^<]+)</);
  const class_name = titleMatch ? titleMatch[1].trim() || null : null;

  return { item_level, spec_score, tier, class_name };
}

async function fetchLopec(characterName: string): Promise<SpecResult> {
  const url = `${LOPEC_BASE}/${encodeURIComponent(characterName)}`;
  try {
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

    const html = await res.text();

    // 캐릭터 없음 (404 페이지 내 메시지)
    if (html.includes("찾지 못했습니다") || html.includes("캐릭터를 찾을 수 없")) {
      throw new Error("lopec: 캐릭터를 찾을 수 없습니다");
    }

    const parsed = parseLopecHtml(html);
    if (!parsed || parsed.item_level === null) {
      throw new Error("lopec: 스펙 데이터 파싱 실패");
    }

    return {
      ...parsed,
      source: "lopec",
      source_url: url,
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
      ? parseFloat(String(data.ItemAvgLevel).replace(/,/g, ""))
      : null;
    const class_name = data?.CharacterClassName || null;

    return {
      item_level,
      spec_score: null,
      tier: null,
      class_name,
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
  } catch {
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
