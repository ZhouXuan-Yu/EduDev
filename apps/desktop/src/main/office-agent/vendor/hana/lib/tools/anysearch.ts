// @ts-nocheck
// Vendored from HanaAgent 0.449.0, Apache-2.0. See third_party/openhanako/LICENSE.
// Upstream implicit types retained; local adapters remain strictly typed.
import { SearchRateLimitError, retryAfterMsFromHeaders } from './search-rate-limiter';
const ANYSEARCH_SEARCH_URL = 'https://api.anysearch.com/v1/search';
const getLocale = () => 'zh-CN';
const maxResultsForProvider = (_provider, value) => clampResultsToRange(value, { defaultValue: 10, max: 10 });
async function safeParseResponse(response, fallback) { try { return await response.json(); } catch { return fallback; } }
function throwIfRateLimited(res, label) {
  if (res.status !== 429 && res.status !== 402) return;
  throw new SearchRateLimitError(`${label} API ${res.status}`, {
    status: res.status,
    retryAfterMs: retryAfterMsFromHeaders(res.headers),
  });
}

function throwIfHttpError(res, label, data) {
  if (res.ok) return;
  const message = typeof data?.error === "string"
    ? data.error
    : typeof data?.message === "string"
      ? data.message
      : "";
  throw new Error(`${label} API ${res.status}${message ? `: ${message}` : ""}`);
}

function clampResultsToRange(maxResults, { defaultValue, max, min = 1 }) {
  const value = Number(maxResults);
  if (!Number.isFinite(value)) return defaultValue;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function anySearchLanguage(locale) {
  const normalized = String(locale || "").toLowerCase();
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("ko")) return "ko";
  return "en";
}

function anySearchResultsFrom(data) {
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function anySearchMetadataFrom(data) {
  return data?.data?.metadata || data?.metadata || {};
}

function throwIfAnySearchEnvelopeError(data) {
  if (!data || typeof data !== "object") return;
  if (data.code === undefined || data.code === 0) return;
  const message = typeof data.message === "string" && data.message.trim()
    ? data.message.trim()
    : `code ${data.code}`;
  throw new Error(`AnySearch API ${message}`);
}

export async function searchAnySearch(query, maxResults, apiKey, provider, { fetchImpl, signal }) {
  const resultLimit = maxResultsForProvider(provider, maxResults);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const res = await fetchImpl(ANYSEARCH_SEARCH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      max_results: resultLimit,
      language: anySearchLanguage(getLocale()),
    }),
    signal: signal,
  });

  throwIfRateLimited(res, "AnySearch");
  const data = await safeParseResponse(res, null);
  throwIfHttpError(res, "AnySearch", data);
  if (!data) throw new Error(`AnySearch API ${res.status}`);
  throwIfAnySearchEnvelopeError(data);

  const metadata = anySearchMetadataFrom(data);
  return {
    query,
    provider,
    source_type: "api",
    results: anySearchResultsFrom(data).slice(0, resultLimit).map((r, index) => ({
      title: r.title || "",
      url: r.url || "",
      content: r.content || r.description || r.snippet || "",
      rank: r.rank ?? index + 1,
      score: r.score ?? r.quality_score ?? null,
      metadata: {
        description: r.description || "",
        quality_score: r.quality_score ?? null,
        signal_scores: r.signal_scores || {},
        source: r.source || "",
        published_at: r.published_at || null,
      },
    })),
    diagnostics: {
      anonymous: !apiKey,
      total_results: metadata.total_results ?? null,
      search_time_ms: metadata.search_time_ms ?? null,
      request_id: metadata.request_id || "",
      cached: metadata.cached ?? null,
    },
  };
}
