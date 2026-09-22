const stocks = [
  {symbol:'TSM',name:'Taiwan Semiconductor',category:'FOUNDRY / ADVANCED CHIPS',price:429.70,buy:[378,408],sell:[515,580],bottleneck:'Leading-edge foundry capacity',stage:'CAPACITY / PRICING',caseText:'AI accelerators depend on advanced wafer capacity and packaging. Demand and pricing power need to keep converting into revenue and cash flow.',riskText:'Large capital spending, geopolitics, or a slower AI buildout could compress returns even if fabrication remains strategically vital.',evidence:'Track monthly revenue, advanced-node utilization, capital spending, and packaging capacity.'},
  {symbol:'MU',name:'Micron Technology',category:'MEMORY / HBM',price:991.42,buy:[843,912],sell:[1190,1390],bottleneck:'High-bandwidth memory supply',stage:'MEMORY CYCLE',caseText:'AI systems need more memory per accelerator. Sustained HBM demand and disciplined industry supply could support stronger margins.',riskText:'Memory is cyclical. New capacity, weaker pricing, or a delayed product ramp can quickly change the earnings outlook.',evidence:'Track HBM supply commitments, DRAM pricing, inventory, and gross margin.'},
  {symbol:'COHR',name:'Coherent Corp.',category:'OPTICAL / PHOTONICS',price:308.43,buy:[253,278],sell:[385,463],bottleneck:'Laser and optical component capacity',stage:'BACKLOG CONVERSION',caseText:'Faster data-center networks require more optical components. The case depends on booked demand becoming profitable shipments.',riskText:'Customer concentration, capacity expansion costs, or a slower optical transition could weaken the expected payoff.',evidence:'Track datacenter revenue, laser output, backlog quality, and CPO timing.'},
  {symbol:'LITE',name:'Lumentum Holdings',category:'OPTICAL / PHOTONICS',price:906.39,buy:[727,818],sell:[1135,1405],bottleneck:'High-performance optical lasers',stage:'DEMAND / SCALE',caseText:'AI network upgrades need faster optical links. The opportunity rests on laser supply and manufacturing scale meeting demand.',riskText:'A fast price run can outrun execution. Watch margins, customer timing, and whether capacity can scale without costly delays.',evidence:'Track cloud networking revenue, orders, gross margin, and laser capacity.'},
  {symbol:'AVGO',name:'Broadcom Inc.',category:'CUSTOM SILICON / NETWORKING',price:354.75,buy:[305,333],sell:[425,495],bottleneck:'Custom AI silicon and network fabric',stage:'CUSTOMER SPEND',caseText:'Broadcom supplies chips and networking that large AI clusters need. Continued customer investment must support growth across both businesses.',riskText:'Concentrated customers, product mix, and valuation sensitivity create risk if hyperscaler spending slows.',evidence:'Track AI semiconductor revenue, networking demand, and customer concentration.'},
  {symbol:'TSEM',name:'Tower Semiconductor',category:'SILICON PHOTONICS / FOUNDRY',price:223.36,buy:[179,201],sell:[280,345],bottleneck:'Specialty foundry capacity',stage:'RAMP / UTILIZATION',caseText:'Specialty manufacturing can benefit as optical and RF components scale. Higher utilization needs to translate into durable cash flow.',riskText:'A delayed photonics ramp or expensive capacity additions could leave the stock ahead of near-term earnings.',evidence:'Track silicon-photonics revenue, utilization, new capacity, and customer ramps.'},
  {symbol:'SNDK',name:'SanDisk Corp.',category:'MEMORY / NAND',price:1732.86,buy:[1300,1473],sell:[2165,2685],bottleneck:'NAND supply and pricing',stage:'CYCLE / PRICING',caseText:'Storage demand may benefit from AI infrastructure and constrained NAND supply. Pricing durability matters more than a single strong quarter.',riskText:'NAND supply can return quickly. A pricing reversal or inventory build could sharply reduce expected margins.',evidence:'Track NAND pricing, bit growth, inventory, and free cash flow.'},
  {symbol:'NBIS',name:'Nebius Group',category:'AI INFRASTRUCTURE / NEOCLOUD',price:217.39,buy:[163,185],sell:[283,370],bottleneck:'Power-ready AI compute capacity',stage:'BUILDOUT / FINANCING',caseText:'Demand for AI compute is strong. Contracts, power delivery, and utilization must grow fast enough to justify construction spending.',riskText:'Capital needs, dilution, financing terms, or delayed power and GPU delivery could overwhelm revenue growth.',evidence:'Track contracted capacity, customer commitments, cash needs, and delivered megawatts.'},
  {symbol:'AAOI',name:'Applied Optoelectronics, Inc.',category:'OPTICAL / TRANSCEIVERS',price:100.46,buy:[65,80],sell:[136,181],bottleneck:'Optical transceiver capacity',stage:'CAPACITY EXECUTION',caseText:'Demand for faster optical links may outstrip supply. The thesis needs announced capacity to become delivered units at attractive margins.',riskText:'Expansion delays, changing average selling prices, customer concentration, or dilution could erode the expected upside.',evidence:'Track 800G/1.6T shipments, capacity ramp, gross margin, and funding needs.'},
  {symbol:'SIVE.ST',name:'Sivers Semiconductors',category:'OPTICAL / CW LASERS',price:31,buy:[20,25],sell:[42,56],bottleneck:'Merchant continuous-wave lasers',stage:'CUSTOMER CONVERSION',caseText:'Sivers could supply scarce laser components to the optical ecosystem. Qualification and committed demand must become recurring revenue.',riskText:'The pipeline is not booked revenue. Qualification delays, scaling costs, and financing needs make this the most speculative name in the list.',evidence:'Track customer qualification, volume orders, production yield, cash runway, and dilution.',currency:'SEK'}
];

