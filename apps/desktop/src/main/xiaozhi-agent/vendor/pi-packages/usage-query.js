var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@narumitw/pi-usage/src/core.ts
function sanitizeDisplayText(value, maxChars = 160) {
  let result = "";
  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index) ?? 0;
    const character = String.fromCodePoint(codePoint);
    if (codePoint === 27 || codePoint === 155 || codePoint === 157) {
      index = skipTerminalEscape(value, index, codePoint);
      continue;
    }
    if (codePoint <= 31 || codePoint >= 127 && codePoint <= 159) {
      if (codePoint === 9 || codePoint === 10 || codePoint === 13) result += " ";
      index += character.length;
      continue;
    }
    result += character;
    index += character.length;
  }
  return truncate(result.replace(/\s+/gu, " ").trim(), maxChars);
}
function redactUsageError(value, secrets = []) {
  let redacted = value;
  for (const secret of [...new Set(secrets)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), "g"), "<redacted>");
  }
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>").replace(/"(?:access_token|refresh_token|api_key)"\s*:\s*"[^"]+"/gi, (match) => {
    const separator = match.indexOf(":");
    return `${match.slice(0, separator + 1)}"<redacted>"`;
  });
  return sanitizeDisplayText(redacted, 600);
}
function errorMessage(error) {
  return sanitizeDisplayText(error instanceof Error ? error.message : String(error), 600);
}
function skipTerminalEscape(value, start, codePoint) {
  let index = start + 1;
  const next = value.charCodeAt(index);
  const isOsc = codePoint === 157 || codePoint === 27 && next === 93;
  if (isOsc) {
    if (codePoint === 27) index += 1;
    while (index < value.length) {
      const current = value.charCodeAt(index);
      if (current === 7) return index + 1;
      if (current === 27 && value.charCodeAt(index + 1) === 92) return index + 2;
      index += 1;
    }
    return index;
  }
  const isCsi = codePoint === 155 || codePoint === 27 && next === 91;
  if (isCsi) {
    if (codePoint === 27) index += 1;
    while (index < value.length) {
      const current = value.charCodeAt(index);
      index += 1;
      if (current >= 64 && current <= 126) break;
    }
    return index;
  }
  return Math.min(value.length, start + (codePoint === 27 ? 2 : 1));
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function truncate(value, maxChars) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}\u2026`;
}
var init_core = __esm({
  "node_modules/@narumitw/pi-usage/src/core.ts"() {
  }
});

// node_modules/@narumitw/pi-usage/src/oauth-credential-source.ts
import { readStoredCredential } from "@earendil-works/pi-coding-agent";
var init_oauth_credential_source = __esm({
  "node_modules/@narumitw/pi-usage/src/oauth-credential-source.ts"() {
  }
});

// node_modules/@narumitw/pi-usage/src/providers/baseten.ts
function normalizeBasetenBillingUsagePayload(payload, capturedAt) {
  if (payload.model_apis_usage === void 0 || payload.model_apis_usage === null) {
    return report(capturedAt, [], ["Baseten returned no Model APIs usage for the last 30 days."]);
  }
  const usage = asObject(payload.model_apis_usage);
  if (!usage) throw new Error("Baseten Model APIs usage was not an object.");
  const metrics = [
    metric("gross-usage", "Gross usage", usage.total),
    metric("credits-used", "Credits used", usage.credits_used),
    metric("net-subtotal", "Net subtotal", usage.subtotal)
  ];
  return report(capturedAt, metrics);
}
function report(capturedAt, metrics, notes) {
  return {
    providerId: "baseten",
    providerName: "Baseten",
    capturedAt,
    source: "baseten-billing-usage-summary",
    semantics: { kind: "api-key", label: "Organization Model APIs spend" },
    buckets: [],
    metrics,
    ...notes ? { notes } : {}
  };
}
function metric(id, label, value) {
  const amount2 = decimalAmount(value, label);
  return { id, label, value: amount2, unit: "currency", currency: "USD" };
}
function decimalAmount(value, label) {
  const normalized = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof normalized !== "string" || normalized.length > 64 || !DECIMAL_AMOUNT.test(normalized)) {
    throw new Error(`Baseten ${label.toLowerCase()} was not a valid nonnegative amount.`);
  }
  return normalized;
}
function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
var DECIMAL_AMOUNT;
var init_baseten = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/baseten.ts"() {
    DECIMAL_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
  }
});

// node_modules/@narumitw/pi-usage/src/providers/codex.ts
function normalizeCodexBackendPayload(payload, capturedAt) {
  const buckets = [];
  normalizeRateLimitGroup(buckets, "codex", "Codex", payload.rate_limit, false);
  const additional = Array.isArray(payload.additional_rate_limits) ? payload.additional_rate_limits : [];
  for (const item of additional) {
    const value = asObject2(item);
    const id = asString(value?.metered_feature) ?? asString(value?.limit_name);
    if (!value || !id) continue;
    try {
      normalizeRateLimitGroup(buckets, id, asString(value.limit_name) ?? id, value.rate_limit, true);
    } catch {
    }
  }
  const metrics = [];
  const credits = asObject2(payload.credits);
  if (credits?.has_credits === true) {
    if (credits.unlimited === true) {
      metrics.push({ id: "credits", label: "Credits", value: "unlimited" });
    } else {
      const balance = asNumber(credits.balance);
      if (balance !== void 0) {
        metrics.push({ id: "credits", label: "Credits", value: balance, unit: "count" });
      } else {
        metrics.push({ id: "credits", label: "Credits", value: "available" });
      }
    }
  } else if (credits?.has_credits === false) {
    metrics.push({ id: "credits", label: "Credits", value: "none" });
  }
  const resetCredits = asObject2(payload.rate_limit_reset_credits);
  const resetCount = asNonnegativeInteger(resetCredits?.available_count);
  if (resetCount !== void 0) {
    metrics.push({
      id: "reset-credits",
      label: "Usage limit resets",
      value: resetCount,
      unit: "count"
    });
  }
  if (buckets.length === 0 && metrics.length === 0) {
    throw new Error("Codex usage endpoint returned no displayable usage data.");
  }
  const planType = asString(payload.plan_type);
  return {
    providerId: "openai-codex",
    providerName: "OpenAI Codex",
    capturedAt,
    source: "codex-pi-auth",
    semantics: {
      kind: "consumer-subscription",
      label: "ChatGPT subscription limits"
    },
    buckets,
    metrics,
    ...planType ? { notes: [`Plan: ${planType}`] } : {}
  };
}
function normalizeRateLimitGroup(buckets, groupId, groupLabel, raw, optional) {
  if (raw === void 0 || raw === null) return;
  const details = asObject2(raw);
  if (!details) {
    if (optional) return;
    throw new Error("Codex rate limit was not an object.");
  }
  addWindow(buckets, groupId, groupLabel, "primary", details.primary_window);
  addWindow(buckets, groupId, groupLabel, "secondary", details.secondary_window);
}
function addWindow(buckets, groupId, groupLabel, position, raw) {
  if (raw === void 0 || raw === null) return;
  const value = asObject2(raw);
  if (!value) throw new Error("Codex rate-limit window was not an object.");
  const used = asNumber(value.used_percent);
  if (used === void 0) return;
  const seconds = asNumber(value.limit_window_seconds);
  const resetsAt = asNumber(value.reset_at);
  buckets.push({
    id: `${groupId}:${position}`,
    label: position === "primary" ? "Primary limit" : "Secondary limit",
    groupId,
    groupLabel,
    modelKeys: [groupId, groupLabel],
    used,
    remaining: 100 - clampPercent(used),
    limit: 100,
    unit: "percent",
    ...seconds !== void 0 && seconds > 0 ? { windowMinutes: Math.ceil(seconds / 60) } : {},
    ...resetsAt !== void 0 ? { resetsAt } : {}
  });
}
function asObject2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function asString(value) {
  if (typeof value !== "string") return void 0;
  return sanitizeDisplayText(value, 160) || void 0;
}
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  return void 0;
}
function asNonnegativeInteger(value) {
  const parsed = asNumber(value);
  if (parsed === void 0 || !Number.isSafeInteger(parsed)) return void 0;
  return Math.max(0, parsed);
}
function clampPercent(value) {
  return Math.min(100, Math.max(0, value));
}
var init_codex = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/codex.ts"() {
    init_core();
  }
});

// node_modules/@narumitw/pi-usage/src/providers/deepseek.ts
function normalizeDeepSeekBalancePayload(payload, capturedAt) {
  if (typeof payload.is_available !== "boolean") {
    throw new Error("DeepSeek API balance response availability was not a boolean.");
  }
  if (!Array.isArray(payload.balance_infos) || payload.balance_infos.length === 0) {
    throw new Error("DeepSeek API balance response returned no balance information.");
  }
  const balances = /* @__PURE__ */ new Map();
  for (const raw of payload.balance_infos) {
    const balance = asObject3(raw);
    if (!balance) throw new Error("DeepSeek API balance row was not an object.");
    const currency = deepSeekCurrency(balance.currency);
    if (!currency) throw new Error("DeepSeek API balance row returned an unsupported currency.");
    if (balances.has(currency)) {
      throw new Error(`DeepSeek API balance response repeated ${currency}.`);
    }
    for (const [, label, field] of BALANCE_FIELDS) {
      if (!decimalAmount2(balance[field])) {
        throw new Error(`DeepSeek API balance ${label.toLowerCase()} was not a valid amount.`);
      }
    }
    balances.set(currency, balance);
  }
  const metrics = [
    {
      id: "api-availability",
      label: "API calls",
      value: payload.is_available ? "available" : "unavailable"
    }
  ];
  for (const currency of CURRENCIES) {
    const balance = balances.get(currency);
    if (!balance) continue;
    for (const [id, label, field] of BALANCE_FIELDS) {
      metrics.push({
        id: `${currency.toLowerCase()}-${id}`,
        label,
        value: balance[field],
        unit: "currency",
        currency
      });
    }
  }
  return {
    providerId: "deepseek",
    providerName: "DeepSeek",
    capturedAt,
    source: "deepseek-balance",
    semantics: { kind: "api-key", label: "DeepSeek API balance" },
    buckets: [],
    metrics
  };
}
function asObject3(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function deepSeekCurrency(value) {
  return CURRENCIES.find((currency) => currency === value);
}
function decimalAmount2(value) {
  return typeof value === "string" && value.length <= 64 && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value);
}
var CURRENCIES, BALANCE_FIELDS;
var init_deepseek = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/deepseek.ts"() {
    CURRENCIES = ["CNY", "USD"];
    BALANCE_FIELDS = [
      ["total", "Total balance", "total_balance"],
      ["granted", "Granted balance", "granted_balance"],
      ["topped-up", "Topped-up balance", "topped_up_balance"]
    ];
  }
});

// node_modules/@narumitw/pi-usage/src/providers/fireworks.ts
function isFireworksAccountId(value) {
  return typeof value === "string" && ACCOUNT_ID_PATTERN.test(value);
}
function normalizeFireworksAccountsPayload(payload) {
  if (!Array.isArray(payload.accounts)) {
    throw new Error("Fireworks accounts response did not contain an accounts array.");
  }
  const accounts = [];
  for (const raw of payload.accounts) {
    const account = asObject4(raw);
    if (!account) throw new Error("Fireworks accounts response row was not an object.");
    if (typeof account.name !== "string") {
      throw new Error("Fireworks accounts response omitted the account resource name.");
    }
    const match = /^accounts\/([^/]+)$/u.exec(account.name);
    if (!match || !isFireworksAccountId(match[1])) {
      throw new Error("Fireworks accounts response returned an unsafe account resource name.");
    }
    const accountId = match[1];
    if (accounts.includes(accountId)) {
      throw new Error(`Fireworks accounts response repeated ${accountId}.`);
    }
    accounts.push(accountId);
  }
  return accounts;
}
function createFireworksAdapter(fetchProviderJson2) {
  return {
    id: "fireworks",
    displayName: "Fireworks",
    semantics: { kind: "api-key", label: "Fireworks API spend" },
    targets: {
      singularLabel: "account",
      pluralLabel: "accounts",
      async list(auth, signal, timeoutMs, guard) {
        const startedAt = Date.now();
        const accounts = [];
        let pageToken;
        for (let page = 0; page < FIREWORKS_MAX_ACCOUNT_PAGES; page += 1) {
          await guard();
          const payload = await fetchProviderJson2(
            fireworksAccountsUrl(pageToken),
            auth,
            signal,
            remainingTimeout(timeoutMs, startedAt, "fetching Fireworks accounts"),
            "Fireworks accounts endpoint",
            { redirect: "error" }
          );
          await guard();
          for (const accountId of normalizeFireworksAccountsPayload(payload)) {
            if (accounts.includes(accountId)) {
              throw new Error(`Fireworks accounts listing repeated ${accountId}.`);
            }
            accounts.push(accountId);
          }
          pageToken = fireworksNextPageToken(payload.nextPageToken);
          if (!pageToken) break;
        }
        if (pageToken) {
          throw new Error(`Fireworks account listing exceeded ${FIREWORKS_MAX_ACCOUNT_PAGES} pages.`);
        }
        return accounts.map((id) => ({ id, label: id }));
      }
    },
    async query(auth, signal, timeoutMs, guard, targetId) {
      if (!guard) throw new Error("Fireworks API spend requires request-boundary revalidation.");
      if (!isFireworksAccountId(targetId)) {
        throw new Error("Fireworks billing requires a safe selected account slug.");
      }
      const startedAt = Date.now();
      await guard();
      const billingWindowAt = Date.now();
      const payload = await fetchProviderJson2(
        fireworksBillingSummaryUrl(targetId, billingWindowAt),
        auth,
        signal,
        remainingTimeout(timeoutMs, startedAt, "fetching Fireworks rated spend"),
        "Fireworks billing summary endpoint",
        { redirect: "error" }
      );
      await guard();
      return normalizeFireworksBillingSummaryPayload(payload, targetId, Date.now());
    }
  };
}
function normalizeFireworksBillingSummaryPayload(payload, accountId, capturedAt) {
  if (!isFireworksAccountId(accountId)) {
    throw new Error("Fireworks billing summary received an unsafe account identifier.");
  }
  if (payload.lineItems !== void 0 && !Array.isArray(payload.lineItems)) {
    throw new Error("Fireworks billing summary lineItems was not an array.");
  }
  const totals = /* @__PURE__ */ new Map();
  for (const raw of payload.lineItems ?? []) {
    const lineItem = asObject4(raw);
    if (!lineItem) throw new Error("Fireworks billing line item was not an object.");
    const cost = moneyAmount(lineItem.totalCost, "line item total cost");
    const series = seriesKey(lineItem.series);
    let amounts = totals.get(cost.currency);
    if (!amounts) {
      amounts = /* @__PURE__ */ new Map();
      totals.set(cost.currency, amounts);
    }
    amounts.set(series, (amounts.get(series) ?? 0n) + cost.amount);
  }
  const metrics = [];
  for (const [currency, amounts] of totals) {
    metrics.push({
      id: `${currency.toLowerCase()}-total`,
      label: "Total spend",
      value: formatMoneyAmount(sumSeries(amounts)),
      unit: "currency",
      currency
    });
    for (const series of SERIES_KEYS) {
      const amount2 = amounts.get(series);
      if (amount2 === void 0) continue;
      metrics.push({
        id: `${currency.toLowerCase()}-${series}`,
        label: SERIES_LABELS[series],
        value: formatMoneyAmount(amount2),
        unit: "currency",
        currency
      });
    }
  }
  const notes = ["Rated line items may differ from the final invoice once credits or adjustments are applied."];
  if (metrics.length === 0) {
    notes.push("Fireworks returned no rated line items for the last 30 days.");
  }
  return {
    providerId: "fireworks",
    providerName: "Fireworks",
    capturedAt,
    source: "fireworks-billing-summary",
    semantics: { kind: "api-key", label: "Fireworks API spend" },
    accountLabel: sanitizeDisplayText(accountId, 80),
    buckets: [],
    metrics,
    notes
  };
}
function moneyAmount(value, description) {
  const money = asObject4(value);
  if (!money) throw new Error(`Fireworks billing ${description} was not a money object.`);
  const currency = typeof money.currencyCode === "string" ? money.currencyCode : void 0;
  if (!currency || !CURRENCY_PATTERN.test(currency)) {
    throw new Error(`Fireworks billing ${description} currency was not an ISO 4217 code.`);
  }
  const units = money.units === void 0 ? 0n : integerComponent(money.units, description, "whole units", MAX_UNITS_CHARS);
  if (units < INT64_MIN || units > INT64_MAX) {
    throw new Error(`Fireworks billing ${description} whole units exceeded the int64 range.`);
  }
  const nanos = money.nanos === void 0 ? 0n : integerComponent(money.nanos, description, "nano units", MAX_NANOS_CHARS);
  if (nanos <= -NANOS_PER_UNIT || nanos >= NANOS_PER_UNIT) {
    throw new Error(`Fireworks billing ${description} nano units exceeded the Money range.`);
  }
  if (units > 0n && nanos < 0n || units < 0n && nanos > 0n) {
    throw new Error(`Fireworks billing ${description} mixed unit and nano signs.`);
  }
  return { currency, amount: units * NANOS_PER_UNIT + nanos };
}
function integerComponent(value, description, component, maxChars) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : typeof value === "string" && INTEGER_PATTERN.test(value) ? value : void 0;
  if (text === void 0 || text.length > maxChars) {
    throw new Error(`Fireworks billing ${description} ${component} was not a bounded integer.`);
  }
  return BigInt(text);
}
function seriesKey(value) {
  if (value === void 0 || value === null) return "other";
  if (typeof value !== "string") throw new Error("Fireworks billing line item series was invalid.");
  if (value === "SERVERLESS") return "serverless";
  if (value === "DEDICATED_DEPLOYMENT") return "dedicated";
  if (value === "TRAINING") return "training";
  return "other";
}
function sumSeries(amounts) {
  let total = 0n;
  for (const amount2 of amounts.values()) total += amount2;
  return total;
}
function formatMoneyAmount(amount2) {
  const negative = amount2 < 0n;
  const magnitude = negative ? -amount2 : amount2;
  const units = magnitude / NANOS_PER_UNIT;
  const nanos = (magnitude % NANOS_PER_UNIT).toString().padStart(9, "0").replace(/0+$/u, "");
  return `${negative ? "-" : ""}${units.toString()}${nanos ? `.${nanos}` : ""}`;
}
function fireworksAccountsUrl(pageToken) {
  const url = new URL("/v1/accounts", FIREWORKS_BILLING_SUMMARY_ORIGIN);
  url.searchParams.set("pageSize", "200");
  if (pageToken !== void 0) url.searchParams.set("pageToken", pageToken);
  return url.toString();
}
function fireworksNextPageToken(value) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "string" || !value || value.length > 512) {
    throw new Error("Fireworks accounts listing returned an invalid page token.");
  }
  return value;
}
function fireworksBillingSummaryUrl(accountId, startedAt) {
  const dayMs = 24 * 60 * 60 * 1e3;
  const dayFloor = (time) => `${new Date(time).toISOString().slice(0, 10)}T00:00:00Z`;
  const url = new URL(`/v1/accounts/${accountId}/billing/summary`, FIREWORKS_BILLING_SUMMARY_ORIGIN);
  url.searchParams.set("startTime", dayFloor(startedAt - (FIREWORKS_SPEND_WINDOW_DAYS - 1) * dayMs));
  url.searchParams.set("endTime", dayFloor(startedAt + dayMs));
  return url.toString();
}
function remainingTimeout(timeoutMs, startedAt, description) {
  const remaining = timeoutMs - (Date.now() - startedAt);
  if (remaining <= 0) throw new Error(`Timed out while ${description}.`);
  return remaining;
}
function asObject4(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
var NANOS_PER_UNIT, CURRENCY_PATTERN, ACCOUNT_ID_PATTERN, INTEGER_PATTERN, INT64_MIN, INT64_MAX, MAX_UNITS_CHARS, MAX_NANOS_CHARS, FIREWORKS_BILLING_SUMMARY_ORIGIN, FIREWORKS_SPEND_WINDOW_DAYS, FIREWORKS_MAX_ACCOUNT_PAGES, SERIES_KEYS, SERIES_LABELS;
var init_fireworks = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/fireworks.ts"() {
    init_core();
    NANOS_PER_UNIT = 1000000000n;
    CURRENCY_PATTERN = /^[A-Z]{3}$/u;
    ACCOUNT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u;
    INTEGER_PATTERN = /^-?\d+$/u;
    INT64_MIN = -(2n ** 63n);
    INT64_MAX = 2n ** 63n - 1n;
    MAX_UNITS_CHARS = 20;
    MAX_NANOS_CHARS = 11;
    FIREWORKS_BILLING_SUMMARY_ORIGIN = "https://api.fireworks.ai";
    FIREWORKS_SPEND_WINDOW_DAYS = 30;
    FIREWORKS_MAX_ACCOUNT_PAGES = 5;
    SERIES_KEYS = ["serverless", "dedicated", "training", "other"];
    SERIES_LABELS = {
      serverless: "Serverless",
      dedicated: "Dedicated deployments",
      training: "Training",
      other: "Other"
    };
  }
});

// node_modules/@narumitw/pi-usage/src/providers/github-copilot.ts
function normalizeGitHubCopilotUsagePayload(payload, capturedAt) {
  const snapshots = asObject5(payload.quota_snapshots);
  const premium = asObject5(snapshots?.premium_interactions);
  const metrics = [];
  let semanticsLabel;
  let bucket;
  if (premium) {
    const tokenBasedBilling = premium.token_based_billing === true;
    const id = tokenBasedBilling ? "ai-credits" : "premium-requests";
    const label = tokenBasedBilling ? "AI credits" : "Premium requests";
    semanticsLabel = tokenBasedBilling ? "GitHub Copilot AI Credits allowance" : "GitHub Copilot premium request quota";
    if (premium.unlimited === true) {
      bucket = { id, label, unit: "count" };
    } else {
      const entitlement = asNonnegativeNumber(premium.entitlement);
      const rawRemaining = asFiniteNumber(premium.remaining) ?? asFiniteNumber(premium.quota_remaining);
      if (entitlement === void 0 || rawRemaining === void 0) {
        throw new Error(`GitHub Copilot ${label.toLowerCase()} quota was incomplete.`);
      }
      const overageUsed = Math.max(asNonnegativeNumber(premium.overage_count) ?? 0, Math.max(0, -rawRemaining));
      if (overageUsed > 0) {
        metrics.push({
          id: "overage-used",
          label: "Additional usage",
          value: overageUsed,
          unit: "count"
        });
      }
      bucket = {
        id,
        label,
        used: asNonnegativeNumber(premium.credits_used) ?? Math.max(0, entitlement - rawRemaining),
        remaining: Math.max(0, rawRemaining),
        limit: entitlement,
        unit: "count",
        period: "monthly",
        ...resetTimestamp(payload)
      };
    }
  } else {
    const limited = asObject5(payload.limited_user_quotas);
    const monthly = asObject5(payload.monthly_quotas);
    const remaining = asNonnegativeNumber(limited?.chat);
    const entitlement = asNonnegativeNumber(monthly?.chat);
    if (remaining === void 0 || entitlement === void 0) {
      throw new Error("GitHub Copilot usage response contained no supported quota.");
    }
    semanticsLabel = "GitHub Copilot Free chat quota";
    bucket = {
      id: "chat-requests",
      label: "Chat requests",
      used: Math.max(0, entitlement - remaining),
      remaining,
      limit: entitlement,
      unit: "count",
      period: "monthly",
      ...resetTimestamp(payload)
    };
  }
  const notes = [];
  const plan = asString2(payload.copilot_plan) ?? asString2(payload.access_type_sku);
  if (plan) notes.push(`Plan: ${plan}`);
  return {
    providerId: "github-copilot",
    providerName: "GitHub Copilot",
    capturedAt,
    source: "github-copilot-user",
    semantics: { kind: "consumer-subscription", label: semanticsLabel },
    accountLabel: asString2(payload.login),
    buckets: [bucket],
    metrics,
    ...notes.length > 0 ? { notes } : {}
  };
}
function resetTimestamp(payload) {
  const raw = asString2(payload.quota_reset_date_utc) ?? asString2(payload.quota_reset_date) ?? asString2(payload.limited_user_reset_date);
  if (!raw) return {};
  const milliseconds = Date.parse(raw);
  return Number.isNaN(milliseconds) ? {} : { resetsAt: Math.floor(milliseconds / 1e3) };
}
function asObject5(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function asString2(value) {
  if (typeof value !== "string") return void 0;
  return sanitizeDisplayText(value, 80) || void 0;
}
function asFiniteNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return void 0;
  return value;
}
function asNonnegativeNumber(value) {
  const number = asFiniteNumber(value);
  return number === void 0 || number < 0 ? void 0 : number;
}
var init_github_copilot = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/github-copilot.ts"() {
    init_core();
  }
});

// node_modules/@narumitw/pi-usage/src/providers/kimi-coding.ts
function normalizeKimiCodingUsagePayload(payload, capturedAt) {
  const root = asObject6(payload);
  if (!root) throw new Error("Kimi Coding usage response was not an object.");
  const candidates = [];
  const explicitWindows = /* @__PURE__ */ new Set();
  let omittedWindow = false;
  if (root.usage !== void 0) explicitWindows.add(WEEKLY_WINDOW_MINUTES);
  const summary = parseUsageRow(root.usage, WEEKLY_WINDOW_MINUTES, "Weekly window");
  if (summary) candidates.push(summary);
  else if (root.usage !== void 0) omittedWindow = true;
  if (Array.isArray(root.limits)) {
    for (const raw of root.limits) {
      const item = asObject6(raw);
      const windowMinutes = parseWindowMinutes(item?.window);
      if (windowMinutes !== void 0) explicitWindows.add(windowMinutes);
      const label = sanitizedLabel(item?.name);
      const bucket = windowMinutes === void 0 ? void 0 : parseUsageRow(item?.detail, windowMinutes, label ?? defaultWindowLabel(windowMinutes));
      if (bucket) candidates.push(bucket);
      else omittedWindow = true;
    }
  } else if (root.limits !== void 0) {
    omittedWindow = true;
  }
  const buckets = [];
  const byWindow = /* @__PURE__ */ new Map();
  for (const bucket of candidates) {
    const windowMinutes = bucket.windowMinutes;
    byWindow.set(windowMinutes, [...byWindow.get(windowMinutes) ?? [], bucket]);
  }
  for (const rows of byWindow.values()) {
    if (rows.length === 1) buckets.push(rows[0]);
    else omittedWindow = true;
  }
  const usages = asObject6(root.usages);
  if (root.usages !== void 0 && !usages) omittedWindow = true;
  if (usages) {
    for (const window of RATIO_WINDOWS) {
      const raw = usages[window.key];
      if (raw === void 0 || "windowMinutes" in window && explicitWindows.has(window.windowMinutes)) continue;
      const bucket = parseRatioWindow(raw, window.id, window.label);
      if (bucket) {
        buckets.push({
          ...bucket,
          ..."windowMinutes" in window ? { windowMinutes: window.windowMinutes } : {}
        });
      } else omittedWindow = true;
    }
  }
  buckets.sort((left, right) => (left.windowMinutes ?? Infinity) - (right.windowMinutes ?? Infinity));
  const metrics = parseBoosterWallet(root.boosterWallet === void 0 ? root.booster_wallet : root.boosterWallet);
  if (buckets.length === 0 && metrics.length === 0) {
    throw new Error("Kimi Coding usage endpoint returned no displayable usage data.");
  }
  return {
    providerId: "kimi-coding",
    providerName: "Kimi For Coding",
    capturedAt,
    source: "kimi-managed-usage",
    semantics: { kind: "consumer-subscription", label: "Kimi Coding Plan usage" },
    buckets,
    metrics,
    ...omittedWindow ? { notes: ["Unsupported, malformed, or duplicate plan windows were unavailable."] } : {}
  };
}
function parseUsageRow(value, windowMinutes, label) {
  const row = asObject6(value);
  if (!row) return void 0;
  const limit = asNonnegativeInteger2(row.limit);
  if (limit === void 0 || limit === 0) return void 0;
  const usedRaw = asNonnegativeInteger2(row.used);
  const remainingRaw = asNonnegativeInteger2(row.remaining);
  if (row.used !== void 0 && usedRaw === void 0 || row.remaining !== void 0 && remainingRaw === void 0) {
    return void 0;
  }
  const used = usedRaw ?? (remainingRaw === void 0 ? 0 : Math.max(0, limit - remainingRaw));
  const remaining = remainingRaw ?? Math.max(0, limit - used);
  const resetsAt = asIsoEpochSeconds(row.resetTime);
  return {
    id: windowId(windowMinutes),
    label,
    used,
    remaining,
    limit,
    unit: "count",
    windowMinutes,
    ...resetsAt !== void 0 ? { resetsAt } : {}
  };
}
function parseRatioWindow(value, id, label) {
  const row = asObject6(value);
  const ratio = row?.used_ratio;
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) return void 0;
  const resetsAt = asIsoEpochSeconds(row?.reset_time);
  const used = ratio * 100;
  return {
    id,
    label,
    used,
    remaining: 100 - used,
    unit: "percent",
    ...resetsAt !== void 0 ? { resetsAt } : {}
  };
}
function parseWindowMinutes(value) {
  const window = asObject6(value);
  if (!window) return void 0;
  const duration = asPositiveInteger(window.duration);
  if (duration === void 0) return void 0;
  const multiplier = window.timeUnit === "TIME_UNIT_MINUTE" ? 1 : window.timeUnit === "TIME_UNIT_HOUR" ? 60 : window.timeUnit === "TIME_UNIT_DAY" ? 1440 : window.timeUnit === "TIME_UNIT_WEEK" ? 10080 : void 0;
  if (multiplier === void 0) return void 0;
  const minutes = duration * multiplier;
  return Number.isSafeInteger(minutes) ? minutes : void 0;
}
function parseBoosterWallet(value) {
  const wallet = asObject6(value);
  const balance = asObject6(wallet?.balance);
  if (!wallet || !balance || balance.type !== "BOOSTER") return [];
  const totalRaw = asPositiveInteger(balance.amount);
  if (totalRaw === void 0) return [];
  const leftRaw = asNonnegativeInteger2(balance.amountLeft) ?? 0;
  const monthlyLimit = parseMoney(wallet.monthlyChargeLimit);
  const monthlyUsed = parseMoney(wallet.monthlyUsed);
  const currencies = new Set(
    [monthlyLimit?.currency, monthlyUsed?.currency].filter((currency2) => currency2 !== void 0)
  );
  if (currencies.size !== 1) return [];
  const currency = currencies.values().next().value;
  if (!currency) return [];
  const total = fixedPointToMajor(totalRaw);
  const left = fixedPointToMajor(leftRaw);
  if (total === void 0 || left === void 0) return [];
  const metrics = [
    { id: "booster-balance", label: "Balance", value: left, unit: "currency", currency },
    { id: "booster-total", label: "Total balance", value: total, unit: "currency", currency }
  ];
  if (monthlyUsed) {
    metrics.push({
      id: "booster-monthly-used",
      label: "Used this month",
      value: monthlyUsed.cents / 100,
      unit: "currency",
      currency
    });
  }
  if (wallet.monthlyChargeLimitEnabled === false) {
    metrics.push({
      id: "booster-monthly-limit",
      label: "Monthly limit",
      value: "unlimited",
      unit: "currency",
      currency
    });
  } else if (wallet.monthlyChargeLimitEnabled === true && monthlyLimit) {
    metrics.push({
      id: "booster-monthly-limit",
      label: "Monthly limit",
      value: monthlyLimit.cents / 100,
      unit: "currency",
      currency
    });
  }
  return metrics;
}
function parseMoney(value) {
  const money = asObject6(value);
  if (!money) return void 0;
  const cents = asNonnegativeInteger2(money.priceInCents);
  if (cents === void 0) return void 0;
  const currency = asCurrency(money.currency);
  if (!currency) return void 0;
  return { cents, currency };
}
function fixedPointToMajor(value) {
  const cents = value / FIXED_POINT_UNITS_PER_CENT;
  const roundedCents = cents > 0 && cents < 1 ? 1 : Math.round(cents);
  const major = roundedCents / 100;
  return Number.isSafeInteger(roundedCents) && Number.isFinite(major) ? major : void 0;
}
function asObject6(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function asNonnegativeInteger2(value) {
  if (typeof value === "string" && !/^\d+$/u.test(value)) return void 0;
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) return void 0;
  return number;
}
function asPositiveInteger(value) {
  const number = asNonnegativeInteger2(value);
  return number !== void 0 && number > 0 ? number : void 0;
}
function asIsoEpochSeconds(value) {
  if (typeof value !== "string") return void 0;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u.exec(value);
  if (!match) return void 0;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHour, offsetMinute] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59 || offsetHour !== void 0 && Number(offsetHour) > 23 || offsetMinute !== void 0 && Number(offsetMinute) > 59) {
    return void 0;
  }
  const millis = Date.parse(value);
  return Number.isFinite(millis) && millis >= 0 ? Math.floor(millis / 1e3) : void 0;
}
function sanitizedLabel(value) {
  if (typeof value !== "string") return void 0;
  return sanitizeDisplayText(value, 80) || void 0;
}
function asCurrency(value) {
  if (typeof value !== "string") return void 0;
  const currency = sanitizeDisplayText(value, 3).toUpperCase();
  return /^[A-Z]{3}$/u.test(currency) ? currency : void 0;
}
function windowId(minutes) {
  if (minutes === FIVE_HOUR_WINDOW_MINUTES) return "five-hour";
  if (minutes === DAILY_WINDOW_MINUTES) return "daily";
  if (minutes === WEEKLY_WINDOW_MINUTES) return "weekly";
  return `window-${minutes}-minutes`;
}
function defaultWindowLabel(minutes) {
  if (minutes === WEEKLY_WINDOW_MINUTES) return "Weekly window";
  if (minutes % 10080 === 0) return `${minutes / 10080}w window`;
  if (minutes % 1440 === 0) return `${minutes / 1440}d window`;
  if (minutes % 60 === 0) return `${minutes / 60}h window`;
  return `${minutes}m window`;
}
var FIVE_HOUR_WINDOW_MINUTES, DAILY_WINDOW_MINUTES, WEEKLY_WINDOW_MINUTES, FIXED_POINT_UNITS_PER_CENT, RATIO_WINDOWS;
var init_kimi_coding = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/kimi-coding.ts"() {
    init_core();
    FIVE_HOUR_WINDOW_MINUTES = 300;
    DAILY_WINDOW_MINUTES = 1440;
    WEEKLY_WINDOW_MINUTES = 10080;
    FIXED_POINT_UNITS_PER_CENT = 1e6;
    RATIO_WINDOWS = [
      { key: "limit_5h", id: "five-hour", label: "Five-hour window", windowMinutes: FIVE_HOUR_WINDOW_MINUTES },
      { key: "limit_week", id: "weekly", label: "Weekly window", windowMinutes: WEEKLY_WINDOW_MINUTES },
      { key: "limit_month_total", id: "monthly", label: "Monthly window" }
    ];
  }
});

// node_modules/@narumitw/pi-usage/src/providers/minimax.ts
function miniMaxUsageKind(apiKey) {
  return apiKey.startsWith("sk-api-") ? "account-balance" : "token-plan";
}
function normalizeMiniMaxUsagePayload(providerId, kind, payload, capturedAt) {
  return kind === "account-balance" ? normalizeBalance(providerId, payload, capturedAt) : normalizeTokenPlan(providerId, payload, capturedAt);
}
function normalizeBalance(providerId, payload, capturedAt) {
  assertSuccess(payload);
  const provider = PROVIDERS[providerId];
  const metrics = [
    balanceMetric("available-balance", "Available balance", payload.available_amount, provider.currency),
    balanceMetric("cash-balance", "Cash balance", payload.cash_balance, provider.currency, true),
    balanceMetric("voucher-balance", "Voucher balance", payload.voucher_balance, provider.currency),
    balanceMetric("credit-balance", "Credit balance", payload.credit_balance, provider.currency),
    balanceMetric("owed-amount", "Owed amount", payload.owed_amount, provider.currency)
  ];
  return {
    providerId,
    providerName: provider.name,
    capturedAt,
    source: "minimax-account-balance",
    semantics: { kind: "api-key", label: "MiniMax pay-as-you-go account balance" },
    buckets: [],
    metrics
  };
}
function normalizeTokenPlan(providerId, payload, capturedAt) {
  assertSuccess(payload);
  if (!Array.isArray(payload.model_remains) || payload.model_remains.length === 0) {
    throw new Error("MiniMax Token Plan returned no quota rows.");
  }
  const provider = PROVIDERS[providerId];
  const buckets = [];
  const groups = /* @__PURE__ */ new Set();
  for (const [index, raw] of payload.model_remains.entries()) {
    const row = asObject7(raw);
    if (!row) throw new Error("MiniMax Token Plan quota row was not an object.");
    const groupLabel = safeLabel(row.model_name, `Quota ${index + 1}`);
    const groupId = uniqueGroupId(groupLabel, index, groups);
    buckets.push(
      normalizeWindow(row, {
        id: `${groupId}:interval`,
        label: "Rolling window",
        groupId,
        groupLabel,
        countField: "current_interval_usage_count",
        totalField: "current_interval_total_count",
        percentField: "current_interval_remaining_percent",
        statusField: "current_interval_status",
        startField: "start_time",
        endField: "end_time"
      }),
      normalizeWindow(row, {
        id: `${groupId}:weekly`,
        label: "Weekly window",
        groupId,
        groupLabel,
        countField: "current_weekly_usage_count",
        totalField: "current_weekly_total_count",
        percentField: "current_weekly_remaining_percent",
        statusField: "current_weekly_status",
        startField: "weekly_start_time",
        endField: "weekly_end_time",
        boostPermille: row.weekly_boost_permille
      })
    );
  }
  return {
    providerId,
    providerName: provider.name,
    capturedAt,
    source: "minimax-token-plan",
    semantics: { kind: "consumer-subscription", label: "MiniMax Token Plan quota" },
    buckets,
    metrics: []
  };
}
function normalizeWindow(row, fields) {
  const status = optionalInteger(row[fields.statusField], fields.statusField);
  if (status !== void 0 && ![1, 2, 3].includes(status)) {
    throw new Error(`MiniMax Token Plan ${fields.label} status was unsupported.`);
  }
  const percent2 = optionalPercent(row[fields.percentField], fields.percentField);
  validateBoost(fields.boostPermille);
  const start = timestamp(row[fields.startField], fields.startField);
  const end = timestamp(row[fields.endField], fields.endField);
  if (end < start) throw new Error(`MiniMax Token Plan ${fields.label} timestamps were reversed.`);
  const resetsAt = Math.floor(end / 1e3);
  const windowMinutes = Math.max(1, Math.round((end - start) / 6e4));
  if (status === 3) {
    return {
      id: fields.id,
      label: fields.label,
      groupId: fields.groupId,
      groupLabel: fields.groupLabel,
      remaining: 100,
      unit: "percent",
      period: "unlimited",
      windowMinutes
    };
  }
  const total = nonnegativeInteger(row[fields.totalField], fields.totalField);
  const count = nonnegativeInteger(row[fields.countField], fields.countField);
  if (total === 0) {
    if (count !== 0) {
      throw new Error(`MiniMax Token Plan ${fields.label} counts were inconsistent.`);
    }
    if (percent2 === void 0) {
      throw new Error(`MiniMax Token Plan ${fields.label} returned no quota and no percent.`);
    }
    return {
      id: fields.id,
      label: fields.label,
      groupId: fields.groupId,
      groupLabel: fields.groupLabel,
      remaining: percent2,
      used: 100 - percent2,
      limit: 0,
      unit: "percent",
      windowMinutes,
      resetsAt
    };
  }
  const resolved = resolveQuotaCounts(count, total, percent2);
  if (!resolved) throw new Error(`MiniMax Token Plan ${fields.label} counts were inconsistent.`);
  return {
    id: fields.id,
    label: fields.label,
    groupId: fields.groupId,
    groupLabel: fields.groupLabel,
    ...resolved,
    unit: "count",
    windowMinutes,
    resetsAt
  };
}
function resolveQuotaCounts(reportedCount, total, remainingPercent) {
  if (total <= 0 || reportedCount > total) return void 0;
  let remaining = reportedCount;
  if (remainingPercent !== void 0) {
    const asRemaining = reportedCount / total * 100;
    const asUsed = (total - reportedCount) / total * 100;
    const remainingDistance = Math.abs(asRemaining - remainingPercent);
    const usedDistance = Math.abs(asUsed - remainingPercent);
    if (Math.min(remainingDistance, usedDistance) > PERCENT_TOLERANCE) return void 0;
    if (usedDistance < remainingDistance) remaining = total - reportedCount;
  }
  return { used: total - remaining, remaining, limit: total };
}
function assertSuccess(payload) {
  const base = asObject7(payload.base_resp);
  if (base?.status_code !== 0) {
    throw new Error("MiniMax usage response did not report success.");
  }
}
function balanceMetric(id, label, value, currency, allowNegative = false) {
  if (typeof value !== "string" || value.length > 64 || !DECIMAL_AMOUNT2.test(value) || !allowNegative && value.startsWith("-")) {
    throw new Error(`MiniMax ${label.toLowerCase()} was not a valid amount.`);
  }
  return { id, label, value, unit: "currency", currency };
}
function asObject7(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function safeLabel(value, fallback) {
  if (typeof value !== "string") throw new Error("MiniMax Token Plan model name was not a string.");
  return sanitizeDisplayText(value, 80) || fallback;
}
function uniqueGroupId(label, index, groups) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "quota";
  const id = groups.has(base) ? `${base}-${index + 1}` : base;
  groups.add(id);
  return id;
}
function nonnegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`MiniMax Token Plan ${field} was not a nonnegative safe integer.`);
  }
  return value;
}
function optionalInteger(value, field) {
  if (value === void 0 || value === null) return void 0;
  return nonnegativeInteger(value, field);
}
function optionalPercent(value, field) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`MiniMax Token Plan ${field} was not a percentage.`);
  }
  return value;
}
function validateBoost(boost) {
  if (boost === void 0 || boost === null) return;
  const permille = nonnegativeInteger(boost, "weekly_boost_permille");
  if (permille > 1e4) throw new Error("MiniMax Token Plan weekly boost was unreasonable.");
}
function timestamp(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`MiniMax Token Plan ${field} was not a valid timestamp.`);
  }
  return value;
}
var PROVIDERS, DECIMAL_AMOUNT2, PERCENT_TOLERANCE;
var init_minimax = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/minimax.ts"() {
    init_core();
    PROVIDERS = {
      minimax: { name: "MiniMax", currency: "USD" },
      "minimax-cn": { name: "MiniMax CN", currency: "CNY" }
    };
    DECIMAL_AMOUNT2 = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
    PERCENT_TOLERANCE = 1;
  }
});

// node_modules/@narumitw/pi-usage/src/providers/moonshot.ts
function normalizeMoonshotBalancePayload(providerId, payload, capturedAt) {
  if (payload.code !== 0 || payload.status !== true) {
    throw new Error("Moonshot AI balance response did not report success.");
  }
  const data = asObject8(payload.data);
  if (!data) throw new Error("Moonshot AI balance response data was not an object.");
  const provider = PROVIDERS2[providerId];
  const available = amount(data.available_balance, "available balance", false);
  const voucher = amount(data.voucher_balance, "voucher balance", false);
  const cash = amount(data.cash_balance, "cash balance", true);
  const metrics = [
    currencyMetric("available-balance", "Available balance", available, provider.currency),
    currencyMetric("voucher-balance", "Voucher balance", voucher, provider.currency),
    currencyMetric("cash-balance", "Cash balance", cash, provider.currency)
  ];
  return {
    providerId,
    providerName: provider.name,
    capturedAt,
    source: "moonshot-balance",
    semantics: { kind: "api-key", label: "Moonshot API account balance" },
    buckets: [],
    metrics
  };
}
function currencyMetric(id, label, value, currency) {
  return { id, label, value, unit: "currency", currency };
}
function asObject8(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function amount(value, label, allowNegative) {
  if (typeof value !== "number" || !Number.isFinite(value) || !allowNegative && value < 0 || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Moonshot AI ${label} was not a valid amount.`);
  }
  return String(value);
}
var PROVIDERS2;
var init_moonshot = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/moonshot.ts"() {
    PROVIDERS2 = {
      moonshotai: { name: "Moonshot AI", currency: "USD" },
      "moonshotai-cn": { name: "Moonshot AI CN", currency: "CNY" }
    };
  }
});

