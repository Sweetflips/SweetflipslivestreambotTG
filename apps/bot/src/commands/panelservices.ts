import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../dependencies";

type PanelService = {
  service?: string | number;
  name?: string;
  category?: string;
  type?: string;
  min?: string | number;
  max?: string | number;
};

let cachedPanelServices: PanelService[] | null = null;
let cachedPanelServicesAt: number | null = null;

function normalizeServiceField(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).toLowerCase();
}

function parseIntSafe(value: unknown) {
  const n = parseInt(String(value), 10);
  if (Number.isFinite(n)) {
    return n;
  }
  return null;
}

function scoreServiceFor(tokens: string[], service: PanelService) {
  const haystack =
    normalizeServiceField(service.name) +
    " " +
    normalizeServiceField(service.category) +
    " " +
    normalizeServiceField(service.type);

  let score = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) {
      score += 1;
    }
  }
  return score;
}

function pickBestService(services: PanelService[], tokens: string[]) {
  let best: PanelService | null = null;
  let bestScore = -1;

  for (const s of services) {
    const score = scoreServiceFor(tokens, s);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  return best;
}

function getEnvServiceId(name: string) {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function fetchPanelServices() {
  const apiKey = process.env.PANEL_API_KEY;
  const apiUrl =
    process.env.PANEL_API_URL || "https://thelordofthepanels.com/api/v2";

  if (!apiKey) {
    throw new Error("PANEL_API_KEY not configured");
  }

  if (cachedPanelServices && cachedPanelServicesAt) {
    const ageMs = Date.now() - cachedPanelServicesAt;
    if (ageMs < 5 * 60 * 1000) {
      return cachedPanelServices;
    }
  }

  const formData = new URLSearchParams({
    key: apiKey,
    action: "services",
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    body: formData,
    headers: {
      "User-Agent": "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    const errorMessage =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: string }).error)
        : "Invalid services response";
    throw new Error(errorMessage);
  }

  cachedPanelServices = data as PanelService[];
  cachedPanelServicesAt = Date.now();
  return cachedPanelServices;
}

async function resolveReelServiceIds() {
  const viewsId = getEnvServiceId("PANEL_REEL_VIEWS_SERVICE_ID");
  const likesId = getEnvServiceId("PANEL_REEL_LIKES_SERVICE_ID");

  if (viewsId && likesId) {
    return {
      views: { id: viewsId, service: null as PanelService | null },
      likes: { id: likesId, service: null as PanelService | null },
    };
  }

  const services = await fetchPanelServices();

  const viewsTokens = ["instagram", "reel", "view"];
  const likesTokens = ["instagram", "reel", "like"];

  const bestViews = pickBestService(services, viewsTokens);
  const bestLikes = pickBestService(services, likesTokens);

  const bestViewsId = bestViews ? parseIntSafe(bestViews.service) : null;
  const bestLikesId = bestLikes ? parseIntSafe(bestLikes.service) : null;

  if (!bestViewsId || !bestLikesId) {
    throw new Error("Could not resolve reel services");
  }

  return {
    views: { id: bestViewsId, service: bestViews },
    likes: { id: bestLikesId, service: bestLikes },
  };
}

export const createPanelServicesCommand =
  (): MiddlewareFn<BotContext> => async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await ctx.dependencies.users.getUserOrCreate(
      ctx.from.id,
      ctx.from.username
    );

    if (!ctx.dependencies.users.isOwner(user)) {
      await ctx.reply(`⛔️ Owner only.`);
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    const mode = (args[0] || "").toLowerCase();

    try {
      const services = await fetchPanelServices();

      if (mode === "reel") {
        const best = await resolveReelServiceIds();
        const viewsMeta = best.views.service;
        const likesMeta = best.likes.service;

        const viewsLine = viewsMeta
          ? `${best.views.id} - ${viewsMeta.name} (type ${viewsMeta.type}, min ${viewsMeta.min}, max ${viewsMeta.max})`
          : `${best.views.id} - (set via env PANEL_REEL_VIEWS_SERVICE_ID)`;

        const likesLine = likesMeta
          ? `${best.likes.id} - ${likesMeta.name} (type ${likesMeta.type}, min ${likesMeta.min}, max ${likesMeta.max})`
          : `${best.likes.id} - (set via env PANEL_REEL_LIKES_SERVICE_ID)`;

        await ctx.reply(
          `🎛️ <b>Reel Services</b>\n\n` +
            `<b>Views</b>\n${viewsLine}\n\n` +
            `<b>Likes</b>\n${likesLine}\n\n` +
            `Set overrides with:\n` +
            `PANEL_REEL_VIEWS_SERVICE_ID and PANEL_REEL_LIKES_SERVICE_ID`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const query = args.join(" ").trim().toLowerCase();
      if (!query) {
        await ctx.reply(
          `❌ Usage: /panelservices reel OR /panelservices <search text>`
        );
        return;
      }

      const matches = services
        .filter((s) => {
          const haystack =
            normalizeServiceField(s.service) +
            " " +
            normalizeServiceField(s.name) +
            " " +
            normalizeServiceField(s.category) +
            " " +
            normalizeServiceField(s.type);
          return haystack.includes(query);
        })
        .slice(0, 20);

      if (matches.length === 0) {
        await ctx.reply(`No services matched: ${query}`);
        return;
      }

      const lines = matches.map((s) => {
        const id = s.service;
        const name = s.name || "";
        const type = s.type || "";
        const min = s.min || "";
        const max = s.max || "";
        return `${id} - ${name} (type ${type}, min ${min}, max ${max})`;
      });

      await ctx.reply(lines.join("\n"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ ${message}`);
    }
  };
