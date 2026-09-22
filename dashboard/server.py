"""Local, read-only dashboard API backed by the repository's research archive."""

from __future__ import annotations

import argparse
import json
import math
import re
import statistics
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from taiwan import parse_input, analyze_taiwan
from bullets import collect_bullets


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ARCHIVE = ROOT / "data" / "aleabitoreddit_tweets.json"
THESES = ROOT / "serenity-aleabitoreddit" / "references" / "theses.md"
HOST = "127.0.0.1"
PORT = 8765
MAX_SYMBOLS = 8
SYMBOL_RE = re.compile(r"^(?:[A-Z][A-Z0-9.^-]{0,11}|[0-9]{4,6}(?:\.(?:TW|TWO|5W))?|(?:TWSE|TW|TPEX|TWO|OTC):[0-9]{4,6})$")
MENTION_RE = re.compile(r"\$([A-Z][A-Z0-9.]{0,11})\b")
STATIC = {"/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/app.js": "app.js", "/extend.js": "extend.js", "/extend.css": "extend.css"}
INDEX = None
QUOTE_CACHE = {}


def base_symbol(symbol: str) -> str:
    return "SIVE" if symbol in {"SIVE.ST", "SIVEF"} else symbol.split(".", 1)[0]


def clean_markdown(value: str) -> str:
    value = re.sub(r"\[([^]]+)\]\(https?://[^)]+\)", r"\1", value)
    value = re.sub(r"[*`#]", "", value)
    value = re.sub(r"\s+", " ", value).strip(" -:;")
    return value


def load_index():
    global INDEX
    stamp = (ARCHIVE.stat().st_mtime_ns, THESES.stat().st_mtime_ns)
    if INDEX and INDEX["stamp"] == stamp:
        return INDEX
    posts = json.loads(ARCHIVE.read_text(encoding="utf-8"))
    by_symbol = defaultdict(list)
    archive_latest = ""
    for post in posts:
        when = post.get("createdAtISO") or ""
        archive_latest = max(archive_latest, when)
        text = post.get("text") or ""
        if not text or post.get("isRetweet"):
            continue
        for symbol in set(MENTION_RE.findall(text.upper())):
            by_symbol[symbol].append(post)
    for matches in by_symbol.values():
        matches.sort(key=lambda post: post.get("createdAtISO") or "", reverse=True)
    lines = THESES.read_text(encoding="utf-8").splitlines()
    INDEX = {"stamp": stamp, "posts": by_symbol, "all_posts": posts, "lines": lines, "latest": archive_latest[:10], "count": len(posts)}
    return INDEX


def thesis_section(symbol: str, lines: list[str]):
    escaped = re.escape(symbol)
    heading = re.compile(r"^(#{2,3})\s+\$?" + escaped + r"(?=\s|/|—|-|\(|$)", re.I)
    choices = []
    for start, line in enumerate(lines):
        hit = heading.match(line)
        if not hit:
            continue
        level = len(hit.group(1))
        end = start + 1
        while end < len(lines):
            next_heading = re.match(r"^(#{2,3})\s+", lines[end])
            if next_heading and len(next_heading.group(1)) <= level:
                break
            end += 1
        choices.append((level, line, lines[start + 1:end]))
    if not choices:
        return None
    _, heading_text, body = min(choices, key=lambda item: (item[0], -len(item[2])))
    bullets = collect_bullets(body)
    signal = bullets.get("latest signal") or bullets.get("thesis")
    context = bullets.get("context")
    if not signal:
        signal = next((line for line in body if line.startswith("- ")), "")
    return {
        "heading": clean_markdown(heading_text.lstrip("# ")),
        "signal": clean_markdown(signal)[:560],
        "context": clean_markdown(context or "")[:500],
    }


def theme_for(symbol: str, thesis: dict | None, posts: list[dict]):
    if symbol in {"NVDA", "AMD", "TSM", "AVGO", "INTC", "MRVL", "ALAB", "ASML"}:
        return ("SEMICONDUCTORS", "Which supply-chain layer has pricing power or few substitutes?", "Verify customer concentration, utilization, capex, and GAAP margins.", (0.20, 0.10, 0.20, 0.40))
    sample = (thesis["heading"] + " " + thesis["signal"]) if thesis else " ".join((p.get("text") or "")[:180] for p in posts[:3])
    sample = sample.lower()
    if any(word in sample for word in ("laser", "optical", "photon", "inp", "transceiver", "cpo")):
        return ("OPTICAL / PHOTONICS", "What component is scarce, and can qualified suppliers scale?", "Verify customer qualification, capacity, realized pricing, and dilution.", (0.25, 0.15, 0.25, 0.55))
    if any(word in sample for word in ("hbm", "dram", "nand", "memory", "ssd")):
        return ("MEMORY / STORAGE", "Is supply disciplined enough for pricing power to persist?", "Verify contract pricing, inventory, bit supply, and GAAP margins.", (0.18, 0.10, 0.20, 0.40))
    if any(word in sample for word in ("neocloud", "gpu cloud", "datacenter", "data center", "megawatt", "power")):
        return ("AI INFRASTRUCTURE", "Can signed demand become delivered, financed capacity?", "Verify customer commitments, power delivery, financing quality, and dilution.", (0.30, 0.18, 0.30, 0.65))
    if any(word in sample for word in ("semiconductor", "foundry", "wafer", "chip", "asic", "gpu")):
        return ("SEMICONDUCTORS", "Which supply-chain layer has pricing power or few substitutes?", "Verify customer concentration, utilization, capex, and GAAP margins.", (0.20, 0.10, 0.20, 0.40))
    return ("RESEARCH CHECKLIST", "What breaks downstream if this company cannot deliver?", "Verify signed demand, alternatives, margins, cash needs, and valuation.", (0.20, 0.10, 0.20, 0.40))