// node_modules/@narumitw/pi-usage/src/providers/openai-companion-usage.ts
var openai_companion_usage_exports = {};
__export(openai_companion_usage_exports, {
  matchingOpenAIAppBuckets: () => matchingOpenAIAppBuckets,
  queryOpenAICompanionUsage: () => queryOpenAICompanionUsage
});
function matchingOpenAIAppBuckets(payload, clientId) {
  const root = object(payload);
  if (!root || !Array.isArray(root.items) || root.items.length > MAX_APPS || Object.keys(root).some((key) => !["items", "has_more", "next_cursor"].includes(key)) || root.has_more !== void 0 && root.has_more !== false || root.next_cursor !== void 0 && root.next_cursor !== null && root.next_cursor !== "") {
    throw new Error("ChatGPT app usage requires a complete, bounded registration list; pagination is unsupported.");
  }
  const apps = root.items.map(object);
  if (apps.some((app2) => !app2 || typeof app2.id !== "string" || !app2.id.trim())) {
    throw new Error(
      "ChatGPT app usage returned an unreadable registration identity; uniqueness cannot be established."
    );
  }
  const matches = apps.filter((app2) => app2?.id === clientId);
  if (!clientId || matches.length !== 1) {
    throw new Error(
      "The native registration was not uniquely found in the companion Codex account; use the same ChatGPT account/workspace for both logins."
    );
  }
  const app = matches[0];
  if (!Array.isArray(app?.windows) || app.windows.length === 0 || app.windows.length > MAX_WINDOWS) {
    throw new Error("ChatGPT app usage returned no bounded, displayable windows.");
  }
  const allowance = app.allowed_usage_percent;
  if (allowance !== void 0 && !percent(allowance)) throw new Error("ChatGPT app allowance was invalid.");
  return {
    buckets: app.windows.map((window, index) => normalizeWindow2(window, `app:${index}`, "chatgpt-app", "App limits")),
    ...allowance === void 0 ? {} : { allowance }
  };
}
async function queryOpenAICompanionUsage(auth, signal, timeoutMs, guard) {
  if (!guard) throw new Error("Companion ChatGPT usage requires request-boundary revalidation.");
  if (!auth.openaiCompanion || !auth.openaiClientId)
    throw new Error("Companion ChatGPT usage authentication was incomplete.");
  const startedAt = Date.now();
  const backend = {
    headers: { ...auth.openaiCompanion.headers },
    fingerprint: auth.fingerprint,
    secrets: auth.secrets,
    model: auth.model
  };
  const read = async (url, description) => {
    signal.throwIfAborted();
    await guard();
    signal.throwIfAborted();
    const remaining = timeoutMs - (Date.now() - startedAt);
    if (remaining <= 0) throw new Error("Timed out while fetching companion ChatGPT usage.");
    const payload = await fetchProviderJson(url, backend, signal, remaining, description, { redirect: "error" });
    await guard();
    signal.throwIfAborted();
    return payload;
  };
  const appPayload = await read(`${USAGE_URL}/chatpass/apps`, "ChatGPT companion app usage endpoint");
  const app = matchingOpenAIAppBuckets(appPayload, auth.openaiClientId);
  const planPayload = await read(USAGE_URL, "ChatGPT companion plan usage endpoint");
  const rateLimit = object(planPayload.rate_limit);
  const planBuckets = [];
  for (const position of ["primary", "secondary"]) {
    const window = rateLimit?.[`${position}_window`];
    if (window !== void 0 && window !== null)
      planBuckets.push(normalizeWindow2(window, `plan:${position}`, "chatgpt-plan", "Plan limits"));
  }
  if (planBuckets.length === 0) throw new Error("ChatGPT plan usage returned no displayable windows.");
  return {
    providerId: "openai",
    providerName: "OpenAI",
    capturedAt: Date.now(),
    source: "openai-chatgpt-companion",
    semantics: { kind: "consumer-subscription", label: "ChatGPT plan and app limits (experimental companion source)" },
    buckets: [...planBuckets, ...app.buckets],
    metrics: app.allowance === void 0 ? [] : [{ id: "app-allowance", label: "App allowance", value: app.allowance, unit: "percent" }],
    notes: [
      "Source: companion Codex OAuth; registration matching is not independent proof of the same user/workspace.",
      "App allowance caps shared plan usage; it is not remaining or reserved quota.",
      `Manage usage: ${CHATGPT_USAGE_SETTINGS_URL}`
    ]
  };
}
function normalizeWindow2(raw, id, groupId, groupLabel) {
  const window = object(raw);
  const used = window?.used_percent;
  const remaining = window?.remaining_percent;
  const seconds = window?.limit_window_seconds;
  const resetsAt = window?.reset_at;
  if (!percent(used) || remaining !== void 0 && (!percent(remaining) || Math.abs(used + remaining - 100) > 1) || typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds <= 0 || resetsAt !== void 0 && (typeof resetsAt !== "number" || !Number.isSafeInteger(resetsAt) || resetsAt < 0 || resetsAt > 864e10)) {
    throw new Error("ChatGPT usage returned an invalid or contradictory window.");
  }
  return {
    id,
    label: "Subscription limit",
    groupId,
    groupLabel,
    used,
    remaining: remaining === void 0 ? 100 - used : remaining,
    limit: 100,
    unit: "percent",
    windowMinutes: Math.ceil(seconds / 60),
    ...resetsAt === void 0 ? {} : { resetsAt }
  };
}
function percent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
var USAGE_URL, MAX_APPS, MAX_WINDOWS;
var init_openai_companion_usage = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/openai-companion-usage.ts"() {
    init_query();
    init_openai_chatgpt();
    USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
    MAX_APPS = 128;
    MAX_WINDOWS = 32;
  }
});

