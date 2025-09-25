type FetchFn = typeof fetch;

export interface LiveBalanceService {
  fetchCurrentBalance: () => Promise<number | null>;
}

interface LiveBalanceOptions {
  fetchImpl?: FetchFn;
  cacheDurationMs?: number;
}

const defaultHeaders: Record<string, string> = {
  Accept: "application/json",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.5",
  Origin: "https://www.razed.com",
  Referer: "https://www.razed.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  TE: "trailers",
  "User-Agent": "Mozilla/5.0",
  "X-Timezone-Offset": "120",
  "x-client-id": "966344738.1750169000",
  "x-next-env": "production",
  "x-next-env-type": "browser",
  "x-next-locale": "en",
  "x-next-node-env": "release",
  "x-next-version": "3.3.0",
};

const apiUrl = "https://api.razed.com/player/api/v1/wallets";

const isWalletObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseBalance = (wallet: Record<string, unknown>) => {
  const directFloat = wallet.balance_in_float ?? wallet.total_balance_in_float;
  if (typeof directFloat === "number") {
    return directFloat;
  }

  if (typeof wallet.balance === "string") {
    const numericString = wallet.balance.replace(/[,$]/g, "");
    const parsed = Number.parseFloat(numericString);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const extractBalance = (data: unknown): number | null => {
  if (Array.isArray(data)) {
    for (const wallet of data) {
      if (isWalletObject(wallet)) {
        const balance = parseBalance(wallet);
        if (balance !== null) {
          return balance;
        }
      }
    }
  }

  if (isWalletObject(data)) {
    return parseBalance(data);
  }

  return null;
};

export const createLiveBalanceService = (
  options: LiveBalanceOptions = {}
): LiveBalanceService => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheDuration = options.cacheDurationMs ?? 10 * 60 * 1000;

  let cache: number | null = null;
  let cacheTime: number | null = null;

  const fetchCurrentBalance = async () => {
    try {
      const token = process.env.LIVE_BALANCE_BEARER_TOKEN;
      if (!token) {
        return cache ?? null;
      }

      const response = await fetchImpl(apiUrl, {
        method: "GET",
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const balance = extractBalance(data);

      cache = balance;
      cacheTime = Date.now();
      return balance;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown live balance error";
      console.error(`Error fetching live balance: ${message}`);

      if (cache && cacheTime) {
        const age = Date.now() - cacheTime;
        if (age < cacheDuration) {
          return cache;
        }
      }

      return cache;
    }
  };

  return { fetchCurrentBalance };
};

