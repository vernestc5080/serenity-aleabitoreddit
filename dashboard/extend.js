// Adds archive-backed ticker research to the original curated watchlist.
const lookupForm = document.getElementById('search-form');
const lookupInput = document.getElementById('ticker-input');
const customResults = document.createElement('div');
customResults.className = 'custom-results';
customResults.hidden = true;
lookupForm.after(customResults);

const lookupStatus = document.createElement('p');
lookupStatus.className = 'lookup-status';
lookupStatus.setAttribute('role', 'status');
lookupStatus.textContent = 'Use US tickers or Taiwan codes (2330, 3105.TWO, TWSE:3231).';
lookupForm.append(lookupStatus);
lookupInput.placeholder = 'NVDA, 2330, 3105.TWO...';

const archiveNotes = document.createElement('section');
archiveNotes.className = 'archive-notes';
archiveNotes.hidden = true;
document.querySelector('.bottom-strip').after(archiveNotes);

let lookupResults = [];
const customMoney = (value, currency = 'USD') => {
  if (value == null) return '—';
  const digits = value < 10 ? 2 : 2;
  const amount = Number(value).toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
  return currency === 'USD' ? `$${amount}` : `${currency} ${amount}`;
};
const customRange = (values, currency) => values ? `${customMoney(values[0], currency)}–${customMoney(values[1], currency).replace(currency === 'USD' ? '$' : `${currency} `, '')}` : '—';
const field = id => document.getElementById(id);

function showArchiveNotes(result) {
  archiveNotes.replaceChildren();
  archiveNotes.hidden = false;
  const heading = document.createElement('div');
  heading.className = 'archive-heading';
  heading.textContent = `03 / ARCHIVED POSTS · ${result.mentionCount} DIRECT MENTIONS`;
  archiveNotes.append(heading);
  if (!result.posts.length) {
    const message = document.createElement('p');
    message.textContent = 'No direct $ticker mentions were found in this archive. Use the research checklist above and verify the company independently.';
    archiveNotes.append(message);
    return;
  }
  for (const post of result.posts) {
    const article = document.createElement('article');
    article.className = 'archive-post';
    const text = document.createElement('p');
    text.textContent = post.text + (post.text.length >= 320 ? '…' : '');
    article.append(text);
    if (post.url) {
      const link = document.createElement('a');
      link.href = post.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${post.date} · VIEW POST ↗`;
      article.append(link);
    }
    archiveNotes.append(article);
  }
}

function showLookup(result) {
  const quote = result.quote;
  const bands = result.ranges;
  const coverage = result.coverage;
  field('category').textContent = result.category;
  field('rank-tag').textContent = coverage === 'thesis' ? 'PROJECT THESIS' : coverage === 'mentions' ? 'ARCHIVE MENTIONS' : 'CHECKLIST ONLY';
  field('ticker').textContent = result.symbol;
  field('company').textContent = quote?.name || 'Company name unavailable';
  field('current-price').textContent = quote ? customMoney(quote.price, quote.currency) : '—';
  field('price-time').textContent = quote?.priceTime ? `QUOTE · ${new Date(quote.priceTime).toLocaleString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', timeZone:quote.currency === 'TWD' ? 'Asia/Taipei' : 'America/New_York'})} ${quote.currency === 'TWD' ? 'Taipei' : 'ET'}` : 'QUOTE UNAVAILABLE';
  field('buy-range').textContent = bands ? customRange(bands.buy, quote.currency) : '—';
  field('sell-range').textContent = bands ? customRange(bands.sell, quote.currency) : '—';
  field('upside').textContent = bands ? `+${Math.round((bands.sell[0] / quote.price - 1) * 100)}%–${Math.round((bands.sell[1] / quote.price - 1) * 100)}%` : '—';
  document.querySelector('#buy-range + small').textContent = bands ? 'Illustrative pullback band' : 'Insufficient coverage or quote';
  document.querySelector('#sell-range + small').textContent = bands ? 'Illustrative upside band' : 'No project-supported target';
  document.querySelector('#upside + small').textContent = bands ? 'Mechanical, not a forecast' : 'Awaiting research';
  document.querySelector('.pill').textContent = 'LENS QUESTION';
  field('short-thesis').textContent = result.bottleneckQuestion;
  field('stage').textContent = `${result.mentionCount} ARCHIVED MENTIONS`;
  field('case-text').textContent = result.thesis?.signal || (result.posts.length ? `No dedicated thesis section. Recent archived post: ${result.posts[0].text.slice(0, 360)}` : 'This ticker is not covered in the project archive. Map the supply chain, identify substitutes, and establish a stock-specific thesis before considering an entry.');
  field('risk-text').textContent = `${result.thesis?.context ? result.thesis.context + ' ' : ''}${result.riskChecks}`;
  field('evidence-text').textContent = `Archive through ${result.archiveUpdatedThrough || 'unknown date'}; ${result.mentionCount} direct non-retweet mentions. ${bands ? bands.method : 'No price band was generated.'}${result.quoteError ? ' ' + result.quoteError : ''}`;
  if (result.recommendation?.note) field('evidence-text').textContent = result.recommendation.note + ' ' + field('evidence-text').textContent;
  if (result.archiveMatch) field('evidence-text').textContent += ' ' + result.archiveMatch;
  const sourceLink = field('source-link');
  sourceLink.hidden = !quote;
  if (quote) sourceLink.href = quote.quoteUrl;
  showArchiveNotes(result);
  customResults.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.symbol === result.symbol)));
}

