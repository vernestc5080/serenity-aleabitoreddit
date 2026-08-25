export type Quote = { ticker: string; name: string; price: number; previousClose: number; currency: string; exchange: string; marketTime: string; changePercent: number; sma20: number | null; sma50: number | null; sma200: number | null; high1y: number | null; low1y: number | null; priceSource: string };

async function fetchChart(ticker: string, query: string) {
  let lastError: Error | null = null;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const endpoint = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?${query}`;
      const response = await fetch(endpoint, { headers: { "User-Agent": "Mozilla/5.0 Serenity-Lens" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Market feed returned ${response.status}.`);
      const payload = await response.json() as any;
      const result = payload?.chart?.result?.[0];
      if (!result) throw new Error(payload?.chart?.error?.description ?? `Ticker ${ticker} was not found.`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Market feed request failed.");
    }
  }
  throw lastError ?? new Error(`Quote unavailable for ${ticker}.`);
}

export async function getQuote(rawTicker: string): Promise<Quote> {
  const ticker = rawTicker.toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
  if (!ticker) throw new Error("Enter a valid ticker.");
  const daily = await fetchChart(ticker, "range=1y&interval=1d&includePrePost=true");
  const intraday = await fetchChart(ticker, "range=1d&interval=1m&includePrePost=true").catch(() => null);
  const meta = daily.meta;
  const closes = (daily.indicators?.quote?.[0]?.close ?? []).filter((value: unknown): value is number => typeof value === "number");
  const intradayCloses = intraday?.indicators?.quote?.[0]?.close ?? [];
  let latestPrice: number | null = null;
  let latestTimestamp: number | null = null;
  for (let index = 0; index < intradayCloses.length; index += 1) {
    if (typeof intradayCloses[index] === "number") {
      latestPrice = intradayCloses[index];
      latestTimestamp = intraday.timestamp?.[index] ?? null;
    }
  }
  const average = (days: number) => closes.length ? closes.slice(-days).reduce((a: number, b: number) => a + b, 0) / Math.min(days, closes.length) : null;
  const price = Number(latestPrice ?? meta.regularMarketPrice ?? closes.at(-1));
  const previousClose = Number(meta.previousClose ?? meta.chartPreviousClose ?? closes.at(-2) ?? price);
  return {
    ticker, name: meta.shortName ?? meta.longName ?? ticker, price, previousClose,
    currency: meta.currency ?? "USD", exchange: meta.exchangeName ?? "",
    marketTime: new Date((latestTimestamp ?? meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
    sma20: average(20), sma50: average(50), sma200: average(200),
    high1y: closes.length ? Math.max(...closes) : null, low1y: closes.length ? Math.min(...closes) : null,
    priceSource: latestPrice === null ? "Yahoo Finance daily quote" : "Yahoo Finance 1-minute quote",
  };
}
