"use client";

import { FormEvent, useMemo, useState } from "react";

type Stock = { ticker:string; company:string; theme:string; stance:string; confidence:number; reference:number; buy:[number,number]|null; trim:[number,number]; thesis:string; risk:string; live?:boolean; changePercent?:number; sma50?:number|null; source?:string; refreshedAt?:string; aiEnhanced?:boolean };

const stocks: Stock[] = [
  { ticker:"AAOI",company:"Applied Optoelectronics",theme:"Photonics",stance:"Accumulate",confidence:88,reference:140.37,buy:[125,145],trim:[180,210],thesis:"U.S.-made 800G/1.6T transceivers with hyperscaler demand and a capacity ramp into 2027.",risk:"Execution, customer concentration and ATM dilution." },
  { ticker:"MSFT",company:"Microsoft",theme:"Hyperscaler",stance:"Accumulate",confidence:84,reference:482.11,buy:[430,455],trim:[535,560],thesis:"Azure and AI capex anchor demand across compute, memory, optical and power supply chains.",risk:"Heavy capex, slower cloud monetization and multiple compression." },
  { ticker:"SKHY",company:"SK hynix ADR",theme:"Memory / HBM",stance:"Accumulate",confidence:82,reference:155.77,buy:[135,145],trim:[185,195],thesis:"Direct exposure to constrained HBM and DRAM capacity in Serenity's strongest memory cycle.",risk:"ADR premium, Korean-market access and cyclical pricing reversal." },
  { ticker:"NBIS",company:"Nebius Group",theme:"Neocloud",stance:"Watch",confidence:85,reference:263.90,buy:[210,235],trim:[350,400],thesis:"High-quality financing, hyperscaler-backed contracts and stronger GAAP margins than neocloud peers.",risk:"Power delivery, buildout financing and post-gap valuation." },
  { ticker:"COHR",company:"Coherent",theme:"Photonics",stance:"Accumulate",confidence:80,reference:316.02,buy:[285,310],trim:[380,420],thesis:"A diversified, vertically integrated optical compounder with lower binary risk.",risk:"Less upside than pure plays and cyclical industrial exposure." },
  { ticker:"SPCX",company:"SpaceX",theme:"Space infrastructure",stance:"Watch",confidence:65,reference:143.39,buy:[110,125],trim:[180,210],thesis:"Frontier space infrastructure exposure, but not itself the upstream bottleneck Serenity usually prefers.",risk:"Short public history, IPO volatility and uncertain valuation anchors." },
  { ticker:"TSLA",company:"Tesla",theme:"Physical AI",stance:"Watch",confidence:58,reference:336.25,buy:[295,315],trim:[400,450],thesis:"Optimus can create new memory, sensor, actuator and materials supply chains.",risk:"Execution, valuation and suppliers being designed out." },
  { ticker:"DELL",company:"Dell Technologies",theme:"AI servers",stance:"Hold",confidence:55,reference:467.89,buy:[400,425],trim:[490,525],thesis:"Benefits from AI server demand, though it is downstream with less pricing power than chokepoint suppliers.",risk:"Thin hardware margins and a price near the upper end of its annual range." },
  { ticker:"AXTI",company:"AXT",theme:"InP substrates",stance:"Hold",confidence:76,reference:87.83,buy:null,trim:[95,110],thesis:"A real upstream InP bottleneck, but Serenity explicitly stopped treating it as a fresh entry after the rerating.",risk:"China export controls, binary policy risk and valuation." },
  { ticker:"PLTR",company:"Palantir",theme:"AI software",stance:"Avoid",confidence:36,reference:173.44,buy:null,trim:[170,190],thesis:"Does not fit the upstream bottleneck screen and carries a valuation/quality conflict in the corpus.",risk:"Narrative concentration and valuation compression." },
];
const money=(n:number)=>`$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;
const tone=(stance:string)=>stance.toLowerCase().includes("accumulate")?"accumulate":stance.toLowerCase().includes("avoid")?"avoid":"watch";

export default function Home(){
  const [query,setQuery]=useState(""); const [selected,setSelected]=useState(stocks[0]); const [price,setPrice]=useState(stocks[0].reference.toString());
  const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const [excerpt,setExcerpt]=useState("");
  const filtered=useMemo(()=>stocks.filter(s=>`${s.ticker} ${s.company} ${s.theme}`.toLowerCase().includes(query.toLowerCase())),[query]);
  const choose=(s:Stock)=>{setSelected(s);setPrice(s.reference.toString());setError("");setExcerpt("");};
  const livePrice=Number(price)||selected.reference;
  const zone=!selected.buy?"No fresh-entry zone":livePrice<selected.buy[0]?"Below accumulation zone":livePrice<=selected.buy[1]?"Inside accumulation zone":livePrice>=selected.trim[0]?"Inside trim zone":"Between buy and trim zones";
  async function analyze(event:FormEvent){event.preventDefault(); const ticker=query.trim().toUpperCase(); if(!ticker)return; setLoading(true);setError("");
    try{const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ticker})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Analysis failed.");
      const a=data.analysis,q=data.quote; const result:Stock={ticker:q.ticker,company:q.name,theme:"Live Serenity screen",stance:a.stance,confidence:a.confidence,reference:q.price,buy:[a.buyLow,a.buyHigh],trim:[a.trimLow,a.trimHigh],thesis:a.thesis,risk:a.risk,live:true,changePercent:q.changePercent,sma50:q.sma50,source:a.source,refreshedAt:a.refreshedAt,aiEnhanced:a.aiEnhanced}; choose(result);setExcerpt(data.excerpt||"");
    }catch(e){setError(e instanceof Error?e.message:"Analysis failed.");}finally{setLoading(false);}}
  return <main>
    <header className="masthead"><a className="brand" href="#top"><span>S</span> Serenity Lens</a><div className="status"><i/>Live research · Manual decisions only</div></header>
    <section id="top" className="hero"><div><p className="eyebrow">LIVE AI SUPPLY-CHAIN DECISION SUPPORT</p><h1>Find the bottleneck.<br/><em>Price the patience.</em></h1><p className="lede">Enter any public ticker. The app refreshes Serenity’s research, retrieves a live quote and builds disciplined valuation zones.</p></div><div className="hero-stat"><strong>6,327</strong><span>public posts bundled</span><small>GitHub refresh every 30 minutes</small></div></section>
    <section className="workspace"><aside className="watchlist">
      <form className="analyzer" onSubmit={analyze}><label htmlFor="ticker">ANALYZE ANY TICKER</label><div><input id="ticker" value={query} onChange={e=>setQuery(e.target.value)} placeholder="NVDA, MU, RKLB…"/><button disabled={loading}>{loading?"Working…":"Analyze"}</button></div>{error&&<p className="form-error">{error}</p>}</form>
      <div className="section-title"><span>Starter universe</span><b>{filtered.length} names</b></div><div className="stock-list">{filtered.map(s=><button key={s.ticker} onClick={()=>choose(s)} className={selected.ticker===s.ticker?"active":""}><span><strong>{s.ticker}</strong><small>{s.company}</small></span><span className={`pill ${tone(s.stance)}`}>{s.stance}</span></button>)}</div>
      <div className="research-links"><span>RESEARCH LIBRARY</span><a href="/research/references/theses.md" target="_blank">Theses</a><a href="/research/references/methodology.md" target="_blank">Methodology</a><a href="/research/data/aleabitoreddit_tweets.json" target="_blank">Tweet archive</a></div>
    </aside><article className="analysis-card">
      <div className="ticker-head"><div><p>{selected.theme}</p><h2>{selected.ticker}</h2><span>{selected.company}</span></div><div className="score"><strong>{Math.round(selected.confidence)}</strong><span>/ 100 lens fit</span></div></div>
      <div className="verdict"><span className={`signal ${tone(selected.stance)}`}>{selected.stance}</span><p>{zone}</p>{selected.live&&<span className="live-badge">● LIVE {selected.changePercent!==undefined&&`${selected.changePercent>=0?"+":""}${selected.changePercent.toFixed(2)}%`}</span>}</div>
      <div className="price-grid"><label><span>Current / scenario price</span><div className="price-input"><b>$</b><input aria-label="Current or scenario price" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></div></label><div><span>Staged buy zone</span><strong>{selected.buy?`${money(selected.buy[0])} — ${money(selected.buy[1])}`:"None"}</strong></div><div><span>Trim zone</span><strong>{money(selected.trim[0])} — {money(selected.trim[1])}</strong></div></div>
      {selected.live&&<div className="data-strip"><span>50D AVG <b>{selected.sma50?money(selected.sma50):"N/A"}</b></span><span>RESEARCH <b>{selected.source?.toUpperCase()}</b></span><span>ENGINE <b>{selected.aiEnhanced?"OPENAI + RULES":"SERENITY RULES"}</b></span><span>REFRESHED <b>{selected.refreshedAt?new Date(selected.refreshedAt).toLocaleTimeString():"NOW"}</b></span></div>}
      <div className="thesis-grid"><section><p className="label">THE BOTTLENECK READ</p><h3>{selected.thesis}</h3></section><section className="risk"><p className="label">PRIMARY INVALIDATION</p><h3>{selected.risk}</h3></section></div>
      {excerpt&&<details className="evidence"><summary>View refreshed Serenity evidence</summary><pre>{excerpt}</pre></details>}
      <div className="discipline"><span>Position discipline</span><p>Enter in 3 tranches across the zone. Re-check contracts, margins, capacity and dilution before each tranche.</p></div>
    </article></section>
    <footer><p>Decision-support only — not financial advice and never an automated trade.</p><p>Live quotes may be delayed. Confirm with your broker before acting.</p></footer>
  </main>;
}