// node_modules/@narumitw/pi-usage/src/providers/openai-chatgpt.ts
var CHATGPT_USAGE_SETTINGS_URL, OPENAI_CHATGPT_ADAPTER;
var init_openai_chatgpt = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/openai-chatgpt.ts"() {
    CHATGPT_USAGE_SETTINGS_URL = "https://chatgpt.com/settings/usage";
    OPENAI_CHATGPT_ADAPTER = {
      id: "openai",
      displayName: "OpenAI",
      semantics: { kind: "consumer-subscription", label: "ChatGPT plan authentication status" },
      invalidateCacheOnFailure: true,
      async query(auth, signal, timeoutMs, guard) {
        if (auth.openaiCompanion) {
          const { queryOpenAICompanionUsage: queryOpenAICompanionUsage2 } = await Promise.resolve().then(() => (init_openai_companion_usage(), openai_companion_usage_exports));
          signal.throwIfAborted();
          return queryOpenAICompanionUsage2(auth, signal, timeoutMs, guard);
        }
        if (!guard) throw new Error("ChatGPT plan status requires runtime-auth revalidation.");
        signal.throwIfAborted();
        await guard();
        signal.throwIfAborted();
        return {
          providerId: "openai",
          providerName: "OpenAI",
          capturedAt: Date.now(),
          source: "openai-chatgpt-auth",
          semantics: { kind: "consumer-subscription", label: "ChatGPT plan authentication status" },
          buckets: [],
          metrics: [{ id: "plan-auth", label: "ChatGPT plan authentication", value: "Connected (native OAuth)" }],
          notes: [
            "Numerical usage and reset times are unavailable in pi-usage for native OpenAI OAuth.",
            `Manage usage: ${CHATGPT_USAGE_SETTINGS_URL}`,
            ...auth.openaiCompanionEnabled ? [
              "Experimental companion usage requires /login openai-codex with the same ChatGPT account/workspace; native inference stays on openai."
            ] : [],
            "Fast mode and earned reset redemption remain legacy openai-codex features."
          ]
        };
      }
    };
  }
});