function showResultButtons() {
  customResults.replaceChildren();
  customResults.hidden = !lookupResults.length;
  if (!lookupResults.length) return;
  const title = document.createElement('div');
  title.className = 'custom-heading';
  title.textContent = `LOOKUP RESULTS / ${lookupResults.length}`;
  customResults.append(title);
  for (const result of lookupResults) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.symbol = result.symbol;
    button.className = 'custom-stock';
    button.setAttribute('aria-pressed', 'false');
    const name = document.createElement('span');
    name.textContent = result.symbol;
    const price = document.createElement('small');
    price.textContent = result.quote ? customMoney(result.quote.price, result.quote.currency) : 'Quote unavailable';
    button.append(name, price);
    button.addEventListener('click', () => showLookup(result));
    customResults.append(button);
  }
}

// Capture these events before the original ten-stock-only search handler.
lookupInput.addEventListener('input', event => event.stopImmediatePropagation(), true);
lookupForm.addEventListener('submit', async event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const symbols = [...new Set(lookupInput.value.toUpperCase().split(/[\s,]+/).filter(Boolean))];
  if (!symbols.length || symbols.length > 8 || symbols.some(symbol => !/^(?:[A-Z][A-Z0-9.^-]{0,11}|[0-9]{4,6}(?:\.(?:TW|TWO|5W))?|(?:TWSE|TW|TPEX|TWO|OTC):[0-9]{4,6})$/.test(symbol))) {
    lookupStatus.textContent = 'Enter 1–8 valid ticker symbols, separated by commas.';
    return;
  }
  lookupStatus.textContent = `Researching ${symbols.join(', ')}…`;
  try {
    const response = await fetch(`http://127.0.0.1:8765/api/analyze?symbols=${encodeURIComponent(symbols.join(','))}`, {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Research lookup failed.');
    lookupResults = data.results;
    showResultButtons();
    showLookup(lookupResults[0]);
    lookupStatus.textContent = `${lookupResults.length} result${lookupResults.length === 1 ? '' : 's'} · archive through ${data.archiveUpdatedThrough || 'unknown date'}`;
  } catch (error) {
    lookupStatus.textContent = `Lookup unavailable: ${error.message}. Start dashboard/server.py to enable archive search.`;
  }
}, true);

document.getElementById('stock-list').addEventListener('click', () => {
  lookupInput.value = '';
  archiveNotes.hidden = true;
  document.querySelector('.pill').textContent = 'THE BOTTLENECK';
  field('price-time').textContent = 'SEP 18, 2026 · INTRADAY SNAPSHOT';
  document.querySelector('#buy-range + small').textContent = 'Proposed pullback zone';
  document.querySelector('#sell-range + small').textContent = 'Illustrative 1–3 year exit';
  document.querySelector('#upside + small').textContent = 'From snapshot price';
  field('source-link').hidden = false;
  customResults.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', 'false'));
}, true);

// Allow a saved ticker list to open directly from a dashboard link.
const initialSymbols = new URLSearchParams(window.location.search).get('symbols');
if (initialSymbols) {
  lookupInput.value = initialSymbols;
  lookupForm.requestSubmit();
}
