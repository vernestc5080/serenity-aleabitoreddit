const RAW_BASE = "https://raw.githubusercontent.com/vernestc5080/serenity-aleabitoreddit/main/serenity-aleabitoreddit/references";

export type ResearchBundle = {
  methodology: string;
  theses: string;
  trackRecord: string;
  articles: string;
  source: "github" | "bundled";
  refreshedAt: string;
};

async function readRemote(name: string): Promise<string> {
  const response = await fetch(`${RAW_BASE}/${name}`, {
    headers: { "User-Agent": "Serenity-Investment-Lens/1.0" },
    next: { revalidate: 1800 },
  });
  if (!response.ok) throw new Error(`Research refresh failed (${response.status})`);
  return response.text();
}

export async function loadResearch(origin?: string): Promise<ResearchBundle> {
  try {
    const [methodology, theses, trackRecord, articles] = await Promise.all([
      readRemote("methodology.md"), readRemote("theses.md"),
      readRemote("track-record.md"), readRemote("articles.md"),
    ]);
    return { methodology, theses, trackRecord, articles, source: "github", refreshedAt: new Date().toISOString() };
  } catch (error) {
    if (!origin) throw error;
    const names = ["methodology", "theses", "track-record", "articles"] as const;
    const texts = await Promise.all(names.map(async (name) => {
      const response = await fetch(`${origin}/research/references/${name}.md`);
      if (!response.ok) throw error;
      return response.text();
    }));
    return { methodology: texts[0], theses: texts[1], trackRecord: texts[2], articles: texts[3], source: "bundled", refreshedAt: new Date().toISOString() };
  }
}

export function tickerExcerpt(markdown: string, ticker: string): string {
  const safe = ticker.replace(/[^A-Z0-9.-]/g, "");
  const heading = new RegExp(`^###\\s+[^\\n]*(?:\\$)?${safe}(?=\\s|\\/|\\(|—|-|$)[^\\n]*$`, "im");
  const match = heading.exec(markdown);
  if (!match) return "";
  const rest = markdown.slice(match.index);
  const next = rest.slice(match[0].length).search(/^###\s+/m);
  return (next < 0 ? rest : rest.slice(0, match[0].length + next)).slice(0, 12000);
}