// node_modules/@narumitw/pi-usage/src/providers/opencode-zen.ts
function normalizeOpenCodeZenPayload(payload, capturedAt) {
  const usage = asObject9(payload.usage);
  if (!usage) throw new Error("OpenCode Zen usage response was not an object.");
  const buckets = [];
  const notes = [];
  for (const window of ZEN_WINDOWS) {
    const raw = asObject9(usage[window.key]);
    if (!raw) continue;
    const status = asString3(raw.status);
    if (status !== "ok" && status !== "rate-limited") {
      notes.push(`${window.label} window unavailable (${status ?? "unknown status"}).`);
      continue;
    }
    const used = asNonnegativeNumber2(raw.percent);
    if (used === void 0) continue;
    const resetsAt = asEpochSeconds(raw.resetsAt);
    buckets.push({
      id: window.key,
      label: `${window.label} window`,
      used,
      remaining: 100 - clampPercent2(used),
      limit: 100,
      unit: "percent",
      ...resetsAt !== void 0 ? { resetsAt } : {}
    });
  }
  if (buckets.length === 0) {
    throw new Error("OpenCode Zen usage endpoint returned no displayable usage data.");
  }
  return {
    providerId: "opencode-go",
    providerName: "OpenCode Go",
    capturedAt,
    source: "opencode-zen-usage",
    semantics: {
      kind: "consumer-subscription",
      label: "OpenCode Zen plan usage"
    },
    buckets,
    metrics: [],
    ...notes.length > 0 ? { notes } : {}
  };
}
function asObject9(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function asString3(value) {
  if (typeof value !== "string") return void 0;
  return sanitizeDisplayText(value, 80) || void 0;
}
function asNonnegativeNumber2(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return void 0;
  return value;
}
function asEpochSeconds(value) {
  if (typeof value !== "string" || !value.trim()) return void 0;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return void 0;
  return Math.floor(parsed / 1e3);
}
function clampPercent2(value) {
  return Math.min(100, Math.max(0, value));
}
var ZEN_WINDOWS;
var init_opencode_zen = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/opencode-zen.ts"() {
    init_core();
    ZEN_WINDOWS = [
      { key: "rolling", label: "Rolling" },
      { key: "weekly", label: "Weekly" },
      { key: "monthly", label: "Monthly" }
    ];
  }
});