const $ = (id) => document.getElementById(id);
const list = $('stock-list');
const search = $('ticker-input');
let selected = 'AAOI';
const money = (value, currency) => `${currency === 'SEK' ? 'SEK ' : '$'}${Number(value).toLocaleString('en-US', {maximumFractionDigits: Number.isInteger(value) ? 0 : 2, minimumFractionDigits: Number.isInteger(value) ? 0 : 2})}`;
const range = (values, currency) => `${money(values[0], currency)}–${money(values[1], currency).replace(currency === 'SEK' ? 'SEK ' : '$','')}`;

function renderList(filter = '') {
  const query = filter.trim().toLowerCase();
  const filtered = stocks.filter(s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));
  list.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = 'No match in this ten-stock watchlist.';
    list.append(empty);
    return;
  }
  filtered.forEach(s => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `stock-item${selected === s.symbol ? ' active' : ''}`;
    item.setAttribute('aria-pressed', String(selected === s.symbol));
    item.innerHTML = `<span class="stock-rank">${String(stocks.indexOf(s) + 1).padStart(2,'0')}</span><span class="stock-name"><strong>${s.symbol}</strong><small>${s.name}</small></span><span class="stock-price">${money(s.price,s.currency)}</span>`;
    item.addEventListener('click', () => selectStock(s.symbol));
    list.append(item);
  });
}

function selectStock(symbol) {
  const s = stocks.find(item => item.symbol === symbol);
  if (!s) return;
  selected = symbol;
  $('category').textContent = s.category;
  $('rank-tag').textContent = `RANK ${String(stocks.indexOf(s) + 1).padStart(2,'0')} / 10`;
  $('ticker').textContent = s.symbol;
  $('company').textContent = s.name;
  $('current-price').textContent = money(s.price,s.currency);
  $('buy-range').textContent = range(s.buy,s.currency);
  $('sell-range').textContent = range(s.sell,s.currency);
  $('upside').textContent = `+${Math.round((s.sell[0]/s.price-1)*100)}%–${Math.round((s.sell[1]/s.price-1)*100)}%`;
  $('short-thesis').textContent = s.bottleneck;
  $('stage').textContent = s.stage;
  $('case-text').textContent = s.caseText;
  $('risk-text').textContent = s.riskText;
  $('evidence-text').textContent = s.evidence;
  $('source-link').href = `https://finance.yahoo.com/quote/${encodeURIComponent(s.symbol)}/`;
  renderList(search.value);
}

search.addEventListener('input', () => renderList(search.value));
$('search-form').addEventListener('submit', event => {
  event.preventDefault();
  const query = search.value.trim().toLowerCase();
  const match = stocks.find(s => s.symbol.toLowerCase() === query) || stocks.find(s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));
  if (match) selectStock(match.symbol);
  else renderList(query);
});
selectStock(selected);
