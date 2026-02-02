import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../dependencies";

async function placeJapOrder(
  serviceId: number,
  link: string,
  quantity?: number
): Promise<
  { success: true; orderId: number } | { success: false; error: string }
> {
  const apiKey = process.env.JAP_API_KEY;
  const apiUrl =
    process.env.JAP_API_URL || "https://thelordofthepanels.com/api/v2";

  if (!apiKey) {
    return { success: false, error: "JAP_API_KEY not configured" };
  }

  const formData = new URLSearchParams({
    key: apiKey,
    action: "add",
    service: serviceId.toString(),
    link: link,
  });

  if (quantity !== undefined) {
    formData.set("quantity", quantity.toString());
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
      headers: {
        "User-Agent": "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as
      | { order: number }
      | { error: string }
      | unknown;

    if (data && typeof data === "object" && "order" in data) {
      return { success: true, orderId: data.order as number };
    } else if (data && typeof data === "object" && "error" in data) {
      return { success: false, error: data.error as string };
    } else {
      return { success: false, error: "Unknown API response format" };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: message };
  }
}

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

function isPackageService(service: PanelService) {
  const type = normalizeServiceField(service.type);
  const min = parseIntSafe(service.min);
  const max = parseIntSafe(service.max);

  if (type.includes("package")) {
    return true;
  }

  if (min === 1 && max === 1) {
    return true;
  }

  return false;
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
  const apiKey = process.env.JAP_API_KEY;
  const apiUrl =
    process.env.JAP_API_URL || "https://thelordofthepanels.com/api/v2";

  if (!apiKey) {
    throw new Error("JAP_API_KEY not configured");
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
  const viewsId = getEnvServiceId("JAP_REEL_VIEWS_SERVICE_ID");
  const likesId = getEnvServiceId("JAP_REEL_LIKES_SERVICE_ID");

  if (viewsId && likesId) {
    return {
      views: { id: viewsId, service: null as PanelService | null },
      likes: { id: likesId, service: null as PanelService | null },
    };
  }

  try {
    const services = await fetchPanelServices();

    const viewsTokens = ["instagram", "reel", "view"];
    const likesTokens = ["instagram", "reel", "like"];

    const bestViews = pickBestService(services, viewsTokens);
    const bestLikes = pickBestService(services, likesTokens);

    const bestViewsId = bestViews ? parseIntSafe(bestViews.service) : null;
    const bestLikesId = bestLikes ? parseIntSafe(bestLikes.service) : null;

    if (bestViewsId && bestLikesId) {
      return {
        views: { id: bestViewsId, service: bestViews },
        likes: { id: bestLikesId, service: bestLikes },
      };
    }
  } catch (error) {
    console.log("Auto-detection failed, using defaults:", error instanceof Error ? error.message : "Unknown error");
  }

  const defaultViewsId = 8851;
  const defaultLikesId = 1781;

  return {
    views: { id: defaultViewsId, service: null as PanelService | null },
    likes: { id: defaultLikesId, service: null as PanelService | null },
  };
}

export const createReelCommand =
  (): MiddlewareFn<BotContext> => async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await ctx.dependencies.users.getUserOrCreate(
      ctx.from.id,
      ctx.from.username
    );

    if (!ctx.dependencies.users.isAdmin(user)) {
      await ctx.reply(`⛔️ Mods and owners only.`);
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);

    if (args.length < 1) {
      await ctx.reply(
        `❌ Usage: /reel <instagram_reel_url> [views_qty] [likes_qty]\n\n` +
          `Examples:\n` +
          `/reel https://www.instagram.com/reel/ABC123/\n` +
          `/reel https://www.instagram.com/reel/ABC123/ 1000 100`
      );
      return;
    }

    const reelUrl = args[0];

    if (!reelUrl.includes("instagram.com/reel/")) {
      await ctx.reply(
        `❌ Invalid Instagram reel URL. Must contain "instagram.com/reel/"`
      );
      return;
    }

    const defaultViews = parseInt(
      process.env.JAP_DEFAULT_REEL_VIEWS || "500",
      10
    );
    const defaultLikes = parseInt(
      process.env.JAP_DEFAULT_REEL_LIKES || "50",
      10
    );

    let viewsQty = defaultViews;
    let likesQty = defaultLikes;

    if (args.length >= 2) {
      const parsedViews = parseInt(args[1], 10);
      if (isNaN(parsedViews) || parsedViews <= 0) {
        await ctx.reply(
          `❌ Invalid views quantity. Must be a positive number.`
        );
        return;
      }
      viewsQty = parsedViews;
    }

    if (args.length >= 3) {
      const parsedLikes = parseInt(args[2], 10);
      if (isNaN(parsedLikes) || parsedLikes <= 0) {
        await ctx.reply(
          `❌ Invalid likes quantity. Must be a positive number.`
        );
        return;
      }
      likesQty = parsedLikes;
    }

    try {
      const resolved = await resolveReelServiceIds();
      const viewsIsPackage = resolved.views.service
        ? isPackageService(resolved.views.service)
        : false;
      const likesIsPackage = resolved.likes.service
        ? isPackageService(resolved.likes.service)
        : false;

      const viewsOrderQuantity = viewsIsPackage ? undefined : viewsQty;
      const likesOrderQuantity = likesIsPackage ? undefined : likesQty;

      await ctx.reply(`⏳ Placing orders...`);

      const [viewsResult, likesResult] = await Promise.all([
        placeJapOrder(resolved.views.id, reelUrl, viewsOrderQuantity),
        placeJapOrder(resolved.likes.id, reelUrl, likesOrderQuantity),
      ]);

      let responseText = `📱 <b>Reel Order Results:</b>\n\n`;

      if (viewsResult.success) {
        responseText += `✅ Views (Service ${resolved.views.id}): Order #${viewsResult.orderId}\n`;
      } else {
        responseText += `❌ Views (Service ${resolved.views.id}): ${viewsResult.error}\n`;
      }

      if (likesResult.success) {
        responseText += `✅ Likes (Service ${resolved.likes.id}): Order #${likesResult.orderId}\n`;
      } else {
        responseText += `❌ Likes (Service ${resolved.likes.id}): ${likesResult.error}\n`;
      }

      if (viewsResult.success && likesResult.success) {
        responseText += `\n✅ Both orders placed successfully!`;
      } else if (viewsResult.success || likesResult.success) {
        responseText += `\n⚠️ Partial success - one order failed.`;
      } else {
        responseText += `\n❌ Both orders failed.`;
      }

      await ctx.reply(responseText, { parse_mode: "HTML" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      await ctx.reply(`❌ Error placing orders: ${message}`);
    }
  };