// node_modules/@narumitw/pi-usage/src/providers/openrouter.ts
function normalizeOpenRouterKeyPayload(payload, capturedAt) {
  const data = asObject10(payload.data);
  if (!data) throw new Error("OpenRouter key response data was not an object.");
  const limit = asNonnegativeNumber3(data.limit);
  const remaining = asNonnegativeNumber3(data.limit_remaining);
  const period = asString4(data.limit_reset);
  const totalUsage = asNonnegativeNumber3(data.usage);
  const buckets = [];
  if (limit !== void 0) {
    buckets.push({
      id: "key-limit",
      label: "Key limit",
      ...remaining !== void 0 ? { used: Math.max(0, limit - remaining), remaining } : {},
      limit,
      unit: "usd",
      ...period ? { period } : {}
    });
  }
  const metrics = [];
  addUsageMetric(metrics, "usage-daily", "Usage today", data.usage_daily);
  addUsageMetric(metrics, "usage-weekly", "Usage this week", data.usage_weekly);
  addUsageMetric(metrics, "usage-monthly", "Usage this month", data.usage_monthly);
  addUsageMetric(metrics, "usage-total", "All-time usage", totalUsage);
  if (buckets.length === 0 && metrics.length === 0) {
    throw new Error("OpenRouter key response returned no displayable usage data.");
  }
  const notes = [];
  if (data.limit === null) notes.push("No per-key spend cap");
  else if (limit === void 0) notes.push("Per-key spend cap unavailable");
  if (data.is_free_tier === true) notes.push("Free-tier API key");
  return {
    providerId: "openrouter",
    providerName: "OpenRouter",
    capturedAt,
    source: "openrouter-key",
    semantics: { kind: "api-key", label: "API-key spend limits" },
    accountLabel: asString4(data.label),
    buckets,
    metrics,
    ...notes.length > 0 ? { notes } : {}
  };
}
function addUsageMetric(metrics, id, label, value) {
  const amount2 = typeof value === "number" ? asNonnegativeNumber3(value) : void 0;
  if (amount2 === void 0) return;
  metrics.push({ id, label, value: amount2, unit: "usd" });
}
function asObject10(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function asString4(value) {
  if (typeof value !== "string") return void 0;
  return sanitizeDisplayText(value, 80) || void 0;
}
function asNonnegativeNumber3(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return void 0;
  return value;
}
var init_openrouter = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/openrouter.ts"() {
    init_core();
  }
});

// node_modules/@narumitw/pi-usage/src/providers/vercel-ai-gateway.ts
function normalizeVercelAIGatewayCreditsPayload(payload, capturedAt) {
  const balance = decimalAmount3(payload.balance, "balance");
  const totalUsed = decimalAmount3(payload.total_used, "total used");
  const metrics = [
    {
      id: "credit-balance",
      label: "Credit balance",
      value: balance,
      unit: "currency",
      currency: "USD"
    },
    {
      id: "lifetime-spend",
      label: "Lifetime spend",
      value: totalUsed,
      unit: "currency",
      currency: "USD"
    }
  ];
  return {
    providerId: "vercel-ai-gateway",
    providerName: "Vercel AI Gateway",
    capturedAt,
    source: "vercel-ai-gateway-credits",
    semantics: { kind: "api-key", label: "AI Gateway credits and lifetime spend" },
    buckets: [],
    metrics
  };
}
function decimalAmount3(value, label) {
  if (typeof value !== "string" || value.length > 64 || !DECIMAL_AMOUNT3.test(value)) {
    throw new Error(`Vercel AI Gateway ${label} was not a valid nonnegative amount.`);
  }
  return value;
}
var DECIMAL_AMOUNT3;
var init_vercel_ai_gateway = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/vercel-ai-gateway.ts"() {
    DECIMAL_AMOUNT3 = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
  }
});

