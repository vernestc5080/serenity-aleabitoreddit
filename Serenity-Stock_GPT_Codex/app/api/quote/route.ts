import { getQuote } from "../../../lib/quote";

export async function GET(request: Request) {
  try {
    const ticker = new URL(request.url).searchParams.get("ticker") ?? "";
    return Response.json(await getQuote(ticker), { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "CDN-Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Quote request failed." }, { status: 400 });
  }
}
