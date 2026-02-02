import { z } from "zod";

const environmentSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  LIVE_BALANCE_BEARER_TOKEN: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GOOGLE_SPREADSHEET_ID: z.string().optional(),
  ADMIN_GROUP_IDS: z.string().optional(),
  JAP_API_KEY: z.string().optional(),
  JAP_DEFAULT_REEL_VIEWS: z.string().optional(),
  JAP_DEFAULT_REEL_LIKES: z.string().optional(),
  JAP_API_URL: z.string().optional(),
});

const parseEnvironment = () => {
  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
};

export const env = parseEnvironment();
