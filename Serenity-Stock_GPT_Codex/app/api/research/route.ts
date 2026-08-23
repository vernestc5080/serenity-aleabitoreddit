import { loadResearch, tickerExcerpt } from "../../../lib/research";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ticker = (url.searchParams.get("ticker") ?? "").toUpperCase();
    const bundle = await loadResearch(url.origin);
    return Response.json({ source: bundle.source, refreshedAt: bundle.refreshedAt, ticker, excerpt: ticker ? tickerExcerpt(bundle.theses, ticker) : "", files: ["methodology.md", "theses.md", "articles.md", "track-record.md"] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Research refresh failed." }, { status: 502 });
  }
}
