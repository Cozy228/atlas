// Throttled SPA tab-switch cost: load /, then client-nav to /availability, measure.
const TARGET_WS = process.argv[2];
const BASE = process.argv[3] || "http://localhost:3200";
const ws = new WebSocket(TARGET_WS);
let id = 0; const pending = new Map();
function send(m, p = {}) { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p })); return new Promise((res, rej) => pending.set(i, { res, rej })); }
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const x = pending.get(m.id); pending.delete(m.id); if (m.error) x.rej(new Error(m.error.message)); else x.res(m.result); } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); return r.result.value; };
await new Promise((r) => ws.addEventListener("open", r));
await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
await send("Emulation.setCPUThrottlingRate", { rate: 6 });
await send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: Math.round((400 * 1024) / 8), uploadThroughput: Math.round((400 * 1024) / 8) });

// warm-load home
await send("Page.navigate", { url: BASE + "/" });
await sleep(9000);
// install a long-task observer + start timer, then SPA-click the Availability nav link
await evalJs(`(()=>{ window.__sw={start:performance.now(),lt:0,ltc:0};
  try{new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__sw.lt+=e.duration;window.__sw.ltc++}}).observe({type:'longtask'});}catch(e){}
  const a=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')==='/availability');
  if(a) a.click(); else window.__sw.err='no-link';
  return 'clicked';})()`);
// poll up to 20s for the matrix (table) to appear on /availability
let res = { elapsed: -1, longtasks: 0, ltc: 0 };
for (let i = 0; i < 40; i++) {
  await sleep(500);
  const r = await evalJs(`(()=>{ const onAvail=location.pathname==='/availability';
    const matrix=document.querySelector('table, [role="grid"], [role="table"]');
    if(onAvail && matrix && window.__sw && !window.__sw.done){ window.__sw.done=1; window.__sw.elapsed=Math.round(performance.now()-window.__sw.start); }
    return JSON.stringify({done:!!(window.__sw&&window.__sw.done), elapsed:window.__sw?.elapsed??-1, lt:Math.round(window.__sw?.lt??0), ltc:window.__sw?.ltc??0, path:location.pathname}); })()`);
  const o = JSON.parse(r);
  if (o.done) { res = { elapsed: o.elapsed, longtasks: o.lt, ltc: o.ltc, path: o.path }; break; }
}
// let long-tasks settle a beat more, re-read total
await sleep(1500);
const fin = JSON.parse(await evalJs(`JSON.stringify({lt:Math.round(window.__sw?.lt??0),ltc:window.__sw?.ltc??0})`));
console.log(`TAB SWITCH (throttled) /  ->  /availability`);
console.log(`  time-to-matrix: ${res.elapsed}ms | main-thread blocking (long-tasks) during switch: ${fin.lt}ms across ${fin.ltc} tasks`);
ws.close();
