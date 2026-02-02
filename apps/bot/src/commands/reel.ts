import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../dependencies";

async function placeJapOrder(
  serviceId: number,
  link: string,
  quantity: number
): Promise<
  { success: true; orderId: number } | { success: false; error: string }
> {
  const apiKey = process.env.JAP_API_KEY;
  const apiUrl =
    process.env.JAP_API_URL || "https://justanotherpanel.com/api/v2";

  if (!apiKey) {
    return { success: false, error: "JAP_API_KEY not configured" };
  }

  const formData = new URLSearchParams({
    key: apiKey,
    action: "add",
    service: serviceId.toString(),
    link: link,
    quantity: quantity.toString(),
  });

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
      await ctx.reply(
        `⏳ Placing orders for reel views (${viewsQty}) and likes (${likesQty})...`
      );

      const [viewsResult, likesResult] = await Promise.all([
        placeJapOrder(5993, reelUrl, viewsQty),
        placeJapOrder(8851, reelUrl, likesQty),
      ]);

      let responseText = `📱 <b>Reel Order Results:</b>\n\n`;

      if (viewsResult.success) {
        responseText += `✅ Views (Service 5993): Order #${viewsResult.orderId}\n`;
      } else {
        responseText += `❌ Views (Service 5993): ${viewsResult.error}\n`;
      }

      if (likesResult.success) {
        responseText += `✅ Likes (Service 8851): Order #${likesResult.orderId}\n`;
      } else {
        responseText += `❌ Likes (Service 8851): ${likesResult.error}\n`;
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
