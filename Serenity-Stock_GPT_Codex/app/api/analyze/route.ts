import { getQuote } from "../../../lib/quote";
import { loadResearch, tickerExcerpt } from "../../../lib/research";

type Analysis = { stance: string; confidence: number; buyLow: number; buyHigh: number; trimLow: number; trimHigh: number; thesis: string; risk: string; source: string; refreshedAt: string; aiEnhanced: boolean };

function deterministic(ticker: string, quote: Awaited<ReturnType<typeof getQuote>>, excerpt: string, source: string, refreshedAt: string): Analysis {
  const covered = Boolean(excerpt);
  const base = quote.sma50 ?? quote.price * 0.9;
  const buyLow = Math.max(0.01, Math.min(base * 0.94, quote.price * 0.86));
  const buyHigh = Math.max(buyLow, Math.min(base * 1.03, quote.price * 0.94));
  const trimLow = Math.max(quote.price * 1.16, (quote.high1y ?? quote.price) * 0.98);
  const trimHigh = trimLow * 1.12;
  const extended = quote.sma50 ? quote.price > quote.sma50 * 1.18 : false;
  const stance = extended ? "Watch" : covered ? "Research / Accumulate" : "Research first";
  const thesisLine = excerpt.split("\n").find((line) => /\*\*Thesis|Latest stance|Tier/i.test(line))?.replace(/[*#]/g, "").trim();
  return { ticker, stance, confidence: covered ? (extended ? 66 : 76) : 48, buyLow, buyHigh, trimLow, trimHigh, thesis: thesisLine || (covered ? "Serenity has covered this name; review the refreshed excerpt and verify the current catalyst." : "No direct Serenity thesis was found. Apply the bottleneck checklist before considering an entry."), risk: extended ? "Price is materially above its 50-day average; avoid chasing and verify that the catalyst is not already priced." : "Re-check customer concentration, qualification, margins, dilution and whether the bottleneck has a qualified substitute.", source, refreshedAt, aiEnhanced: false };
}

async function enhanceWithAI(base: Analysis, ticker: string, quote: unknown, excerpt: string, methodology: string): Promise<Analysis> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return base;
  const prompt = `Analyze ${ticker} as decision support using Serenity's upstream AI supply-chain lens. Never issue an order and never claim certainty. Return strict JSON with stance, confidence (0-100), buyLow, buyHigh, trimLow, trimHigh, thesis, risk. Current quote: ${JSON.stringify(quote)}\nKnown thesis excerpt:\n${excerpt || "No direct coverage"}\nMethodology excerpt:\n${methodology.slice(0, 8000)}\nUse base zones as anchors: ${JSON.stringify(base)}.`;
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-5-mini", input: prompt, text: { format: { type: "json_object" } } }) });
  if (!response.ok) return base;
  const payload = await response.json() as any;
  const text = payload.output_text ?? payload.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === "output_text")?.text;
  if (!text) return base;
  try { return { ...base, ...JSON.parse(text), ticker, source: base.source, refreshedAt: base.refreshedAt, aiEnhanced: true }; } catch { return base; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticker?: string };
    const ticker = (body.ticker ?? "").toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
    if (!ticker) throw new Error("Enter a ticker to analyze.");
    const [quote, research] = await Promise.all([getQuote(ticker), loadResearch(new URL(request.url).origin)]);
    const excerpt = tickerExcerpt(research.theses, ticker);
    const base = deterministic(ticker, quote, excerpt, research.source, research.refreshedAt);
    const analysis = await enhanceWithAI(base, ticker, quote, excerpt, research.methodology);
    return Response.json({ quote, analysis, excerpt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Analysis failed." }, { status: 400 });
  }
}