def quote_for(symbol: str):
    cached = QUOTE_CACHE.get(symbol)
    if cached and time.monotonic() - cached[0] < 90:
        return cached[1]
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(symbol, safe="") + "?interval=1d&range=3mo"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SerenityResearchDashboard/1.0"})
    with urllib.request.urlopen(request, timeout=12) as response:
        chart = json.load(response)["chart"]["result"][0]
    meta = chart["meta"]
    price = meta.get("regularMarketPrice")
    if price is None or not math.isfinite(float(price)) or float(price) <= 0:
        raise ValueError("No usable market price returned")
    result = {
        "price": round(float(price), 2),
        "symbol": meta.get("symbol") or symbol,
        "exchangeName": meta.get("exchangeName"),
        "currency": meta.get("currency") or "USD",
        "name": meta.get("longName") or meta.get("shortName") or symbol,
        "priceTime": datetime.fromtimestamp(meta["regularMarketTime"], timezone.utc).isoformat() if meta.get("regularMarketTime") else None,
        "quoteUrl": "https://finance.yahoo.com/quote/" + urllib.parse.quote(symbol, safe="") + "/",
    }
    QUOTE_CACHE[symbol] = (time.monotonic(), result)
    return result


def analyze(symbol: str, index: dict):
    if parse_input(symbol):
        return analyze_taiwan(symbol, index, quote_for, thesis_section, theme_for)
    archive_symbol = base_symbol(symbol)
    posts = index["posts"].get(archive_symbol, [])
    thesis = thesis_section(archive_symbol, index["lines"])
    category, question, risk, bands = theme_for(symbol, thesis, posts)
    coverage = "thesis" if thesis else "mentions" if posts else "none"
    recent = []
    for post in posts[:3]:
        post_id = str(post.get("id") or "")
        recent.append({
            "date": (post.get("createdAtISO") or "")[:10],
            "text": re.sub(r"\s+", " ", post.get("text") or "").strip()[:320],
            "url": "https://x.com/aleabitoreddit/status/" + post_id if post_id.isdigit() else None,
        })
    try:
        quote = quote_for(symbol)
        quote_error = None
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError, OSError) as exc:
        quote = None
        quote_error = "Quote unavailable; check the ticker or retry later."
    ranges = None
    if quote and coverage != "none":
        price = quote["price"]
        ranges = {
            "buy": [round(price * (1 - bands[0]), 2), round(price * (1 - bands[1]), 2)],
            "sell": [round(price * (1 + bands[2]), 2), round(price * (1 + bands[3]), 2)],
            "method": "Mechanical category bands around the current quote; not a valuation or Serenity price target.",
        }
    return {
        "symbol": symbol,
        "coverage": coverage,
        "category": category,
        "thesis": thesis,
        "bottleneckQuestion": question,
        "riskChecks": risk,
        "mentionCount": len(posts),
        "latestMention": recent[0]["date"] if recent else None,
        "posts": recent,
        "quote": quote,
        "quoteError": quote_error,
        "ranges": ranges,
        "archiveUpdatedThrough": index["latest"],
    }


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "null")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/api/health":
            index = load_index()
            return self.send_json({"ok": True, "archivePosts": index["count"], "archiveUpdatedThrough": index["latest"]})
        if parsed.path == "/api/analyze":
            raw = urllib.parse.parse_qs(parsed.query).get("symbols", [""])[0]
            symbols = list(dict.fromkeys(s.strip().upper() for s in re.split(r"[,\s]+", raw) if s.strip()))
            if not symbols or len(symbols) > MAX_SYMBOLS or any(not SYMBOL_RE.fullmatch(s) for s in symbols):
                return self.send_json({"error": "Enter 1–8 valid ticker symbols, separated by commas."}, 400)
            index = load_index()
            return self.send_json({"results": [analyze(s, index) for s in symbols], "archivePosts": index["count"], "archiveUpdatedThrough": index["latest"]})
        name = STATIC.get(parsed.path)
        if not name:
            return self.send_json({"error": "Not found"}, 404)
        body = (HERE / name).read_bytes()
        content_type = "text/html" if name.endswith(".html") else "text/css" if name.endswith(".css") else "text/javascript"
        self.send_response(200)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--open", action="store_true", help="Open the dashboard in Chrome")
    args = parser.parse_args()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    if args.open:
        chrome = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
        if chrome.exists():
            threading.Timer(0.4, lambda: subprocess.Popen([str(chrome), "--new-window", f"http://{HOST}:{PORT}/"])).start()
    print(f"Dashboard: http://{HOST}:{PORT}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
