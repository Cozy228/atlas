// Raw-CDP throttled measurement: CPU 6x + Slow 4G, cold-load metrics per route.
// Usage: node cdp-throttle-measure.mjs <pageWsUrl> <baseUrl>
const TARGET_WS = process.argv[2];
const BASE = process.argv[3] || "http://localhost:3200";
const ROUTES = ["/", "/catalog", "/availability", "/guidance"];

const ws = new WebSocket(TARGET_WS);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => pending.set(i, { res, rej }));
}
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await new Promise((r) => ws.addEventListener("open", r));

await send("Page.enable");
await send("Network.enable");
await send("Runtime.enable");
// --- THROTTLE: low-spec Windows (CPU 6x) + slow proxied link (Slow 4G ~400Kbps/400ms) ---
await send("Emulation.setCPUThrottlingRate", { rate: 6 });
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 400,
  downloadThroughput: Math.round((400 * 1024) / 8),
  uploadThroughput: Math.round((400 * 1024) / 8),
});
// Install perf observers on every fresh document (runs before page scripts).
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__perf = { lcp: 0, fcp: 0, longtasks: 0, longtaskCount: 0, cls: 0 };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; })
      .observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__perf.fcp = e.startTime; })
      .observe({ type: "paint", buffered: true }); } catch (e) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__perf.longtasks += e.duration; window.__perf.longtaskCount++; } })
      .observe({ type: "longtask", buffered: true }); } catch (e) {}
  `,
});

async function measure(path) {
  await send("Page.navigate", { url: BASE + path });
  await sleep(9000); // throttled loads are slow; let LCP + longtasks settle
  const res = await send("Runtime.evaluate", {
    expression: `JSON.stringify({ ...window.__perf, nav: (() => { const n = performance.getEntriesByType("navigation")[0] || {}; return { ttfb: Math.round(n.responseStart||0), dcl: Math.round(n.domContentLoadedEventEnd||0), load: Math.round(n.loadEventEnd||0) }; })() })`,
    returnByValue: true,
  });
  return JSON.parse(res.result.value);
}

console.log("ROUTE        FCP     LCP     TTFB    DCL     load    TBT(longtasks)");
for (const p of ROUTES) {
  try {
    const m = await measure(p);
    const f = (n) => String(Math.round(n)).padStart(5) + "ms";
    console.log(
      `${p.padEnd(12)} ${f(m.fcp)} ${f(m.lcp)} ${f(m.nav.ttfb)} ${f(m.nav.dcl)} ${f(m.nav.load)}  ${Math.round(m.longtasks)}ms (${m.longtaskCount} tasks)`,
    );
  } catch (e) {
    console.log(`${p.padEnd(12)} ERROR: ${e.message}`);
  }
}
ws.close();