// node_modules/@narumitw/pi-usage/src/providers/xai.ts
function normalizeXaiBillingPayload(payload, subscriptionTier, capturedAt) {
  const configValue = payload.config;
  if (configValue !== null && configValue !== void 0 && !isRecord(configValue)) {
    throw new Error("xAI billing response config was not an object or null.");
  }
  const config = isRecord(configValue) ? configValue : void 0;
  const buckets = [];
  const metrics = [];
  const notes = [];
  if (config) {
    const period = normalizePeriod(config.currentPeriod, config.billingPeriodStart, config.billingPeriodEnd);
    const preferredPercent = optionalPercent2(config.creditUsagePercent, "creditUsagePercent");
    if (preferredPercent !== void 0) {
      buckets.push({
        id: "included-allowance",
        label: "Included allowance",
        used: preferredPercent,
        remaining: 100 - preferredPercent,
        unit: "percent",
        ...period
      });
    } else {
      const limit = optionalUsd(config.monthlyLimit, "monthlyLimit");
      const used = optionalUsd(config.used, "used");
      if (limit !== void 0 || used !== void 0) {
        buckets.push({
          id: "included-allowance",
          label: "Included allowance",
          ...limit !== void 0 ? { limit } : {},
          ...used !== void 0 ? { used } : {},
          ...limit !== void 0 && used !== void 0 ? { remaining: limit - used } : {},
          unit: "usd",
          ...period
        });
      } else if (period.period || period.resetsAt !== void 0) {
        buckets.push({
          id: "included-allowance",
          label: "Included allowance",
          unit: "percent",
          ...period
        });
      }
    }
    const onDemandCap = optionalUsd(config.onDemandCap, "onDemandCap");
    const onDemandUsed = optionalUsd(config.onDemandUsed, "onDemandUsed");
    if (onDemandCap !== void 0 || onDemandUsed !== void 0) {
      buckets.push({
        id: "on-demand",
        label: "On-demand usage",
        ...onDemandCap !== void 0 ? { limit: onDemandCap } : {},
        ...onDemandUsed !== void 0 ? { used: onDemandUsed } : {},
        ...onDemandCap !== void 0 && onDemandUsed !== void 0 ? { remaining: onDemandCap - onDemandUsed } : {},
        unit: "usd"
      });
    }
    const prepaidBalance = optionalUsd(config.prepaidBalance, "prepaidBalance");
    if (prepaidBalance !== void 0) {
      metrics.push({
        id: "prepaid-balance",
        label: "Prepaid balance",
        value: prepaidBalance,
        unit: "usd"
      });
    }
  }
  const tier = optionalTier(subscriptionTier);
  if (tier) metrics.push({ id: "subscription-tier", label: "Plan tier", value: tier });
  if (!config) notes.push("No xAI consumer billing configuration is available for this account.");
  else if (buckets.length === 0 && metrics.length === 0) {
    notes.push("The xAI consumer billing response contained no displayable usage fields.");
  }
  return {
    providerId: "xai",
    providerName: "xAI",
    capturedAt,
    source: "cli-chat-proxy.grok.com consumer billing",
    semantics: {
      kind: "consumer-subscription",
      label: "xAI consumer subscription usage"
    },
    buckets,
    metrics,
    ...notes.length > 0 ? { notes } : {}
  };
}
function normalizePeriod(currentPeriod, legacyStart, legacyEnd) {
  if (currentPeriod !== void 0 && currentPeriod !== null && !isRecord(currentPeriod)) {
    throw new Error("xAI billing currentPeriod was not an object or null.");
  }
  if (isRecord(currentPeriod)) {
    const type = optionalString(currentPeriod.type, "currentPeriod.type");
    const start2 = optionalTimestamp(currentPeriod.start, "currentPeriod.start");
    const end2 = optionalTimestamp(currentPeriod.end, "currentPeriod.end");
    return {
      ...periodLabel(type, start2) ? { period: periodLabel(type, start2) } : {},
      ...end2 !== void 0 ? { resetsAt: end2 } : {}
    };
  }
  const start = optionalTimestamp(legacyStart, "billingPeriodStart");
  const end = optionalTimestamp(legacyEnd, "billingPeriodEnd");
  return {
    ...start !== void 0 ? { period: "Monthly" } : {},
    ...end !== void 0 ? { resetsAt: end } : {}
  };
}
function periodLabel(type, start) {
  if (type === "USAGE_PERIOD_TYPE_WEEKLY") return "Weekly";
  if (type === "USAGE_PERIOD_TYPE_MONTHLY") return "Monthly";
  if (type) return sanitizeDisplayText(type.replace(/^USAGE_PERIOD_TYPE_/u, "").replaceAll("_", " "), 40);
  return start === void 0 ? void 0 : "Current period";
}
function optionalUsd(value, field) {
  if (value === void 0 || value === null) return void 0;
  if (!isRecord(value)) throw new Error(`xAI billing ${field} was not a cent wrapper.`);
  const cents = value.val === void 0 ? 0 : value.val;
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_SAFE_CENTS) {
    throw new Error(`xAI billing ${field}.val was not a safe signed integer.`);
  }
  return cents / 100;
}
function optionalPercent2(value, field) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`xAI billing ${field} was outside 0\u2013100.`);
  }
  return value;
}
function optionalTimestamp(value, field) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "string" || value.length > 80) {
    throw new Error(`xAI billing ${field} was not a bounded timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`xAI billing ${field} was invalid.`);
  return Math.floor(milliseconds / 1e3);
}
function optionalString(value, field) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "string" || value.length > 80) {
    throw new Error(`xAI billing ${field} was not a bounded string.`);
  }
  return value;
}
function optionalTier(value) {
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "string" || value.length > 160) {
    throw new Error("xAI subscription tier was not a bounded string or null.");
  }
  return sanitizeDisplayText(value, 80) || void 0;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var MAX_SAFE_CENTS;
var init_xai = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/xai.ts"() {
    init_core();
    MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;
  }
});

// node_modules/@narumitw/pi-usage/src/providers/zai-errors.ts
function zaiPayloadError(payload) {
  const object2 = asObject11(payload);
  if (!object2) return void 0;
  const nested = asObject11(object2.error);
  const rawCode = nested?.code === void 0 ? object2.code : nested.code;
  const code = errorCode(rawCode);
  if (object2.error === void 0 && object2.success !== false && (rawCode === void 0 || code === "0" || code === "200")) {
    return void 0;
  }
  return code && code !== "0" && code !== "200" ? `Z.AI ${code}: ${ERROR_MESSAGES[code] ?? "API request failed."}` : "Z.AI: API request failed.";
}
function zaiResponseError(status, text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    if (status >= 200 && status < 300) return "Z.AI: Invalid JSON response.";
  }
  const error = zaiPayloadError(payload);
  if (error) return error;
  if (status < 200 || status >= 300) {
    return `Z.AI HTTP ${status}: ${HTTP_MESSAGES[status] ?? "API request failed."}`;
  }
  return void 0;
}
function errorCode(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9999) {
    return String(value);
  }
  return typeof value === "string" && /^(?:0|[1-9]\d{0,3})$/u.test(value) ? value : void 0;
}
function asObject11(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
var ERROR_MESSAGES, HTTP_MESSAGES;
var init_zai_errors = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/zai-errors.ts"() {
    ERROR_MESSAGES = {
      "1000": "Authentication failed. Check your API key.",
      "1001": "Authentication header missing. Check your API key.",
      "1003": "Authentication token expired. Obtain a new token.",
      "1005": "Two-factor authentication required.",
      "1113": "Insufficient balance or no resource package. Recharge your account.",
      "1200": "API call error. Try again later.",
      "1210": "Invalid API parameter. Check the API documentation.",
      "1211": "Unknown model. Check the model ID.",
      "1212": "This model does not support the requested method.",
      "1213": "A required parameter is missing.",
      "1214": "Invalid parameter. Check the API documentation.",
      "1215": "Conflicting parameters. Check the API documentation.",
      "1220": "Access denied. Check your permissions.",
      "1221": "This API has been taken offline.",
      "1222": "This API does not exist.",
      "1230": "API processing error. Try again later.",
      "1234": "Network error. Try again later.",
      "1261": "Prompt too long. Reduce the input length.",
      "1301": "Content rejected by the safety policy.",
      "1302": "Request rate limit reached. Try again later.",
      "1305": "Service overloaded. Try again later.",
      "1308": "Usage limit reached. Wait for the quota reset.",
      "1309": "GLM Coding Plan expired. Renew your subscription.",
      "1310": "Weekly or monthly limit exhausted. Wait for the quota reset.",
      "1311": "Your subscription does not include this model.",
      "1313": "Request frequency restricted by the Fair Usage Policy. Contact support.",
      "1314": "Enterprise package expired. Contact your administrator.",
      "1315": "This API key requires an enterprise coding package scenario. Replace the key.",
      "1316": "5-hour limit reached; insufficient balance for extra usage. Wait for reset.",
      "1317": "7-day limit reached; insufficient balance for extra usage. Wait for reset.",
      "1318": "5-hour limit reached; extra usage blocked by monthly spend limit.",
      "1319": "7-day limit reached; extra usage blocked by monthly spend limit.",
      "1320": "5-hour limit reached; extra usage blocked by monthly spend limit.",
      "1321": "7-day limit reached; extra usage blocked by monthly spend limit."
    };
    HTTP_MESSAGES = {
      400: "Invalid request. Check the API documentation.",
      401: "Authentication failed. Check your API key.",
      403: "Access denied. Check your permissions.",
      429: "Request or usage limit reached. Try again later.",
      500: "Internal error. Try again later."
    };
  }
});

// node_modules/@narumitw/pi-usage/src/providers/zai.ts
function normalizeZaiQuotaPayload(providerId, providerName, payload, capturedAt, plan) {
  const error = zaiPayloadError(payload);
  if (error) throw new Error(error);
  const data = asObject12(payload.data);
  if (!data) throw new Error("Z.AI quota response data was not an object.");
  const limits = Array.isArray(data.limits) ? data.limits : [];
  const buckets = [];
  const metrics = [];
  for (const raw of limits) {
    const limit = asObject12(raw);
    if (!limit) continue;
    const type = asString5(limit.type);
    const unit = asNonnegativeNumber4(limit.unit);
    const isPlanUsage = type === "TOKENS_LIMIT" || type === "CREDIT_LIMIT";
    if (type === "TIME_LIMIT") {
      addCountBucket(buckets, limit, "mcp-monthly", "MCP monthly allowance");
      addUsageDetailMetrics(metrics, limit.usageDetails);
    } else if (isPlanUsage && unit === 3) {
      addPercentBucket(buckets, limit, "five-hour", sessionWindowLabel(limit), sessionWindowMinutes(limit));
    } else if (isPlanUsage && unit === 6) {
      const used = asNonnegativeNumber4(limit.currentValue);
      const quota = asNonnegativeNumber4(limit.usage);
      if (used !== void 0 && quota !== void 0) {
        addCountBucket(buckets, limit, "weekly", "Weekly window", weeklyWindowMinutes(limit));
      } else {
        addPercentBucket(buckets, limit, "weekly", "Weekly window", weeklyWindowMinutes(limit));
      }
    }
  }
  if (buckets.length === 0) {
    throw new Error("Z.AI quota endpoint returned no displayable usage data.");
  }
  const notes = [];
  const level = asString5(data.level);
  const planLabel = plan?.name ?? level;
  if (planLabel) {
    notes.push(plan?.renewsAt ? `Plan: ${planLabel} \xB7 renews ${plan.renewsAt}` : `Plan: ${planLabel}`);
  }
  return {
    providerId,
    providerName,
    capturedAt,
    source: "zai-quota",
    semantics: { kind: "consumer-subscription", label: "GLM Coding Plan usage" },
    buckets,
    metrics,
    ...notes.length > 0 ? { notes } : {}
  };
}
function normalizeZaiSubscriptionPayload(payload) {
  if (zaiPayloadError(payload)) return void 0;
  if (!Array.isArray(payload.data)) return void 0;
  const candidates = [];
  for (const raw of payload.data) {
    const entry = asObject12(raw);
    if (!entry) continue;
    const name = asString5(entry.productName);
    if (!name) continue;
    const renewsAt = planRenewalDate(entry.nextRenewTime);
    const status = asString5(entry.status)?.toUpperCase();
    const inCurrentPeriod = asBoolean(entry.inCurrentPeriod);
    candidates.push({
      plan: { name, ...renewsAt !== void 0 ? { renewsAt } : {} },
      ...status !== void 0 ? { status } : {},
      ...inCurrentPeriod !== void 0 ? { inCurrentPeriod } : {}
    });
  }
  const hasStateMetadata = candidates.some(
    (candidate) => candidate.status !== void 0 || candidate.inCurrentPeriod !== void 0
  );
  if (!hasStateMetadata) return candidates[0]?.plan;
  return candidates.find((candidate) => candidate.inCurrentPeriod === true && candidate.status === "VALID")?.plan ?? candidates.find((candidate) => candidate.inCurrentPeriod === true && candidate.status === void 0)?.plan ?? candidates.find((candidate) => candidate.status === "VALID" && candidate.inCurrentPeriod === void 0)?.plan;
}
function planRenewalDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value)) return value.slice(0, 10);
  const millis = asNonnegativeNumber4(value);
  if (millis === void 0 || millis === 0) return void 0;
  return new Date(millis).toISOString().slice(0, 10);
}
function sessionWindowMinutes(limit) {
  const hours = asPositiveNumber(limit.number);
  return hours === void 0 ? FIVE_HOUR_WINDOW_MINUTES2 : Math.round(hours * 60);
}
function sessionWindowLabel(limit) {
  const minutes = sessionWindowMinutes(limit);
  return minutes === FIVE_HOUR_WINDOW_MINUTES2 ? "5h window" : `${Math.round(minutes / 60)}h window`;
}
function weeklyWindowMinutes(limit) {
  const weeks = asPositiveNumber(limit.number);
  return weeks === void 0 ? WEEKLY_WINDOW_MINUTES2 : Math.round(weeks * WEEKLY_WINDOW_MINUTES2);
}
function addPercentBucket(buckets, limit, id, label, windowMinutes) {
  const used = asNonnegativeNumber4(limit.percentage);
  if (used === void 0) return;
  const percent2 = clampPercent3(used);
  const resetsAt = asEpochSeconds2(limit.nextResetTime);
  buckets.push({
    id,
    label,
    used: percent2,
    remaining: 100 - percent2,
    limit: 100,
    unit: "percent",
    windowMinutes,
    ...resetsAt !== void 0 ? { resetsAt } : {}
  });
}
function addCountBucket(buckets, limit, id, label, windowMinutes) {
  const used = asNonnegativeNumber4(limit.currentValue);
  const quota = asNonnegativeNumber4(limit.usage);
  if (used === void 0 || quota === void 0) return;
  const resetsAt = asEpochSeconds2(limit.nextResetTime);
  buckets.push({
    id,
    label,
    used,
    remaining: Math.max(0, quota - used),
    limit: quota,
    unit: "count",
    ...windowMinutes !== void 0 ? { windowMinutes } : {},
    ...resetsAt !== void 0 ? { resetsAt } : {}
  });
}
function addUsageDetailMetrics(metrics, value) {
  if (!Array.isArray(value)) return;
  for (const raw of value) {
    const detail = asObject12(raw);
    if (!detail) continue;
    const label = asString5(detail.modelCode);
    const usage = asNonnegativeNumber4(detail.usage);
    if (!label || usage === void 0) continue;
    metrics.push({ id: `mcp-${kebabCase(label)}`, label, value: usage, unit: "count" });
  }
}
function asObject12(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function asString5(value) {
  if (typeof value !== "string") return void 0;
  return sanitizeDisplayText(value, 80) || void 0;
}
function asNonnegativeNumber4(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return void 0;
  return value;
}
function asPositiveNumber(value) {
  const number = asNonnegativeNumber4(value);
  return number !== void 0 && number > 0 ? number : void 0;
}
function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return void 0;
}
function asEpochSeconds2(value) {
  const millis = asNonnegativeNumber4(value);
  if (millis === void 0) return void 0;
  return Math.floor(millis / 1e3);
}
function kebabCase(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "tool";
}
function clampPercent3(value) {
  return Math.min(100, Math.max(0, value));
}
var FIVE_HOUR_WINDOW_MINUTES2, WEEKLY_WINDOW_MINUTES2;
var init_zai = __esm({
  "node_modules/@narumitw/pi-usage/src/providers/zai.ts"() {
    init_core();
    init_zai_errors();
    FIVE_HOUR_WINDOW_MINUTES2 = 300;
    WEEKLY_WINDOW_MINUTES2 = 10080;
  }
});

// node_modules/@narumitw/pi-usage/src/usage-targets.ts
var init_usage_targets = __esm({
  "node_modules/@narumitw/pi-usage/src/usage-targets.ts"() {
    init_core();
  }
});

// node_modules/@narumitw/pi-usage/src/query.ts
import { randomBytes } from "node:crypto";
import { readStoredCredential as readStoredCredential2 } from "@earendil-works/pi-coding-agent";
function usageAdapters() {
  return [...SUPPORTED_ADAPTERS, XAI_ADAPTER];
}
async function fetchProviderJson(url, auth, signal, timeoutMs, description, request = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const headers = { ...auth.headers };
    if (request.userAgent !== false && !hasHeader(headers, "User-Agent")) {
      headers["User-Agent"] = "pi-usage";
    }
    if (request.body && !hasHeader(headers, "Content-Type")) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
      method: request.method ?? "GET",
      headers,
      ...request.body ? { body: JSON.stringify(request.body) } : {},
      ...request.redirect ? { redirect: request.redirect } : {},
      signal: controller.signal
    });
    if (response.redirected) throw new Error(`${description} refused a redirected response.`);
    if (controller.signal.aborted) throw Object.assign(new Error("Usage query aborted."), { name: "AbortError" });
    const text = await readBoundedResponse(
      response,
      response.ok ? MAX_SUCCESS_BODY_BYTES : MAX_ERROR_BODY_BYTES,
      !response.ok,
      description,
      controller.signal
    );
    if (controller.signal.aborted) throw Object.assign(new Error("Usage query aborted."), { name: "AbortError" });
    const responseError = request.responseError?.(response.status, text);
    if (responseError) throw new Error(responseError);
    if (!response.ok) {
      throw new Error(
        `${description} returned ${response.status} ${response.statusText}: ${redactUsageError(text, auth.secrets)}`
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`${description} returned invalid JSON: ${errorMessage(error)}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${description} response was not an object.`);
    }
    return parsed;
  } catch (error) {
    if (timedOut) {
      throw new Error(`Timed out after ${Math.round(timeoutMs / 1e3)}s while fetching usage.`);
    }
    if (signal.aborted) throw Object.assign(new Error("Usage query aborted."), { name: "AbortError" });
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abortFromCaller);
  }
}
async function readBoundedResponse(response, maxBytes, truncateOverflow, description, signal) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  const abort = () => void reader.cancel().catch(() => void 0);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        total = maxBytes;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  if (truncated && !truncateOverflow) {
    throw new Error(`${description} response exceeded ${maxBytes} bytes.`);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(body);
  return truncated ? `${text}\u2026` : text;
}
function bearerToken(authorization) {
  const match = /^Bearer\s+(.+)$/iu.exec(authorization ?? "");
  return match?.[1];
}
function headerValue(headers, name) {
  const entry = Object.entries(headers ?? {}).find(([candidate]) => candidate.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? void 0;
}
function hasHeader(headers, name) {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}
function validatedXaiUserId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._~-]{1,128}$/u.test(value)) {
    throw new Error("xAI consumer identity returned an unsafe canonical user ID.");
  }
  return value;
}
function basetenBillingUsageUrl(windowAt) {
  const url = new URL(BASETEN_BILLING_USAGE_URL);
  url.searchParams.set(
    "start_date",
    new Date(windowAt - BASETEN_USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1e3).toISOString()
  );
  url.searchParams.set("end_date", new Date(windowAt).toISOString());
  return url.toString();
}
async function queryMiniMaxUsage(providerId, auth, signal, timeoutMs, guard) {
  if (!guard) throw new Error("MiniMax usage requires request-boundary revalidation.");
  const apiKey = bearerToken(headerValue(auth.headers, "Authorization")) ?? auth.apiKey;
  if (!apiKey) throw new Error("MiniMax runtime API key was unavailable.");
  const kind = miniMaxUsageKind(apiKey);
  const path = kind === "account-balance" ? "/account/query_balance" : "/v1/token_plan/remains";
  const startedAt = Date.now();
  await guard();
  const payload = await fetchProviderJson(
    `${MINIMAX_API_ROOTS[providerId]}${path}`,
    auth,
    signal,
    remainingTimeout2(timeoutMs, startedAt, "fetching MiniMax usage"),
    "MiniMax usage endpoint",
    { redirect: "error" }
  );
  await guard();
  return normalizeMiniMaxUsagePayload(providerId, kind, payload, Date.now());
}
async function queryMoonshotBalance(providerId, auth, signal, timeoutMs, guard) {
  if (!guard) throw new Error("Moonshot AI balance requires request-boundary revalidation.");
  const startedAt = Date.now();
  await guard();
  const payload = await fetchProviderJson(
    MOONSHOT_BALANCE_URLS[providerId],
    auth,
    signal,
    remainingTimeout2(timeoutMs, startedAt, "fetching Moonshot AI balance"),
    "Moonshot AI balance endpoint",
    { redirect: "error" }
  );
  await guard();
  return normalizeMoonshotBalancePayload(providerId, payload, Date.now());
}
function remainingTimeout2(timeoutMs, startedAt, description = "fetching xAI consumer usage") {
  const remaining = timeoutMs - (Date.now() - startedAt);
  if (remaining <= 0) throw new Error(`Timed out while ${description}.`);
  return remaining;
}
function zaiOrigin(baseUrl) {
  const base = baseUrl?.trim();
  if (!base) throw new Error("Z.AI model base URL is unavailable.");
  return new URL(base).origin;
}
function zaiMonitorUrl(baseUrl) {
  return `${zaiOrigin(baseUrl)}/api/monitor/usage/quota/limit`;
}
function zaiMonitorAuth(auth) {
  const authorization = headerValue(auth.headers, "Authorization");
  const token = authorization === void 0 ? void 0 : bearerToken(authorization) ?? authorization;
  if (token === void 0 || token === authorization) return auth;
  return { ...auth, headers: { ...auth.headers, Authorization: token } };
}
async function queryZaiUsage(providerId, providerName, auth, signal, timeoutMs, guard) {
  if (!guard) throw new Error("Z.AI usage requires request-boundary revalidation.");
  const startedAt = Date.now();
  await guard();
  const payload = await fetchProviderJson(
    zaiMonitorUrl(auth.model.baseUrl),
    zaiMonitorAuth(auth),
    signal,
    remainingTimeout2(timeoutMs, startedAt, `fetching ${providerName} quota`),
    `${providerName} quota endpoint`,
    { responseError: zaiResponseError }
  );
  await guard();
  const planTimeoutMs = timeoutMs - (Date.now() - startedAt);
  const plan = await fetchZaiPlan(providerName, auth, signal, planTimeoutMs);
  return normalizeZaiQuotaPayload(providerId, providerName, payload, Date.now(), plan);
}
async function fetchZaiPlan(providerName, auth, signal, timeoutMs) {
  if (timeoutMs <= 0 || signal.aborted) return void 0;
  try {
    const payload = await fetchProviderJson(
      `${zaiOrigin(auth.model.baseUrl)}/api/biz/subscription/list`,
      zaiMonitorAuth(auth),
      signal,
      timeoutMs,
      `${providerName} plan endpoint`,
      { responseError: zaiResponseError }
    );
    return normalizeZaiSubscriptionPayload(payload);
  } catch (error) {
    if (isAbortError(error)) throw error;
    return void 0;
  }
}
function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}
var BASETEN_BILLING_USAGE_URL, BASETEN_USAGE_WINDOW_DAYS, CODEX_USAGE_URL, DEEPSEEK_BALANCE_URL, GITHUB_COPILOT_USAGE_URL, OPENROUTER_KEY_URL, VERCEL_AI_GATEWAY_CREDITS_URL, OPENCODE_GO_USAGE_URL, KIMI_CODING_USAGE_URL, MINIMAX_API_ROOTS, MOONSHOT_BALANCE_URLS, XAI_USER_URL, XAI_BILLING_URL, XAI_CLIENT_HEADERS, MAX_SUCCESS_BODY_BYTES, MAX_ERROR_BODY_BYTES, AUTH_FINGERPRINT_SALT, SUPPORTED_ADAPTERS, XAI_ADAPTER;
var init_query = __esm({
  "node_modules/@narumitw/pi-usage/src/query.ts"() {
    init_core();
    init_oauth_credential_source();
    init_baseten();
    init_codex();
    init_deepseek();
    init_fireworks();
    init_github_copilot();
    init_kimi_coding();
    init_minimax();
    init_moonshot();
    init_openai_chatgpt();
    init_opencode_zen();
    init_openrouter();
    init_vercel_ai_gateway();
    init_xai();
    init_zai();
    init_zai_errors();
    init_usage_targets();
    BASETEN_BILLING_USAGE_URL = "https://api.baseten.co/v1/billing/usage_summary";
    BASETEN_USAGE_WINDOW_DAYS = 30;
    CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
    DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";
    GITHUB_COPILOT_USAGE_URL = "https://api.github.com/copilot_internal/user";
    OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
    VERCEL_AI_GATEWAY_CREDITS_URL = "https://ai-gateway.vercel.sh/v1/credits";
    OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
    KIMI_CODING_USAGE_URL = "https://api.kimi.com/coding/v1/usages";
    MINIMAX_API_ROOTS = Object.freeze({
      minimax: "https://api.minimax.io",
      "minimax-cn": "https://api.minimaxi.com"
    });
    MOONSHOT_BALANCE_URLS = Object.freeze({
      moonshotai: "https://api.moonshot.ai/v1/users/me/balance",
      "moonshotai-cn": "https://api.moonshot.cn/v1/users/me/balance"
    });
    XAI_USER_URL = "https://cli-chat-proxy.grok.com/v1/user?include=subscription";
    XAI_BILLING_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
    XAI_CLIENT_HEADERS = Object.freeze({
      "X-XAI-Token-Auth": "xai-grok-cli",
      "x-grok-client-version": "1.0.10",
      "x-grok-client-mode": "interactive"
    });
    MAX_SUCCESS_BODY_BYTES = 64 * 1024;
    MAX_ERROR_BODY_BYTES = 4 * 1024;
    AUTH_FINGERPRINT_SALT = randomBytes(32);
    SUPPORTED_ADAPTERS = [
      {
        id: "baseten",
        displayName: "Baseten",
        semantics: { kind: "api-key", label: "Organization Model APIs spend" },
        async query(auth, signal, timeoutMs, guard) {
          if (!guard) throw new Error("Baseten billing usage requires request-boundary revalidation.");
          const startedAt = Date.now();
          await guard();
          const windowAt = Date.now();
          const payload = await fetchProviderJson(
            basetenBillingUsageUrl(windowAt),
            auth,
            signal,
            remainingTimeout2(timeoutMs, startedAt, "fetching Baseten billing usage"),
            "Baseten billing usage endpoint",
            { redirect: "error" }
          );
          await guard();
          return normalizeBasetenBillingUsagePayload(payload, Date.now());
        }
      },
      OPENAI_CHATGPT_ADAPTER,
      {
        id: "openai-codex",
        displayName: "OpenAI Codex",
        semantics: {
          kind: "consumer-subscription",
          label: "ChatGPT subscription limits"
        },
        async query(auth, signal, timeoutMs) {
          const payload = await fetchProviderJson(CODEX_USAGE_URL, auth, signal, timeoutMs, "Codex usage endpoint");
          return normalizeCodexBackendPayload(payload, Date.now());
        }
      },
      {
        id: "deepseek",
        displayName: "DeepSeek",
        semantics: { kind: "api-key", label: "DeepSeek API balance" },
        async query(auth, signal, timeoutMs, guard) {
          if (!guard) throw new Error("DeepSeek API balance requires request-boundary revalidation.");
          const startedAt = Date.now();
          await guard();
          const remainingMs = timeoutMs - (Date.now() - startedAt);
          if (remainingMs <= 0) throw new Error("Timed out while revalidating DeepSeek runtime auth.");
          const payload = await fetchProviderJson(
            DEEPSEEK_BALANCE_URL,
            auth,
            signal,
            remainingMs,
            "DeepSeek API balance endpoint",
            { redirect: "error" }
          );
          return normalizeDeepSeekBalancePayload(payload, Date.now());
        }
      },
      {
        id: "github-copilot",
        displayName: "GitHub Copilot",
        semantics: {
          kind: "consumer-subscription",
          label: "GitHub Copilot account allowance"
        },
        async query(auth, signal, timeoutMs) {
          const payload = await fetchProviderJson(
            GITHUB_COPILOT_USAGE_URL,
            auth,
            signal,
            timeoutMs,
            "GitHub Copilot usage endpoint"
          );
          return normalizeGitHubCopilotUsagePayload(payload, Date.now());
        }
      },
      {
        id: "openrouter",
        displayName: "OpenRouter",
        semantics: { kind: "api-key", label: "API-key spend limits" },
        async query(auth, signal, timeoutMs) {
          const payload = await fetchProviderJson(OPENROUTER_KEY_URL, auth, signal, timeoutMs, "OpenRouter key endpoint");
          return normalizeOpenRouterKeyPayload(payload, Date.now());
        }
      },
      {
        id: "vercel-ai-gateway",
        displayName: "Vercel AI Gateway",
        semantics: { kind: "api-key", label: "AI Gateway credits and lifetime spend" },
        async query(auth, signal, timeoutMs, guard) {
          if (!guard) throw new Error("Vercel AI Gateway usage requires request-boundary revalidation.");
          const startedAt = Date.now();
          await guard();
          const payload = await fetchProviderJson(
            VERCEL_AI_GATEWAY_CREDITS_URL,
            auth,
            signal,
            remainingTimeout2(timeoutMs, startedAt, "fetching Vercel AI Gateway credits"),
            "Vercel AI Gateway credits endpoint",
            { redirect: "error" }
          );
          await guard();
          return normalizeVercelAIGatewayCreditsPayload(payload, Date.now());
        }
      },
      createFireworksAdapter(fetchProviderJson),
      {
        id: "opencode-go",
        displayName: "OpenCode Go",
        semantics: { kind: "consumer-subscription", label: "OpenCode Zen plan usage" },
        async query(auth, signal, timeoutMs) {
          const payload = await fetchProviderJson(
            OPENCODE_GO_USAGE_URL,
            auth,
            signal,
            timeoutMs,
            "OpenCode Zen usage endpoint"
          );
          return normalizeOpenCodeZenPayload(payload, Date.now());
        }
      },
      {
        id: "kimi-coding",
        displayName: "Kimi For Coding",
        semantics: { kind: "consumer-subscription", label: "Kimi Coding Plan usage" },
        async query(auth, signal, timeoutMs) {
          const payload = await fetchProviderJson(
            KIMI_CODING_USAGE_URL,
            auth,
            signal,
            timeoutMs,
            "Kimi Coding usage endpoint",
            { redirect: "error" }
          );
          return normalizeKimiCodingUsagePayload(payload, Date.now());
        }
      },
      {
        id: "minimax",
        displayName: "MiniMax",
        semantics: { kind: "consumer-subscription", label: "MiniMax usage" },
        async query(auth, signal, timeoutMs, guard) {
          return queryMiniMaxUsage("minimax", auth, signal, timeoutMs, guard);
        }
      },
      {
        id: "minimax-cn",
        displayName: "MiniMax CN",
        semantics: { kind: "consumer-subscription", label: "MiniMax usage" },
        async query(auth, signal, timeoutMs, guard) {
          return queryMiniMaxUsage("minimax-cn", auth, signal, timeoutMs, guard);
        }
      },
      {
        id: "moonshotai",
        displayName: "Moonshot AI",
        semantics: { kind: "api-key", label: "Moonshot API account balance" },
        async query(auth, signal, timeoutMs, guard) {
          return queryMoonshotBalance("moonshotai", auth, signal, timeoutMs, guard);
        }
      },
      {
        id: "moonshotai-cn",
        displayName: "Moonshot AI CN",
        semantics: { kind: "api-key", label: "Moonshot API account balance" },
        async query(auth, signal, timeoutMs, guard) {
          return queryMoonshotBalance("moonshotai-cn", auth, signal, timeoutMs, guard);
        }
      },
      {
        id: "zai",
        displayName: "Z.AI",
        invalidateCacheOnFailure: true,
        semantics: { kind: "consumer-subscription", label: "GLM Coding Plan usage" },
        async query(auth, signal, timeoutMs, guard) {
          return queryZaiUsage("zai", "Z.AI", auth, signal, timeoutMs, guard);
        }
      },
      {
        id: "zai-coding-cn",
        displayName: "Z.AI Coding CN",
        invalidateCacheOnFailure: true,
        semantics: { kind: "consumer-subscription", label: "GLM Coding Plan usage" },
        async query(auth, signal, timeoutMs, guard) {
          return queryZaiUsage("zai-coding-cn", "Z.AI Coding CN", auth, signal, timeoutMs, guard);
        }
      }
    ];
    XAI_ADAPTER = {
      id: "xai",
      displayName: "xAI",
      semantics: {
        kind: "consumer-subscription",
        label: "xAI consumer subscription usage"
      },
      publishesStatusline: false,
      async query(auth, signal, timeoutMs, guard) {
        if (!guard) throw new Error("xAI usage requires request-boundary revalidation.");
        const startedAt = Date.now();
        const clientAuth = {
          ...auth,
          headers: { ...auth.headers, ...XAI_CLIENT_HEADERS }
        };
        await guard();
        const userPayload = await fetchProviderJson(
          XAI_USER_URL,
          clientAuth,
          signal,
          remainingTimeout2(timeoutMs, startedAt),
          "xAI consumer identity endpoint",
          { redirect: "error", userAgent: false }
        );
        await guard();
        const userId = validatedXaiUserId(userPayload.userId);
        const billingAuth = {
          ...clientAuth,
          headers: { ...clientAuth.headers, "x-userid": userId },
          secrets: [...clientAuth.secrets, userId]
        };
        await guard();
        const billingPayload = await fetchProviderJson(
          XAI_BILLING_URL,
          billingAuth,
          signal,
          remainingTimeout2(timeoutMs, startedAt),
          "xAI consumer billing endpoint",
          { redirect: "error", userAgent: false }
        );
        await guard();
        return normalizeXaiBillingPayload(billingPayload, userPayload.subscriptionTier, Date.now());
      }
    };
  }
});

// pi-usage-host-entry.js
init_query();
async function queryDeepSeekBalance(apiKey, signal, guard) {
  const adapter = usageAdapters().find((item) => item.id === "deepseek");
  if (!adapter) throw Error("DeepSeek adapter unavailable");
  return adapter.query({ headers: { Authorization: "Bearer " + apiKey }, secrets: [apiKey] }, signal, 1e4, guard);
}
export {
  queryDeepSeekBalance
};
