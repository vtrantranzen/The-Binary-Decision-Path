/* The Binary Path — Decision Cockpit
   Compiled from binary-path-cockpit.jsx (Babel, classic runtime).
   React/ReactDOM are UMD globals; icons come from LucideReact (local icons.js). */
const { useState, useRef, useEffect } = React;
const { Compass, Pause, Play, CornerUpLeft, Check, Pencil, Plus, X, ArrowDownRight, Circle, Lock, Users, Share2, Info, ChevronRight, Anchor, RefreshCw, KeyRound, Sparkles, Download } = LucideReact;

/* ------------------------------------------------------------------ *
 *  THE BINARY PATH — Decision Cockpit
 *  A solo rehearsal instrument. The AI is co-pilot: it enumerates,
 *  arranges, and polices the process. The pilot alone names, weighs,
 *  and decides. Built on "The Binary Decision Path".
 * ------------------------------------------------------------------ */

/* ---- instrument palette (warm analog dashboard, dusk-lit) --------- */
const C = {
  field: "#1A1A16",
  // deep warm umber field
  panel: "#212019",
  // raised instrument surface
  panel2: "#282619",
  // input wells
  ivory: "#ECE6D4",
  // aged ivory readout
  dim: "#9A937E" // secondary readout
};
C.faint = "#6E6858"; // tertiary
C.line = "#39362B"; // etched tick / rule
C.gold = "#D8A94C"; // committed path — instrument amber
C.goldDim = "#8C6C2C";
C.goldWell = "#2C2617";
C.teal = "#54A79C"; // parked — instrument teal
C.tealDim = "#2E5A54";
C.tealWell = "#182421";
C.slate = "#7C776A"; // contingent
C.alert = "#CE7148"; // co-pilot process flag

const DIAL = {
  min: 0,
  max: 100
};

/* ---- AI enumeration buckets (heuristic stand-in for the room) ----- */
const BUCKETS = [{
  k: ["profit", "bottom line", "bottom-line", "margin", "earnings"],
  items: ["Pricing", "Headcount", "New product line", "Supply contracts", "Marketing spend", "Underperforming region", "Customer retention", "Sales volume", "Operating overhead", "Financing cost"]
}, {
  k: ["revenue", "grow", "growth", "sales", "customers", "market"],
  items: ["Existing customers", "New customers", "Price per sale", "Sales volume", "Product range", "New markets", "Marketing reach", "Retention", "Distribution channels", "Brand strength"]
}, {
  k: ["job", "career", "quit", "leave", "role", "work", "boss", "promotion"],
  items: ["Growth & learning", "Compensation", "Location", "Family impact", "Ambition", "Fear of change", "Manager relationship", "Work that challenges me", "Security", "Status & title"]
}, {
  k: ["health", "fitness", "weight", "diet", "sleep", "stress"],
  items: ["Daily habits", "Environment", "Sleep", "Stress load", "What I eat", "Movement", "Access to care", "Support network"]
}, {
  k: ["move", "relocate", "city", "house", "home"],
  items: ["Cost of living", "Career options", "Proximity to family", "Climate & place", "Community", "Housing", "Commute", "Long-term roots"]
}];
const DEFAULT_ITEMS = ["What we already do", "Something new", "Money", "Time & effort", "People involved", "Risk exposure", "Short-term payoff", "Long-term payoff", "Internal factors", "External factors"];
let _cid = 1;
const nid = () => `c${_cid++}`;
let _nid = 1;
const newNodeId = () => `n${_nid++}`;
function suggestFor(question, dial) {
  const q = (question || "").toLowerCase();
  let items = DEFAULT_ITEMS;
  for (const b of BUCKETS) {
    if (b.k.some(w => q.includes(w))) {
      items = b.items;
      break;
    }
  }
  const count = Math.round(5 + dial / 100 * 4); // 5 (personal) .. 9 (research)
  return items.slice(0, count).map(t => ({
    id: nid(),
    text: t,
    source: "ai",
    tag: null
  }));
}

/* ---- live enumeration via Gemini ---------------------------------- *
 *  The co-pilot rule holds: the model ENUMERATES only. It does not
 *  rank, weigh, group, or recommend. Order is stripped by shuffling,
 *  so nothing it returns can smuggle in an implicit weight. On any
 *  failure — offline, no key, bad key — we fall back to the on-device
 *  heuristic so the instrument never goes dark.
 * ------------------------------------------------------------------ */
const LS = {
  key: "bp_gemini_key",
  paid: "bp_gemini_paid",
  live: "bp_live_on",
  priv: "bp_free_in_private",
  model: "bp_gemini_model"
};
const GEM_HOST = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_OK = "bp_gemini_model_ok"; // last model that actually worked
const MODEL_PREFER = [/flash-lite/i, /flash/i, /pro/i]; // cheapest tier first
const MODEL_FALLBACK = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.5-flash"];
const lsGet = k => {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

// Ask Google which models this key may use. A plain GET, no custom headers —
// costs no tokens, so it doubles as key + connectivity validation.
async function listModels(key) {
  const res = await fetch(`${GEM_HOST}/models?key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const err = new Error(e && e.error && e.error.message || "HTTP " + res.status);
    err.status = res.status;
    err.body = e;
    throw err;
  }
  const data = await res.json();
  return (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent")).map(m => (m.name || "").replace(/^models\//, "")).filter(Boolean);
}
function rankModels(names) {
  const usable = (names || []).filter(n => !/preview|-exp|experimental|embedding|image|vision|tts|audio|live|thinking/i.test(n));
  const genOf = s => parseFloat((s.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "99");
  const tier = s => MODEL_PREFER.findIndex(p => p.test(s));
  return usable.filter(n => tier(n) >= 0).sort((a, b) => tier(a) - tier(b) || genOf(a) - genOf(b) || a.length - b.length);
}
// Blank override = auto-pick from Google's list (cheapest first), cached hit first.
async function resolveModels(key) {
  const override = lsGet(LS.model).trim();
  if (override) return [override];
  let list = [];
  try {
    list = rankModels(await listModels(key));
  } catch {}
  if (!list.length) list = MODEL_FALLBACK.slice();
  const cached = lsGet(MODEL_OK);
  if (cached) list = [cached].concat(list.filter(m => m !== cached));
  return list;
}
const modelGone = (msg, status) => status === 404 || /not found|no longer available|not supported|deprecat|retired|discontinued/i.test(msg || "");
const zeroQuota = (errObj, msg) => {
  const d = errObj && errObj.error && errObj.error.details || [];
  for (const x of d) {
    const v = x?.metadata?.quota_limit_value ?? x?.metadata?.quotaValue;
    if (String(v) === "0") return true;
  }
  return /limit:\s*0\b|quota_limit_value["':\s]+0\b/i.test(msg || "");
};
const SUGGEST_SYSTEM = `You are the co-pilot in a binary decision-rehearsal instrument. In this step your ONLY job is to enumerate possible contributors to the decision-maker's question — the factors, forces, or levers that bear on it. You do NOT evaluate, rank, weigh, prioritize, group, or recommend anything. Ordering carries no meaning; never order by importance. You never indicate which factors matter more or what the person should do.
Return short, atomic contributor labels (2-5 words), each a distinct factor, no duplicates, no clustering (grouping is the decision-maker's job), no explanations.
A dial sets breadth: 0 = personal, narrow, restrained (a real life is at stake — stay to factors that clearly bear on it); 100 = research, wide, generative (surface adjacent and less-obvious factors too).
Output ONLY a JSON array of strings. No prose, no markdown, no backticks.`;
function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
function buildSuggestPrompt({
  heading,
  dial,
  count,
  parentHeading,
  branchContributors,
  existing
}) {
  const l = [`Question: "${heading}"`, `Dial: ${dial}/100. Offer about ${count} contributors.`];
  if (parentHeading && branchContributors && branchContributors.length) l.push(`This is a sub-branch. The decision-maker formed "${heading}" by grouping these factors together, inside the larger question "${parentHeading}": ${branchContributors.join(", ")}.`, `Keep your suggestions inside this branch — contributors to "${heading}" specifically, not the whole parent question.`);
  if (existing && existing.length) l.push(`Already listed (do not repeat): ${existing.join(", ")}.`);
  return l.join("\n");
}

// One generateContent call. Key rides in the query string and the ONLY header is
// Content-Type — the exact request shape proven to pass in the field. A custom
// header like x-goog-api-key can be silently blocked by some extensions/proxies.
async function callGeminiModel(key, model, system, prompt) {
  const res = await fetch(`${GEM_HOST}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: system
        }]
      },
      contents: [{
        role: "user",
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json"
      }
    })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const err = new Error(e && e.error && e.error.message || "HTTP " + res.status);
    err.status = res.status;
    err.body = e;
    throw err;
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
}

// Walk the candidate ladder: step past models that are retired or off the free
// tier; stop on a real error (bad key, network). Remembers what worked.
async function callGemini(key, system, prompt) {
  const candidates = await resolveModels(key);
  let last;
  for (const model of candidates) {
    try {
      const text = await callGeminiModel(key, model, system, prompt);
      lsSet(MODEL_OK, model);
      return text;
    } catch (e) {
      last = e;
      if (modelGone(e.message, e.status) || e.status === 429 && zeroQuota(e.body, e.message)) continue;
      throw e;
    }
  }
  throw last || new Error("No usable model available to this key.");
}

// Turn a raw failure into one plain, actionable sentence.
function diagnoseLiveError(e) {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "You appear to be offline — reconnect and try again.";
  } catch {}
  try {
    if (typeof location !== "undefined" && location.protocol === "file:") return "Opened from a file:// path — the browser blocks the API call. Serve the folder or install it as a PWA (see README).";
  } catch {}
  const s = e && e.status;
  const m = e && e.message || "";
  if (s === 400 || /API_KEY_INVALID|api key not valid|invalid api key/i.test(m)) return "Key not accepted (400) — check it copied whole; it starts with AIza (~39 chars).";
  if (s === 403) return "Key rejected (403) — enable the “Generative Language API” for this key, or check restrictions.";
  if (s === 429) return "Usage limit reached (429) — often a per-minute cap; wait a minute and retry.";
  if (/location|region|country|not available in your/i.test(m)) return "The Gemini API isn't available in your region yet.";
  if (s === 404 || modelGone(m, s)) return "No current model available to this key — clear any manual model override to let the app auto-pick.";
  if (s === 500 || s === 503) return "Gemini is temporarily unavailable (" + s + ") — try again shortly.";
  if (s) return "Gemini error " + s + (m ? ": " + m : "");
  return "No response — a network or CORS error (an extension, proxy, or VPN may be blocking Google; try DevTools → Network).";
}
async function suggestLive(ctx) {
  const count = Math.round(5 + ctx.dial / 100 * 4);
  const raw = await callGemini(ctx.key, SUGGEST_SYSTEM, buildSuggestPrompt({
    ...ctx,
    count
  }));
  let items = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
  if (!Array.isArray(items) || !items.length) throw new Error("bad shape");
  items = shuffle(items.map(s => String(s).trim()).filter(Boolean)).slice(0, count + 2);
  return items.map(t => ({
    id: nid(),
    text: t,
    source: "ai",
    tag: null
  }));
}
async function suggestSmart(ctx) {
  try {
    return await suggestLive(ctx);
  } catch (e) {
    return suggestFor(ctx.heading, ctx.dial);
  } // offline / error / no-key → on-device
}

// Companion book link — point this at the storefront when it's live.
const BOOK_URL = "https://tranzenstudio.com";
const STOP_SIGNS = [["actionable", "It names something a person can do on Monday", "actionable"], ["trivial", "The next split would be trivial or obvious", "next split trivial"], ["consensus", "The path is clear — I can see it plainly", "path is clear"], ["resistance", "The resistance dissolved — I know what I need to do", "resistance dissolved"]];
const signShort = id => {
  const s = STOP_SIGNS.find(x => x[0] === id);
  return s ? s[2] : id;
};

/* ---- session export ---------------------------------------------- *
 *  Turns a finished session into a keepable record — a Markdown file
 *  and a printable HTML document (browser "Save as PDF"). No runtime
 *  libraries: Markdown via Blob download, PDF via the print dialog.
 * ------------------------------------------------------------------ */
function slugify(s) {
  return String(s || "session").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "session";
}
function downloadBlob(filename, mime, text) {
  const blob = new Blob([text], {
    type: mime
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
function sessionEntries(nodes, rootId) {
  const out = [];
  (function walk(id) {
    const n = nodes[id];
    if (!n) return;
    out.push(n);
    if (n.childHeavyId) walk(n.childHeavyId);
    if (n.childParkedId) walk(n.childParkedId);
  })(rootId);
  return out;
}
const RECORD_LABEL = s => ({
  private: "Private",
  shared: "Shared",
  anon: "Anonymized"
})[s] || s;
function buildMarkdown({
  nodes,
  rootId,
  question,
  mainStatement,
  parkedStatement,
  security
}) {
  const L = [];
  L.push(`# ${question || "Untitled decision"}`, "");
  L.push(`*The Binary Path — Decision Cockpit · ${new Date().toLocaleString()} · Record level: ${RECORD_LABEL(security)}*`, "");
  L.push("## The descent", "");
  sessionEntries(nodes, rootId).forEach(n => {
    const decided = n.split != null && n.names.a && n.names.b;
    const heavier = n.heavier || (n.split != null ? n.split >= 50 ? "a" : "b" : null);
    const label = n.branchType === "root" ? "Prime question" : n.branchType === "parked" ? `Parked branch · ${n.share}%` : `Level ${n.depth}`;
    L.push(`### ${label}: ${n.heading}`, "");
    if (decided) {
      const g1 = n.contributors.filter(c => c.tag === 1).map(c => c.text);
      const g2 = n.contributors.filter(c => c.tag === 2).map(c => c.text);
      L.push(`- **${n.names.a}** — ${n.split}%${heavier === "a" ? " · followed" : ""}${g1.length ? `  \n  _${g1.join(", ")}_` : ""}`);
      L.push(`- **${n.names.b}** — ${100 - n.split}%${heavier === "b" ? " · followed" : ""}${g2.length ? `  \n  _${g2.join(", ")}_` : ""}`);
      if (n.reason && n.reason.trim()) L.push(`- Reason: ${n.reason.trim()}`);
      if (n.status === "stopped") L.push(`- Outcome: reached the ground${(n.stopSigns || []).length ? ` — ${n.stopSigns.map(signShort).join(", ")}` : ""}`);else if (n.childHeavyId) L.push(`- Outcome: followed the heavier line into "${heavier === "a" ? n.names.a : n.names.b}"`);
      L.push("");
    } else {
      L.push(n.status === "ignored" ? "- Set aside on purpose." : n.status === "parked" ? `- Parked at ${n.share}% — held in reserve.` : "- Not carried further.", "");
    }
  });
  L.push("## The articulation", "");
  L.push("**The main path**", "", (mainStatement || "—").trim(), "");
  if (parkedStatement && parkedStatement.trim()) L.push("**The parked flank**", "", parkedStatement.trim(), "");
  return L.join("\n");
}
function buildPrintHTML({
  nodes,
  rootId,
  question,
  mainStatement,
  parkedStatement,
  security
}) {
  const esc = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  })[c]);
  const blocks = sessionEntries(nodes, rootId).map(n => {
    const decided = n.split != null && n.names.a && n.names.b;
    const heavier = n.heavier || (n.split != null ? n.split >= 50 ? "a" : "b" : null);
    const label = n.branchType === "root" ? "PRIME QUESTION" : n.branchType === "parked" ? `PARKED BRANCH · ${n.share}%` : `LEVEL ${n.depth}`;
    const indent = Math.min(n.depth || 0, 6) * 22;
    let inner = "";
    if (decided) {
      const g1 = n.contributors.filter(c => c.tag === 1).map(c => esc(c.text)).join(", ");
      const g2 = n.contributors.filter(c => c.tag === 2).map(c => esc(c.text)).join(", ");
      const rowA = `<div class="grp ${heavier === "a" ? "on" : ""}"><span class="pct">${n.split}%</span> <b>${esc(n.names.a)}</b>${heavier === "a" ? ' <span class="fl">followed</span>' : ""}${g1 ? `<div class="mem">${g1}</div>` : ""}</div>`;
      const rowB = `<div class="grp ${heavier === "b" ? "on" : ""}"><span class="pct">${100 - n.split}%</span> <b>${esc(n.names.b)}</b>${heavier === "b" ? ' <span class="fl">followed</span>' : ""}${g2 ? `<div class="mem">${g2}</div>` : ""}</div>`;
      const reason = n.reason && n.reason.trim() ? `<div class="reason"><span class="k">Reason</span> ${esc(n.reason.trim())}</div>` : "";
      const outcome = n.status === "stopped" ? `<div class="out ground">Reached the ground${(n.stopSigns || []).length ? ` — ${n.stopSigns.map(s => esc(signShort(s))).join(", ")}` : ""}</div>` : n.childHeavyId ? `<div class="out">Followed the heavier line into “${esc(heavier === "a" ? n.names.a : n.names.b)}”</div>` : "";
      inner = rowA + rowB + reason + outcome;
    } else {
      inner = `<div class="out">${n.status === "ignored" ? "Set aside on purpose." : n.status === "parked" ? `Parked at ${n.share}% — held in reserve.` : "Not carried further."}</div>`;
    }
    return `<section style="margin-left:${indent}px">
      <div class="lbl ${n.branchType === "parked" ? "tl" : "gd"}">${label}</div>
      <h2>${esc(n.heading)}</h2>${inner}</section>`;
  }).join("");
  const parkedBlock = parkedStatement && parkedStatement.trim() ? `<div class="art tl"><div class="lbl tl">THE PARKED FLANK</div><p>${esc(parkedStatement.trim())}</p></div>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${esc(question || "Decision")}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a16; background: #fff; max-width: 720px; margin: 0 auto; padding: 32px 24px; line-height: 1.5; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  h1 { font-size: 26px; line-height: 1.2; margin: 0 0 6px; }
  .meta { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .08em; color: #6b6659; text-transform: uppercase; margin-bottom: 28px; }
  .sec-h { font-family: ui-monospace, Menlo, monospace; font-size: 11px; letter-spacing: .2em; color: #9a7b2e; margin: 26px 0 12px; }
  section { padding: 10px 0 14px; border-bottom: 1px solid #eee; }
  .lbl { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .2em; margin-bottom: 3px; }
  .lbl.gd { color: #9a7b2e; } .lbl.tl { color: #2e7d74; }
  h2 { font-size: 17px; font-weight: normal; margin: 0 0 8px; }
  .grp { padding: 4px 0 4px 10px; border-left: 3px solid #e4e0d4; margin-bottom: 3px; }
  .grp.on { border-left-color: #9a7b2e; }
  .pct { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #6b6659; }
  .fl { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #9a7b2e; }
  .mem { font-size: 12px; color: #6b6659; margin-top: 2px; }
  .reason { font-size: 14px; margin: 6px 0 2px; }
  .reason .k, .out .k { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #9a7b2e; margin-right: 4px; }
  .out { font-size: 13px; color: #444; margin-top: 6px; }
  .out.ground { color: #2e7d74; }
  .art { padding: 16px; border-radius: 8px; margin-top: 10px; background: #faf6ea; border: 1px solid #ece2c8; }
  .art.tl { background: #eef6f4; border-color: #cfe6e1; margin-top: 12px; }
  .art p { margin: 0; font-size: 16px; }
  @media print { body { padding: 0; } section { break-inside: avoid; } }
</style></head>
<body>
  <h1>${esc(question || "Untitled decision")}</h1>
  <div class="meta">The Binary Path — Decision Cockpit · ${esc(new Date().toLocaleString())} · Record level: ${esc(RECORD_LABEL(security))}</div>
  <div class="sec-h">THE DESCENT</div>
  ${blocks}
  <div class="sec-h">THE ARTICULATION</div>
  <div class="art"><div class="lbl gd">THE MAIN PATH</div><p>${esc((mainStatement || "—").trim())}</p></div>
  ${parkedBlock}
</body></html>`;
}

/* ================================================================== */
function App() {
  const [stage, setStage] = useState("opening");
  const [security, setSecurity] = useState("private");
  const [dial, setDial] = useState(30);
  const [rootQ, setRootQ] = useState("");
  const [probeAnswer, setProbeAnswer] = useState("");
  const [trueQ, setTrueQ] = useState("");
  const [nodes, setNodes] = useState({});
  const [rootId, setRootId] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [copilot, setCopilot] = useState(null);
  const [paused, setPaused] = useState(false);
  const [backtrackOpen, setBacktrackOpen] = useState(false);
  const [mainStatement, setMainStatement] = useState("");
  const [parkedStatement, setParkedStatement] = useState("");
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [exited, setExited] = useState(false);
  const [example, setExample] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [keyIsPaid, setKeyIsPaid] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [allowFreeInPrivate, setAllowFreeInPrivate] = useState(false);
  const [geminiModel, setGeminiModel] = useState("");
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  useEffect(() => {
    try {
      const k = localStorage.getItem(LS.key);
      if (k) setGeminiKey(k);
      setKeyIsPaid(localStorage.getItem(LS.paid) === "1");
      setLiveEnabled(!!k && localStorage.getItem(LS.live) !== "0");
      setAllowFreeInPrivate(localStorage.getItem(LS.priv) === "1");
      setGeminiModel(localStorage.getItem(LS.model) || "");
    } catch {}
  }, []);
  const saveKey = (k, paid, on, allowPriv, model) => {
    setGeminiKey(k);
    setKeyIsPaid(paid);
    setLiveEnabled(!!k && on);
    setAllowFreeInPrivate(!!allowPriv);
    setGeminiModel(model || "");
    try {
      if (k) localStorage.setItem(LS.key, k);else localStorage.removeItem(LS.key);
      localStorage.setItem(LS.paid, paid ? "1" : "0");
      localStorage.setItem(LS.live, !!k && on ? "1" : "0");
      localStorage.setItem(LS.priv, allowPriv ? "1" : "0");
      localStorage.setItem(LS.model, model || "");
    } catch {}
  };
  const current = currentId ? nodes[currentId] : null;

  /* ---- node helpers ---- */
  const patchNode = (id, patch) => setNodes(prev => ({
    ...prev,
    [id]: {
      ...prev[id],
      ...patch
    }
  }));
  function makeNode({
    heading,
    parentId,
    branchType,
    depth,
    share
  }) {
    const id = newNodeId();
    return {
      id,
      heading,
      parentId,
      branchType,
      depth,
      share: share ?? null,
      // this node's inherited weight (for parked display)
      step: "enumerate",
      contributors: suggestFor(heading, dial),
      // instant on-device seed; may be replaced by live
      suggesting: false,
      names: {
        a: "",
        b: ""
      },
      split: null,
      // % to group A
      reason: "",
      heavier: null,
      stopSigns: [],
      status: "active",
      // active | committed | parked | ignored | stopped
      childHeavyId: null,
      childParkedId: null
    };
  }

  /* ---- live suggestion gating + async fill ---- */
  // Live needs a key and the toggle on. In Private mode on a free key it's
  // held back — unless the owner explicitly opts in — to protect the
  // "visible only to you" promise.
  const liveAllowed = () => !!(liveEnabled && geminiKey && !(security === "private" && !keyIsPaid && !allowFreeInPrivate));
  // Why live is (or isn't) running, for an honest status readout.
  const liveReason = () => {
    if (liveAllowed()) return "on";
    if (!geminiKey) return "no-key";
    if (!liveEnabled) return "disabled";
    if (security === "private" && !keyIsPaid && !allowFreeInPrivate) return "private-free";
    return "off";
  };
  function suggestCtxFor(id) {
    const n = nodes[id];
    if (!n) return {
      heading: "",
      dial
    };
    const parent = n.parentId ? nodes[n.parentId] : null;
    let parentHeading, branchContributors;
    if (parent) {
      const fromTag = parent.childHeavyId === id ? parent.heavier === "a" ? 1 : 2 : parent.heavier === "a" ? 2 : 1;
      parentHeading = parent.heading;
      branchContributors = parent.contributors.filter(c => c.tag === fromTag).map(c => c.text);
    }
    const existing = n.contributors.filter(c => c.source === "user").map(c => c.text);
    return {
      heading: n.heading,
      dial,
      parentHeading,
      branchContributors,
      existing
    };
  }
  async function fillSuggestions(id, ctx) {
    if (!liveAllowed()) return; // nothing leaves the device
    patchNode(id, {
      suggesting: true,
      liveError: false
    });
    try {
      const fresh = await suggestLive({
        ...ctx,
        key: geminiKey
      });
      setNodes(prev => {
        const n = prev[id];
        if (!n) return prev; // node was cleared / navigated away
        const userKept = n.contributors.filter(c => c.source === "user");
        return {
          ...prev,
          [id]: {
            ...n,
            contributors: [...fresh, ...userKept],
            suggesting: false,
            liveError: false
          }
        };
      });
    } catch (e) {
      // keep the on-device seed already in place, but say exactly why live failed
      const msg = diagnoseLiveError(e);
      setNodes(prev => {
        const n = prev[id];
        if (!n) return prev;
        return {
          ...prev,
          [id]: {
            ...n,
            suggesting: false,
            liveError: true,
            liveErrorMsg: msg
          }
        };
      });
    }
  }
  const regenerate = () => {
    if (currentId) fillSuggestions(currentId, suggestCtxFor(currentId));
  };
  function startSession() {
    _nid = 1;
    _cid = 1;
    const heading = trueQ.trim() || rootQ.trim();
    const root = makeNode({
      heading,
      parentId: null,
      branchType: "root",
      depth: 0,
      share: 100
    });
    setNodes({
      [root.id]: root
    });
    setRootId(root.id);
    setCurrentId(root.id);
    setStage("work");
    fillSuggestions(root.id, {
      heading,
      dial
    });
  }

  // Post-session actions from the saved screen.
  function newCase() {
    _nid = 1;
    _cid = 1;
    setNodes({});
    setRootId(null);
    setCurrentId(null);
    setRootQ("");
    setProbeAnswer("");
    setTrueQ("");
    setMainStatement("");
    setParkedStatement("");
    setFinalConfirmed(false);
    setSavedOpen(false);
    setCopilot(null);
    setPaused(false);
    setBacktrackOpen(false);
    setStage("setup"); // keeps the key, dial, and record level for this sitting
  }
  function exitApp() {
    setExited(true);
    try {
      window.close();
    } catch {} // works for installed/opened windows; ExitScreen covers the rest
  }
  const sessionQuestion = () => trueQ.trim() || rootQ.trim();
  function exportMarkdown() {
    const md = buildMarkdown({
      nodes,
      rootId,
      question: sessionQuestion(),
      mainStatement,
      parkedStatement,
      security
    });
    downloadBlob(`${slugify(sessionQuestion())}.md`, "text/markdown;charset=utf-8", md);
  }
  function exportPDF() {
    const html = buildPrintHTML({
      nodes,
      rootId,
      question: sessionQuestion(),
      mainStatement,
      parkedStatement,
      security
    });
    const w = window.open("", "_blank");
    if (!w) {
      downloadBlob(`${slugify(sessionQuestion())}.html`, "text/html;charset=utf-8", html);
      return;
    } // popup blocked → file
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {}
    }, 350);
  }

  /* ---- ancestry / breadcrumb ---- */
  function ancestry(id) {
    const chain = [];
    let n = nodes[id];
    while (n && n.parentId) {
      chain.unshift(nodes[n.parentId]);
      n = nodes[n.parentId];
    }
    return chain;
  }
  function collectDescendants(id) {
    const out = [];
    const n = nodes[id];
    if (!n) return out;
    [n.childHeavyId, n.childParkedId].forEach(cid => {
      if (cid) {
        out.push(cid);
        out.push(...collectDescendants(cid));
      }
    });
    return out;
  }
  const unresolvedParked = () => Object.values(nodes).filter(n => n.status === "parked");

  /* ---- step transitions inside a node ---- */
  const toStep = step => patchNode(currentId, {
    step
  });
  function acceptGrouping() {
    const g1 = current.contributors.filter(c => c.tag === 1);
    const g2 = current.contributors.filter(c => c.tag === 2);
    if (g1.length === 0 || g2.length === 0) {
      setCopilot({
        title: "This isn't two things yet",
        body: "Every item is sitting in one group. A split has to be two genuinely different clusters — otherwise there's nothing to weigh against anything. Send at least one item to the other side."
      });
      return;
    }
    setCopilot(null);
    toStep("name");
  }
  function acceptNames() {
    const a = current.names.a.trim(),
      b = current.names.b.trim();
    if (!a || !b) return;
    if (a.toLowerCase() === b.toLowerCase()) {
      setCopilot({
        title: "The two names are the same",
        body: "If both sides carry the same name, the split is one thing wearing two labels. Name the real difference between the clusters — the axis they pull apart on."
      });
      return;
    }
    setCopilot(null);
    if (current.split == null) patchNode(currentId, {
      split: 50
    });
    toStep("weight");
  }
  function acceptWeight() {
    if (!current.reason.trim()) {
      setCopilot({
        title: "The weight has no reason attached",
        body: "Not a challenge to your number — just a check that a reason exists. A weight the room can't say the 'why' of won't survive being questioned two levels down. One line is enough."
      });
      return;
    }
    setCopilot(null);
    const heavier = current.split >= 50 ? "a" : "b";
    patchNode(currentId, {
      heavier
    });
    toStep("decide");
  }
  function drill() {
    const n = current;
    const heavierName = n.heavier === "a" ? n.names.a : n.names.b;
    const lighterName = n.heavier === "a" ? n.names.b : n.names.a;
    const heavyShare = n.heavier === "a" ? n.split : 100 - n.split;
    const lightShare = 100 - heavyShare;
    const heavyChild = makeNode({
      heading: heavierName,
      parentId: n.id,
      branchType: "heavy",
      depth: n.depth + 1,
      share: heavyShare
    });
    const parkedChild = makeNode({
      heading: lighterName,
      parentId: n.id,
      branchType: "parked",
      depth: n.depth + 1,
      share: lightShare
    });
    parkedChild.status = "parked";
    parkedChild.contributors = []; // not enumerated until proceeded

    setNodes(prev => ({
      ...prev,
      [n.id]: {
        ...prev[n.id],
        status: "committed",
        childHeavyId: heavyChild.id,
        childParkedId: parkedChild.id
      },
      [heavyChild.id]: heavyChild,
      [parkedChild.id]: parkedChild
    }));
    setCurrentId(heavyChild.id);
    setCopilot(null);
    const _hTag = n.heavier === "a" ? 1 : 2; // the group that became the heavy branch
    fillSuggestions(heavyChild.id, {
      heading: heavierName,
      dial,
      parentHeading: n.heading,
      branchContributors: n.contributors.filter(c => c.tag === _hTag).map(c => c.text)
    });
  }
  function requestStop() {
    if (!current.stopSigns || !current.stopSigns.length) {
      setCopilot({
        title: "Stopping without a stopping sign",
        body: "The book stops a branch on honest signs: it names something actionable, the next split is trivial, consensus is plainly there, or the resistance dissolved. Mark the sign — or signs — you're seeing, or keep drilling."
      });
      return;
    }
    setCopilot(null);
    patchNode(currentId, {
      status: "stopped"
    });
    // route to parked review or read-back
    setTimeout(() => {
      const stillParked = Object.values({
        ...nodes,
        [currentId]: {
          ...nodes[currentId],
          status: "stopped"
        }
      }).filter(n => n.status === "parked");
      setStage(stillParked.length ? "parked" : "readback");
      if (!stillParked.length) prepareReadback();
    }, 0);
  }
  function proceedParked(id) {
    // enumerate it now, make it active
    const n = nodes[id];
    patchNode(id, {
      status: "active",
      contributors: suggestFor(n.heading, dial),
      suggesting: false,
      step: "enumerate"
    });
    setCurrentId(id);
    setStage("work");
    setCopilot({
      title: "Depth follows weight",
      body: `This branch carries ${n.share}% of the leverage — a secondary contributor. Give it an honest, shallower pass: enough to cover the flank the main line leaves open, not a full descent.`,
      soft: true
    });
    const parent = nodes[n.parentId];
    if (parent) {
      const _lTag = parent.heavier === "a" ? 2 : 1; // the group that became the parked branch
      fillSuggestions(id, {
        heading: n.heading,
        dial,
        parentHeading: parent.heading,
        branchContributors: parent.contributors.filter(c => c.tag === _lTag).map(c => c.text)
      });
    }
  }
  function ignoreParked(id) {
    patchNode(id, {
      status: "ignored"
    });
    setTimeout(() => {
      const stillParked = Object.values({
        ...nodes,
        [id]: {
          ...nodes[id],
          status: "ignored"
        }
      }).filter(n => n.status === "parked");
      if (!stillParked.length) {
        setStage("readback");
        prepareReadback();
      }
    }, 0);
  }

  /* ---- read-back (the strategy-articulation diagnostic) ---- */
  function prepareReadback() {
    // main path: heavier names down the committed spine
    const spine = [];
    let n = nodes[rootId];
    while (n) {
      if (n.heavier) spine.push(n.heavier === "a" ? n.names.a : n.names.b);
      n = n.childHeavyId ? nodes[n.childHeavyId] : null;
    }
    const main = spine.length ? `Put the weight of our effort into ${spine.join(" → ")}.` : "";
    setMainStatement(prev => prev || main);
    const parked = Object.values(nodes).filter(x => x.branchType === "parked");
    const parkedLines = parked.map(p => {
      const verdict = p.status === "ignored" ? "set aside for now" : p.status === "stopped" || p.status === "committed" ? "given a shallower pass" : "held in reserve";
      return `${p.heading} (${p.share}% leverage) — ${verdict}.`;
    });
    setParkedStatement(prev => prev || (parkedLines.length ? "Hold the flank: " + parkedLines.join(" ") : ""));
  }

  /* ---- backtrack ---- */
  function backtrackTo(id) {
    const desc = collectDescendants(id);
    setNodes(prev => {
      const copy = {
        ...prev
      };
      desc.forEach(d => delete copy[d]);
      copy[id] = {
        ...copy[id],
        step: "tag",
        status: "active",
        heavier: null,
        childHeavyId: null,
        childParkedId: null,
        stopSigns: []
      };
      return copy;
    });
    setCurrentId(id);
    setBacktrackOpen(false);
    setSavedOpen(false);
    setFinalConfirmed(false);
    setStage("work");
    setCopilot({
      title: "Re-entering the checklist here",
      body: "Backtracking isn't a shortcut past the process — it's the same checklist run again on a different road. Re-group, re-weigh, and the fork you try now gets the same scrutiny the first one did.",
      soft: true
    });
  }

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  const showChrome = ["work", "parked", "readback", "final"].includes(stage);
  if (exited) return /*#__PURE__*/React.createElement(ExitScreen, {
    onReopen: () => setExited(false)
  });
  if (example) return /*#__PURE__*/React.createElement(Replay, {
    nodes: example.nodes,
    rootId: example.rootId,
    mainStatement: example.mainStatement,
    parkedStatement: example.parkedStatement,
    isExample: true,
    title: example.title + " · " + example.subtitle,
    onExit: () => setExample(null)
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "w-full min-h-screen font-sans",
    style: {
      background: C.field,
      color: C.ivory
    }
  }, /*#__PURE__*/React.createElement("style", null, `
        input[type=range]{-webkit-appearance:none;appearance:none;height:2px;border-radius:2px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:${C.gold};border:2px solid ${C.field};cursor:pointer;box-shadow:0 0 0 1px ${C.goldDim}}
        input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:${C.gold};border:2px solid ${C.field};cursor:pointer}
        ::placeholder{color:${C.faint}}
        button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid ${C.gold};outline-offset:2px}
        textarea,input{caret-color:${C.gold}}
      `), showChrome && /*#__PURE__*/React.createElement(HeadingStrip, {
    trueQ: trueQ || rootQ,
    crumbs: current ? ancestry(current.id).map(a => a.heading) : [],
    currentHeading: stage === "work" && current ? current.heading : null,
    dial: dial,
    security: security,
    onPause: () => setPaused(true),
    onBacktrack: () => setBacktrackOpen(true),
    canBacktrack: Object.keys(nodes).length > 1,
    liveOn: liveAllowed(),
    onKey: () => setKeyModalOpen(true)
  }), /*#__PURE__*/React.createElement("div", {
    className: showChrome ? "mx-auto px-6 py-6" : "",
    style: showChrome ? {
      maxWidth: 1240
    } : undefined
  }, stage === "opening" && /*#__PURE__*/React.createElement(Opening, {
    onEnter: () => setStage("intro"),
    onExample: () => setPickerOpen(true)
  }), stage === "intro" && /*#__PURE__*/React.createElement(Intro, {
    onNext: () => setStage("setup")
  }), stage === "setup" && /*#__PURE__*/React.createElement(Setup, {
    rootQ: rootQ,
    setRootQ: setRootQ,
    dial: dial,
    setDial: setDial,
    security: security,
    setSecurity: setSecurity,
    liveOn: liveAllowed(),
    onKey: () => setKeyModalOpen(true),
    onNext: () => setStage("trueq")
  }), stage === "trueq" && /*#__PURE__*/React.createElement(TrueQuestion, {
    rootQ: rootQ,
    probeAnswer: probeAnswer,
    setProbeAnswer: setProbeAnswer,
    trueQ: trueQ,
    setTrueQ: setTrueQ,
    onConfirm: startSession
  }), showChrome && /*#__PURE__*/React.createElement("div", {
    className: "grid gap-6",
    style: {
      gridTemplateColumns: "minmax(0,1fr) 400px"
    }
  }, /*#__PURE__*/React.createElement("div", null, stage === "work" && current && /*#__PURE__*/React.createElement(Work, {
    node: current,
    dial: dial,
    copilot: copilot,
    setCopilot: setCopilot,
    patchNode: patchNode,
    toStep: toStep,
    acceptGrouping: acceptGrouping,
    acceptNames: acceptNames,
    acceptWeight: acceptWeight,
    drill: drill,
    requestStop: requestStop,
    liveOn: liveAllowed(),
    onRegenerate: regenerate,
    reason: liveReason(),
    onKey: () => setKeyModalOpen(true)
  }), stage === "parked" && /*#__PURE__*/React.createElement(ParkedReview, {
    parked: unresolvedParked(),
    nodes: nodes,
    proceed: proceedParked,
    ignore: ignoreParked
  }), stage === "readback" && /*#__PURE__*/React.createElement(ReadBack, {
    mainStatement: mainStatement,
    setMainStatement: setMainStatement,
    parkedStatement: parkedStatement,
    setParkedStatement: setParkedStatement,
    onFinal: () => setStage("final")
  }), stage === "final" && /*#__PURE__*/React.createElement(Final, {
    security: security,
    setSecurity: setSecurity,
    confirmed: finalConfirmed,
    setConfirmed: setFinalConfirmed,
    savedOpen: savedOpen,
    onSaveOpen: () => setSavedOpen(true),
    onExportMd: exportMarkdown,
    onExportPdf: exportPDF,
    onReplay: () => setStage("replay"),
    onNewCase: newCase,
    onExit: exitApp
  })), /*#__PURE__*/React.createElement(TracePanel, {
    nodes: nodes,
    rootId: rootId,
    currentId: currentId
  })), stage === "replay" && /*#__PURE__*/React.createElement(Replay, {
    nodes: nodes,
    rootId: rootId,
    mainStatement: mainStatement,
    parkedStatement: parkedStatement,
    onExit: () => setStage("final")
  })), showChrome && /*#__PURE__*/React.createElement(DisclaimerStrip, {
    dial: dial
  }), paused && /*#__PURE__*/React.createElement(PauseOverlay, {
    onResume: () => setPaused(false)
  }), pickerOpen && /*#__PURE__*/React.createElement(ExamplePicker, {
    examples: EXAMPLES,
    onPick: ex => {
      setExample(ex);
      setPickerOpen(false);
    },
    onClose: () => setPickerOpen(false)
  }), backtrackOpen && /*#__PURE__*/React.createElement(BacktrackModal, {
    nodes: nodes,
    rootId: rootId,
    currentId: currentId,
    onPick: backtrackTo,
    onClose: () => setBacktrackOpen(false)
  }), keyModalOpen && /*#__PURE__*/React.createElement(KeyModal, {
    initialKey: geminiKey,
    initialPaid: keyIsPaid,
    initialOn: liveEnabled,
    initialAllowPriv: allowFreeInPrivate,
    initialModel: geminiModel,
    security: security,
    onClose: () => setKeyModalOpen(false),
    onSave: saveKey
  }));
}

/* ================================================================== */
/*  CHROME                                                            */
/* ================================================================== */
function Mark({
  size = 26
}) {
  // compass-fork: a ring with a Y descent, one arm gold, one teal
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    "aria-hidden": true
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "16",
    r: "14",
    stroke: C.line,
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 7 L16 15",
    stroke: C.ivory,
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 15 L22 24",
    stroke: C.gold,
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 15 L10 22",
    stroke: C.teal,
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "15",
    r: "1.6",
    fill: C.ivory
  }));
}
function HeadingStrip({
  trueQ,
  crumbs,
  currentHeading,
  dial,
  security,
  onPause,
  onBacktrack,
  canBacktrack,
  onKey,
  liveOn
}) {
  const secLabel = {
    private: "Private",
    shared: "Shared",
    anon: "Anonymized"
  }[security];
  const dialLabel = dial < 34 ? "Personal" : dial > 66 ? "Research" : "Balanced";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: `1px solid ${C.line}`,
      background: C.panel
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mx-auto px-6 py-3 flex items-center gap-4",
    style: {
      maxWidth: 1240
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement(Mark, null), /*#__PURE__*/React.createElement("div", {
    className: "leading-none"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px] tracking-[0.25em]",
    style: {
      color: C.ivory
    }
  }, "BINARY\xA0PATH"), /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.3em] mt-1",
    style: {
      color: C.faint
    }
  }, "DECISION COCKPIT"))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0 px-4",
    style: {
      borderLeft: `1px solid ${C.line}`,
      borderRight: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.3em] mb-1",
    style: {
      color: C.faint
    }
  }, "HEADING · WHERE WE ARE GOING"), /*#__PURE__*/React.createElement("div", {
    className: "truncate font-serif",
    style: {
      color: C.gold,
      fontSize: 15
    },
    title: trueQ
  }, trueQ || "—"), crumbs.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 mt-1 flex-wrap"
  }, crumbs.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "flex items-center gap-1 font-mono text-[10px]",
    style: {
      color: C.dim
    }
  }, i > 0 && /*#__PURE__*/React.createElement(ChevronRight, {
    size: 10,
    style: {
      color: C.faint
    }
  }), c)), currentHeading && /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1 font-mono text-[10px]",
    style: {
      color: C.gold
    }
  }, /*#__PURE__*/React.createElement(ChevronRight, {
    size: 10,
    style: {
      color: C.faint
    }
  }), currentHeading))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-right leading-tight"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.2em]",
    style: {
      color: C.faint
    }
  }, "DIAL"), /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px]",
    style: {
      color: C.teal
    }
  }, dialLabel)), /*#__PURE__*/React.createElement("div", {
    className: "text-right leading-tight"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.2em]",
    style: {
      color: C.faint
    }
  }, "RECORD"), /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px]",
    style: {
      color: C.dim
    }
  }, secLabel)), /*#__PURE__*/React.createElement("button", {
    onClick: onBacktrack,
    disabled: !canBacktrack,
    className: "flex items-center gap-1.5 px-3 py-2 rounded font-mono text-[11px] tracking-wide transition-opacity",
    style: {
      border: `1px solid ${C.line}`,
      color: canBacktrack ? C.ivory : C.faint,
      opacity: canBacktrack ? 1 : 0.5
    }
  }, /*#__PURE__*/React.createElement(CornerUpLeft, {
    size: 13
  }), " Backtrack"), /*#__PURE__*/React.createElement("button", {
    onClick: onKey,
    className: "flex items-center gap-1.5 px-3 py-2 rounded font-mono text-[11px] tracking-wide",
    style: {
      border: `1px solid ${liveOn ? C.teal : C.line}`,
      color: liveOn ? C.teal : C.ivory
    },
    title: liveOn ? "Live co-pilot suggestions (Gemini) — manage" : "Suggestions run on-device — connect Gemini"
  }, liveOn ? /*#__PURE__*/React.createElement(Sparkles, {
    size: 13
  }) : /*#__PURE__*/React.createElement(KeyRound, {
    size: 13
  }), " ", liveOn ? "Live" : "Suggest"), /*#__PURE__*/React.createElement("button", {
    onClick: onPause,
    className: "flex items-center gap-1.5 px-3 py-2 rounded font-mono text-[11px] tracking-wide",
    style: {
      border: `1px solid ${C.line}`,
      color: C.ivory
    }
  }, /*#__PURE__*/React.createElement(Pause, {
    size: 13
  }), " Pause"))));
}
function DisclaimerStrip({
  dial
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${C.line}`,
      background: C.panel
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mx-auto px-6 py-2.5 flex items-center gap-2",
    style: {
      maxWidth: 1240
    }
  }, /*#__PURE__*/React.createElement(Info, {
    size: 12,
    style: {
      color: C.faint
    }
  }), /*#__PURE__*/React.createElement("p", {
    className: "font-mono text-[10px] leading-relaxed",
    style: {
      color: C.faint
    }
  }, "A rehearsal instrument, not a decision-maker. Outputs are your own judgment, assisted — not verified conclusions. It doesn't replace professional advice where that's what's needed.", dial < 34 && " At the personal end, the co-pilot will say plainly if a question needs a person, not a tool — and step back.")));
}

/* ================================================================== */
/*  SCREENS — pre-session                                             */
/* ================================================================== */
function Opening({
  onEnter,
  onExample
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen flex flex-col items-center justify-center px-6 text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mb-8"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 64
  })), /*#__PURE__*/React.createElement("h1", {
    className: "font-mono tracking-[0.35em] mb-4",
    style: {
      fontSize: 34,
      color: C.ivory
    }
  }, "BINARY\xA0PATH"), /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px] tracking-[0.4em] mb-10",
    style: {
      color: C.gold
    }
  }, "DECISION\xA0\xA0COCKPIT"), /*#__PURE__*/React.createElement("p", {
    className: "font-serif max-w-md mb-12 leading-relaxed",
    style: {
      color: C.dim,
      fontSize: 16
    }
  }, "A place to fly the decision before you make it. One question, split in two, weighed for leverage, followed down until the next step is obvious — with a co-pilot who holds the process and leaves the choosing to you."), /*#__PURE__*/React.createElement("button", {
    onClick: onEnter,
    className: "flex items-center gap-2 px-7 py-3 rounded font-mono text-[12px] tracking-[0.2em]",
    style: {
      background: C.gold,
      color: C.field
    }
  }, "ENTER THE COCKPIT ", /*#__PURE__*/React.createElement(ChevronRight, {
    size: 15
  })), /*#__PURE__*/React.createElement("p", {
    className: "font-mono text-[10px] tracking-wide mt-6 max-w-sm leading-relaxed",
    style: {
      color: C.faint
    }
  }, "✷ Conceived and created as a companion to", " ", /*#__PURE__*/React.createElement("a", {
    href: BOOK_URL,
    target: "_blank",
    rel: "noreferrer",
    style: {
      color: C.gold,
      textDecoration: "underline",
      textUnderlineOffset: "3px"
    }
  }, "The Binary Decision Path")), /*#__PURE__*/React.createElement("button", {
    onClick: onExample,
    className: "mt-8 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em]",
    style: {
      color: C.teal
    }
  }, /*#__PURE__*/React.createElement(Play, {
    size: 12
  }), " NEW HERE? WATCH A WORKED EXAMPLE"));
}
function Intro({
  onNext
}) {
  const rows = [["What it is", "A solo instrument built on the Binary Path. You narrow, name, weigh, and decide. The co-pilot enumerates options, arranges what you sort, draws the trace, and speaks up only when the process itself is at risk — never to hand you an answer."], ["What it is not", "Not a decision-maker, and not a source of professional advice. Where a question really needs a doctor, lawyer, advisor, or another person, the co-pilot's job is to say so plainly and step back."], ["What you leave with", "Not a tidy tree for its own sake — the point is to find the branch that actually matters. You leave with a path you built and can defend, and the reasoning visible at every fork."]];
  return /*#__PURE__*/React.createElement(Frame, null, /*#__PURE__*/React.createElement(Eyebrow, null, "PRE-FLIGHT · 1 OF 2"), /*#__PURE__*/React.createElement("h2", {
    className: "font-serif mb-8",
    style: {
      fontSize: 30,
      color: C.ivory
    }
  }, "Before you begin"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-5 mb-10"
  }, rows.map(([h, b], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "grid gap-2 md:gap-6 pb-5",
    style: {
      gridTemplateColumns: "180px minmax(0,1fr)"
    },
    style: {
      borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px] tracking-[0.15em] pt-1",
    style: {
      color: C.gold
    }
  }, h.toUpperCase()), /*#__PURE__*/React.createElement("p", {
    className: "leading-relaxed",
    style: {
      color: C.dim,
      fontSize: 15
    }
  }, b)))), /*#__PURE__*/React.createElement(NextButton, {
    label: "Set up the session",
    onClick: onNext
  }));
}
function Setup({
  rootQ,
  setRootQ,
  dial,
  setDial,
  security,
  setSecurity,
  onNext,
  onKey,
  liveOn
}) {
  const examples = ["How do we improve the bottom line?", "Should I leave my job?"];
  const secOpts = [["private", Lock, "Private", "Visible only to you."], ["shared", Users, "Shared", "Visible to specific people you choose."], ["anon", Share2, "Anonymized", "Pooled, de-identified — could feed a shared archive."]];
  const dialLabel = dial < 34 ? "Personal" : dial > 66 ? "Research" : "Balanced";
  return /*#__PURE__*/React.createElement(Frame, null, /*#__PURE__*/React.createElement(Eyebrow, null, "PRE-FLIGHT · 2 OF 2"), /*#__PURE__*/React.createElement("h2", {
    className: "font-serif mb-8",
    style: {
      fontSize: 30,
      color: C.ivory
    }
  }, "Set up the session"), /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[11px] tracking-[0.15em] block mb-2",
    style: {
      color: C.gold
    }
  }, "THE QUESTION ON THE TABLE"), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4 mb-3",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: rootQ,
    onChange: e => setRootQ(e.target.value),
    rows: 2,
    placeholder: "Type the decision in plain words…",
    className: "w-full bg-transparent resize-none font-serif leading-relaxed",
    style: {
      color: C.ivory,
      fontSize: 20,
      border: "none"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-10 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] tracking-wide py-1",
    style: {
      color: C.faint
    }
  }, "TRY:"), examples.map(e => /*#__PURE__*/React.createElement("button", {
    key: e,
    onClick: () => setRootQ(e),
    className: "px-3 py-1 rounded font-serif text-[13px]",
    style: {
      border: `1px solid ${C.line}`,
      color: C.dim
    }
  }, e))), /*#__PURE__*/React.createElement("div", {
    className: "mb-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between mb-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[11px] tracking-[0.15em]",
    style: {
      color: C.gold
    }
  }, "THE DIAL · HOW WIDE THE CO-PILOT REACHES"), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[12px]",
    style: {
      color: C.teal
    }
  }, dialLabel)), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: DIAL.min,
    max: DIAL.max,
    value: dial,
    onChange: e => setDial(Number(e.target.value)),
    className: "w-full mb-2",
    style: {
      background: C.line
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between font-mono text-[10px]",
    style: {
      color: C.faint
    }
  }, /*#__PURE__*/React.createElement("span", null, "PERSONAL — narrow, restrained, a life is at stake"), /*#__PURE__*/React.createElement("span", null, "RESEARCH — wide, generative, nothing but curiosity at stake"))), /*#__PURE__*/React.createElement("div", {
    className: "mb-10"
  }, /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[11px] tracking-[0.15em] block mb-3",
    style: {
      color: C.gold
    }
  }, "RECORD LEVEL"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-3"
  }, secOpts.map(([id, Icon, title, desc]) => {
    const on = security === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => setSecurity(id),
      className: "text-left rounded-lg p-4 transition-colors",
      style: {
        background: on ? C.goldWell : C.panel2,
        border: `1px solid ${on ? C.gold : C.line}`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      size: 16,
      style: {
        color: on ? C.gold : C.dim
      },
      className: "mb-2"
    }), /*#__PURE__*/React.createElement("div", {
      className: "font-mono text-[12px] tracking-wide mb-1",
      style: {
        color: on ? C.gold : C.ivory
      }
    }, title), /*#__PURE__*/React.createElement("div", {
      className: "text-[12px] leading-snug",
      style: {
        color: C.faint
      }
    }, desc));
  })), /*#__PURE__*/React.createElement("p", {
    className: "font-mono text-[10px] mt-2",
    style: {
      color: C.faint
    }
  }, "You'll confirm this again before anything is saved.")), /*#__PURE__*/React.createElement("div", {
    className: "mb-10"
  }, /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[11px] tracking-[0.15em] block mb-3",
    style: {
      color: C.gold
    }
  }, "CO-PILOT SUGGESTIONS"), /*#__PURE__*/React.createElement("button", {
    onClick: onKey,
    className: "w-full flex items-center justify-between rounded-lg p-4",
    style: {
      background: C.panel2,
      border: `1px solid ${liveOn ? C.teal : C.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-2"
  }, liveOn ? /*#__PURE__*/React.createElement(Sparkles, {
    size: 15,
    style: {
      color: C.teal
    }
  }) : /*#__PURE__*/React.createElement(KeyRound, {
    size: 15,
    style: {
      color: C.dim
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.ivory
    }
  }, liveOn ? "Live enumeration on (Gemini)" : "On-device enumeration")), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] tracking-wide",
    style: {
      color: liveOn ? C.teal : C.gold
    }
  }, liveOn ? "MANAGE" : "CONNECT GEMINI")), /*#__PURE__*/React.createElement("p", {
    className: "font-mono text-[10px] mt-2",
    style: {
      color: C.faint
    }
  }, "Optional. Without a key the co-pilot enumerates from its built-in list — fully on-device. It only ever lists; it never weighs or recommends.")), /*#__PURE__*/React.createElement(NextButton, {
    label: "Continue",
    onClick: onNext,
    disabled: !rootQ.trim()
  }));
}
function TrueQuestion({
  rootQ,
  probeAnswer,
  setProbeAnswer,
  trueQ,
  setTrueQ,
  onConfirm
}) {
  const [editing, setEditing] = useState(false);
  return /*#__PURE__*/React.createElement(Frame, null, /*#__PURE__*/React.createElement(Eyebrow, null, "THE TRUE-QUESTION PROBE · ASKED ONCE"), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-5 mb-8",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-2",
    style: {
      color: C.faint
    }
  }, "YOU TYPED"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 20,
      color: C.ivory
    }
  }, rootQ)), /*#__PURE__*/React.createElement(CoPilotVoice, {
    line: "Suppose you get this — what changes the day after? What are you really after here?",
    note: "One glance up the chain, not an interrogation. If the answer comes clean, this is your question and we build on it."
  }), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4 my-6",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: probeAnswer,
    onChange: e => setProbeAnswer(e.target.value),
    rows: 2,
    placeholder: "A line on what you're actually after (optional)…",
    className: "w-full bg-transparent resize-none leading-relaxed",
    style: {
      color: C.ivory,
      fontSize: 15,
      border: "none"
    }
  })), !editing ? /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setTrueQ(rootQ);
      onConfirm();
    },
    className: "flex items-center justify-center gap-2 px-6 py-3 rounded font-mono text-[12px] tracking-[0.15em]",
    style: {
      background: C.gold,
      color: C.field
    }
  }, /*#__PURE__*/React.createElement(Check, {
    size: 15
  }), " THIS IS THE QUESTION"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditing(true);
      setTrueQ(rootQ);
    },
    className: "flex items-center justify-center gap-2 px-6 py-3 rounded font-mono text-[12px] tracking-[0.15em]",
    style: {
      border: `1px solid ${C.line}`,
      color: C.ivory
    }
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 14
  }), " REPHRASE THE ROOT")) : /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4",
    style: {
      background: C.panel2,
      border: `1px solid ${C.gold}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-2",
    style: {
      color: C.gold
    }
  }, "THE REAL QUESTION"), /*#__PURE__*/React.createElement("textarea", {
    value: trueQ,
    onChange: e => setTrueQ(e.target.value),
    rows: 2,
    autoFocus: true,
    className: "w-full bg-transparent resize-none font-serif leading-relaxed mb-3",
    style: {
      color: C.ivory,
      fontSize: 19,
      border: "none"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onConfirm,
    disabled: !trueQ.trim(),
    className: "flex items-center gap-2 px-5 py-2.5 rounded font-mono text-[12px] tracking-[0.15em]",
    style: {
      background: C.gold,
      color: C.field,
      opacity: trueQ.trim() ? 1 : 0.5
    }
  }, /*#__PURE__*/React.createElement(Check, {
    size: 15
  }), " BUILD FROM THIS")));
}

/* ================================================================== */
/*  WORK — the recursive branch surface                               */
/* ================================================================== */
function Work({
  node,
  dial,
  copilot,
  setCopilot,
  patchNode,
  toStep,
  acceptGrouping,
  acceptNames,
  acceptWeight,
  drill,
  requestStop,
  liveOn,
  onRegenerate,
  reason,
  onKey
}) {
  const setTag = (cid, tag) => patchNode(node.id, {
    contributors: node.contributors.map(c => c.id === cid ? {
      ...c,
      tag: c.tag === tag ? null : tag
    } : c)
  });
  const addContributor = text => patchNode(node.id, {
    contributors: [...node.contributors, {
      id: nid(),
      text,
      source: "user",
      tag: null
    }]
  });
  const removeContributor = cid => patchNode(node.id, {
    contributors: node.contributors.filter(c => c.id !== cid)
  });
  const stepIndex = ["enumerate", "tag", "name", "weight", "decide"].indexOf(node.step);
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 py-4 flex items-center justify-between",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-1",
    style: {
      color: node.branchType === "parked" ? C.teal : C.faint
    }
  }, node.branchType === "root" ? "PRIME QUESTION" : node.branchType === "parked" ? `PARKED BRANCH · ${node.share}% LEVERAGE` : `BRANCH · LEVEL ${node.depth}`), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 22,
      color: C.ivory
    }
  }, node.heading)), /*#__PURE__*/React.createElement(StepDots, {
    index: stepIndex
  })), /*#__PURE__*/React.createElement("div", {
    className: "p-6"
  }, copilot && /*#__PURE__*/React.createElement(CoPilotFlag, {
    copilot: copilot,
    onClose: () => setCopilot(null)
  }), node.step === "enumerate" && /*#__PURE__*/React.createElement(Enumerate, {
    node: node,
    dial: dial,
    addContributor: addContributor,
    removeContributor: removeContributor,
    onNext: () => toStep("tag"),
    liveOn: liveOn,
    onRegenerate: onRegenerate,
    reason: reason,
    onKey: onKey
  }), node.step === "tag" && /*#__PURE__*/React.createElement(Tag, {
    node: node,
    setTag: setTag,
    onBack: () => toStep("enumerate"),
    onNext: acceptGrouping
  }), node.step === "name" && /*#__PURE__*/React.createElement(NameGroups, {
    node: node,
    patchNode: patchNode,
    onBack: () => toStep("tag"),
    onNext: acceptNames
  }), node.step === "weight" && /*#__PURE__*/React.createElement(Weigh, {
    node: node,
    patchNode: patchNode,
    onBack: () => toStep("name"),
    onNext: acceptWeight
  }), node.step === "decide" && /*#__PURE__*/React.createElement(Decide, {
    node: node,
    patchNode: patchNode,
    drill: drill,
    requestStop: requestStop,
    onBack: () => toStep("weight")
  })));
}
function Enumerate({
  node,
  dial,
  addContributor,
  removeContributor,
  onNext,
  liveOn,
  onRegenerate,
  reason,
  onKey
}) {
  const [draft, setDraft] = useState("");
  const statusText = node.suggesting ? "CO-PILOT ENUMERATING…" : node.liveError ? "ON-DEVICE · LIVE CALL FAILED" : liveOn ? "SUGGESTIONS · LIVE (GEMINI)" : reason === "private-free" ? "ON-DEVICE · PRIVATE + FREE KEY" : "SUGGESTIONS · ON-DEVICE";
  const statusColor = node.suggesting || node.liveError ? C.gold : liveOn ? C.teal : C.faint;
  const showBanner = !node.suggesting && (node.liveError || reason === "private-free");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StepLine, null, "These are possible contributors to ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ivory
    }
  }, node.heading), ". Add anything the co-pilot missed — your own factors are where ownership starts."), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[9px] tracking-[0.2em]",
    style: {
      color: statusColor
    }
  }, statusText), liveOn ? /*#__PURE__*/React.createElement("button", {
    onClick: onRegenerate,
    disabled: node.suggesting,
    className: "flex items-center gap-1 font-mono text-[10px] tracking-wide",
    style: {
      color: C.dim,
      opacity: node.suggesting ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement(RefreshCw, {
    size: 11
  }), " ANOTHER PASS") : /*#__PURE__*/React.createElement("button", {
    onClick: onKey,
    className: "font-mono text-[10px] tracking-wide",
    style: {
      color: C.teal
    }
  }, "MANAGE")), showBanner && /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-3 mb-4 flex items-start justify-between gap-3",
    style: {
      background: C.panel2,
      border: `1px solid ${node.liveError ? C.goldDim : C.tealDim}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[12px] leading-snug",
    style: {
      color: C.dim
    }
  }, reason === "private-free" ? "Live suggestions are paused — this session is Private and the key is free-tier, where Google may use prompts to improve its products. Open suggestions to allow it here, mark the key paid, or set the record level to Shared." : node.liveErrorMsg || "The live call didn't return — an offline connection, a file:// request the browser blocked, or an out-of-date model id. The on-device list is shown instead."), /*#__PURE__*/React.createElement("button", {
    onClick: onKey,
    className: "font-mono text-[10px] tracking-wide shrink-0",
    style: {
      color: C.teal
    }
  }, "MANAGE ↗")), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 mb-5",
    style: {
      opacity: node.suggesting ? 0.5 : 1
    }
  }, node.contributors.map(c => /*#__PURE__*/React.createElement("span", {
    key: c.id,
    className: "group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full",
    style: {
      background: c.source === "user" ? C.goldWell : C.panel2,
      border: `1px solid ${c.source === "user" ? C.goldDim : C.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.ivory
    }
  }, c.text), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[8px] tracking-wide",
    style: {
      color: c.source === "user" ? C.gold : C.faint
    }
  }, c.source === "user" ? "YOURS" : "AI"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeContributor(c.id),
    style: {
      color: C.faint
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 12
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-6"
  }, /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && draft.trim()) {
        addContributor(draft.trim());
        setDraft("");
      }
    },
    placeholder: "Add a contributor of your own…",
    className: "flex-1 px-3 py-2 rounded bg-transparent",
    style: {
      border: `1px solid ${C.line}`,
      color: C.ivory,
      fontSize: 14
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (draft.trim()) {
        addContributor(draft.trim());
        setDraft("");
      }
    },
    className: "flex items-center gap-1 px-4 rounded font-mono text-[11px]",
    style: {
      border: `1px solid ${C.line}`,
      color: C.ivory
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13
  }), " ADD")), /*#__PURE__*/React.createElement(NextButton, {
    label: "Group these into two",
    onClick: onNext,
    disabled: node.contributors.length < 2
  }));
}
function Tag({
  node,
  setTag,
  onBack,
  onNext
}) {
  const g1 = node.contributors.filter(c => c.tag === 1).length;
  const g2 = node.contributors.filter(c => c.tag === 2).length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StepLine, null, "Sort each item by ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ivory
    }
  }, "kinship"), " — not importance. Which belong together? Tag every one ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.gold
    }
  }, "1"), " or ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.teal
    }
  }, "2"), "."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mb-6"
  }, node.contributors.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "flex items-center justify-between px-4 py-2.5 rounded",
    style: {
      background: C.panel2,
      border: `1px solid ${c.tag === 1 ? C.goldDim : c.tag === 2 ? C.tealDim : C.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: c.tag ? C.ivory : C.dim
    }
  }, c.text), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, [1, 2].map(t => {
    const on = c.tag === t;
    const col = t === 1 ? C.gold : C.teal;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      onClick: () => setTag(c.id, t),
      className: "w-9 h-9 rounded font-mono text-[13px]",
      style: {
        background: on ? col : "transparent",
        color: on ? C.field : C.dim,
        border: `1px solid ${on ? col : C.line}`
      }
    }, t);
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4 mb-6 font-mono text-[10px]",
    style: {
      color: C.faint
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gold
    }
  }, "■ GROUP 1 · ", g1), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.teal
    }
  }, "■ GROUP 2 · ", g2), g1 > 0 && g2 > 0 ? null : /*#__PURE__*/React.createElement("span", null, "— both groups need at least one item")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3"
  }, /*#__PURE__*/React.createElement(BackButton, {
    onClick: onBack
  }), /*#__PURE__*/React.createElement(NextButton, {
    label: "Confirm the two clusters",
    onClick: onNext
  })));
}
function NameCol({
  tagCol,
  items,
  value,
  onChange,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4",
    style: {
      background: C.panel2,
      border: `1px solid ${tagCol}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mb-4"
  }, items.map(c => /*#__PURE__*/React.createElement("span", {
    key: c.id,
    className: "px-2 py-1 rounded text-[12px]",
    style: {
      background: C.field,
      color: C.dim
    }
  }, c.text))), /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.2em] mb-2",
    style: {
      color: tagCol
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: "Name this group…",
    className: "w-full px-3 py-2 rounded bg-transparent font-serif",
    style: {
      border: `1px solid ${C.line}`,
      color: C.ivory,
      fontSize: 17
    }
  }));
}
function NameGroups({
  node,
  patchNode,
  onBack,
  onNext
}) {
  const g1 = node.contributors.filter(c => c.tag === 1);
  const g2 = node.contributors.filter(c => c.tag === 2);
  const set = (k, v) => patchNode(node.id, {
    names: {
      ...node.names,
      [k]: v
    }
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StepLine, null, "Based on the values underneath these clusters, ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ivory
    }
  }, "how would you name the two?"), " The name is what turns a pile into a contributor the method can weigh."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
  }, /*#__PURE__*/React.createElement(NameCol, {
    tagCol: C.gold,
    items: g1,
    value: node.names.a,
    onChange: v => set("a", v),
    label: "GROUP 1"
  }), /*#__PURE__*/React.createElement(NameCol, {
    tagCol: C.teal,
    items: g2,
    value: node.names.b,
    onChange: v => set("b", v),
    label: "GROUP 2"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3"
  }, /*#__PURE__*/React.createElement(BackButton, {
    onClick: onBack,
    label: "Re-sort"
  }), /*#__PURE__*/React.createElement(NextButton, {
    label: "Weigh the two",
    onClick: onNext,
    disabled: !node.names.a.trim() || !node.names.b.trim()
  })));
}
function Weigh({
  node,
  patchNode,
  onBack,
  onNext
}) {
  const a = node.names.a,
    b = node.names.b;
  const va = node.split ?? 50,
    vb = 100 - va;
  const set = v => patchNode(node.id, {
    split: v
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-5 mb-6 font-serif leading-relaxed",
    style: {
      background: C.goldWell,
      border: `1px solid ${C.goldDim}`,
      fontSize: 17,
      color: C.ivory
    }
  }, "For the ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.gold
    }
  }, "same effort"), " — the same cost, the same time, the same people — which of these two moves ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.gold
    }
  }, node.heading), " more?"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2 font-serif",
    style: {
      fontSize: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gold
    }
  }, a), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.teal
    }
  }, b)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 mb-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[18px] w-14",
    style: {
      color: C.gold
    }
  }, va), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 100,
    value: va,
    onChange: e => set(Number(e.target.value)),
    className: "flex-1",
    style: {
      background: C.line
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[18px] w-14 text-right",
    style: {
      color: C.teal
    }
  }, vb)), /*#__PURE__*/React.createElement("div", {
    className: "flex h-2 rounded overflow-hidden mb-6"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${va}%`,
      background: C.gold
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${vb}%`,
      background: C.teal
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[10px] tracking-[0.2em] block mb-2",
    style: {
      color: C.faint
    }
  }, "WHY THIS SPLIT — ONE LINE"), /*#__PURE__*/React.createElement("textarea", {
    value: node.reason,
    onChange: e => patchNode(node.id, {
      reason: e.target.value
    }),
    rows: 2,
    placeholder: "The reason your number leans the way it does…",
    className: "w-full px-3 py-2 rounded bg-transparent resize-none mb-6",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`,
      color: C.ivory,
      fontSize: 14
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3"
  }, /*#__PURE__*/React.createElement(BackButton, {
    onClick: onBack,
    label: "Rename"
  }), /*#__PURE__*/React.createElement(NextButton, {
    label: "Set the weight",
    onClick: onNext
  })));
}
function Decide({
  node,
  patchNode,
  drill,
  requestStop,
  onBack
}) {
  const heavier = node.split >= 50 ? "a" : "b";
  const heavierName = heavier === "a" ? node.names.a : node.names.b;
  const lighterName = heavier === "a" ? node.names.b : node.names.a;
  const heavyShare = Math.max(node.split, 100 - node.split);
  const chosen = node.stopSigns || [];
  const toggleSign = id => patchNode(node.id, {
    stopSigns: chosen.includes(id) ? chosen.filter(x => x !== id) : [...chosen, id]
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4 mb-6 flex items-center justify-between",
    style: {
      background: C.goldWell,
      border: `1px solid ${C.goldDim}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-1",
    style: {
      color: C.gold
    }
  }, "HEAVIER · ", heavyShare, "%"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 19,
      color: C.ivory
    }
  }, heavierName)), /*#__PURE__*/React.createElement("div", {
    className: "text-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-1",
    style: {
      color: C.teal
    }
  }, "PARKED · ", 100 - heavyShare, "%"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 15,
      color: C.dim
    }
  }, lighterName))), /*#__PURE__*/React.createElement(StepLine, null, "Follow the heavier branch down, or has this one reached the ground?"), /*#__PURE__*/React.createElement("button", {
    onClick: drill,
    className: "w-full flex items-center justify-between px-5 py-4 rounded-lg mb-4",
    style: {
      background: C.gold,
      color: C.field
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[12px] tracking-[0.1em]"
  }, "DRILL INTO “", heavierName.toUpperCase(), "”"), /*#__PURE__*/React.createElement(ArrowDownRight, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px] tracking-[0.15em] mb-3",
    style: {
      color: C.dim
    }
  }, "OR STOP HERE — WHICH SIGN(S) ARE YOU SEEING?"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-2 mb-4"
  }, STOP_SIGNS.map(([id, label]) => {
    const on = chosen.includes(id);
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => toggleSign(id),
      className: "text-left px-3 py-2.5 rounded flex items-start gap-2",
      style: {
        background: on ? C.tealWell : "transparent",
        border: `1px solid ${on ? C.teal : C.line}`
      }
    }, on ? /*#__PURE__*/React.createElement(Check, {
      size: 14,
      style: {
        color: C.teal,
        marginTop: 2
      }
    }) : /*#__PURE__*/React.createElement(Circle, {
      size: 14,
      style: {
        color: C.faint,
        marginTop: 2
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: on ? C.ivory : C.dim
      }
    }, label));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: requestStop,
    className: "w-full flex items-center justify-center gap-2 px-5 py-3 rounded font-mono text-[12px] tracking-[0.1em]",
    style: {
      border: `1px solid ${C.teal}`,
      color: C.teal
    }
  }, /*#__PURE__*/React.createElement(Anchor, {
    size: 14
  }), " STOP THIS BRANCH — IT'S REACHED THE GROUND")), /*#__PURE__*/React.createElement("div", {
    className: "mt-4"
  }, /*#__PURE__*/React.createElement(BackButton, {
    onClick: onBack,
    label: "Re-weigh"
  })));
}

/* ================================================================== */
/*  PARKED REVIEW                                                      */
/* ================================================================== */
function ParkedReview({
  parked,
  nodes,
  proceed,
  ignore
}) {
  const sorted = [...parked].sort((a, b) => b.share - a.share);
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 py-4",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-1",
    style: {
      color: C.teal
    }
  }, "THE LAST FORK · PARKED BRANCHES"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 22,
      color: C.ivory
    }
  }, "What did the heavy line leave open?")), /*#__PURE__*/React.createElement("div", {
    className: "p-6"
  }, /*#__PURE__*/React.createElement(StepLine, null, "The main line has reached the ground. Each parked branch below carries the weight shown. The point was never a tidy tree — it was to find what matters. Give the significant ones a shallower pass; set the rest aside on purpose."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, sorted.map(p => {
    const parent = nodes[p.parentId];
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: "rounded-lg p-4",
      style: {
        background: C.panel2,
        border: `1px solid ${C.tealDim}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-start justify-between gap-4 mb-3"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "font-mono text-[9px] tracking-[0.2em] mb-1",
      style: {
        color: C.faint
      }
    }, "UNDER · ", parent ? parent.heading : "—"), /*#__PURE__*/React.createElement("div", {
      className: "font-serif",
      style: {
        fontSize: 18,
        color: C.ivory
      }
    }, p.heading)), /*#__PURE__*/React.createElement("div", {
      className: "text-right shrink-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "font-mono text-[22px]",
      style: {
        color: C.teal
      }
    }, p.share, "%"), /*#__PURE__*/React.createElement("div", {
      className: "font-mono text-[9px] tracking-[0.15em]",
      style: {
        color: C.faint
      }
    }, "LEVERAGE"))), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-3"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => proceed(p.id),
      className: "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-mono text-[11px] tracking-[0.1em]",
      style: {
        background: C.teal,
        color: C.field
      }
    }, /*#__PURE__*/React.createElement(ArrowDownRight, {
      size: 14
    }), " GIVE IT A PASS"), /*#__PURE__*/React.createElement("button", {
      onClick: () => ignore(p.id),
      className: "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-mono text-[11px] tracking-[0.1em]",
      style: {
        border: `1px solid ${C.line}`,
        color: C.dim
      }
    }, "SET ASIDE ON PURPOSE")));
  }))));
}

/* ================================================================== */
/*  READ-BACK — strategy-articulation diagnostic                      */
/* ================================================================== */
function ReadBack({
  mainStatement,
  setMainStatement,
  parkedStatement,
  setParkedStatement,
  onFinal
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 py-4",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-1",
    style: {
      color: C.gold
    }
  }, "THE ARTICULATION"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 22,
      color: C.ivory
    }
  }, "Say the strategy back in your own words")), /*#__PURE__*/React.createElement("div", {
    className: "p-6"
  }, /*#__PURE__*/React.createElement(CoPilotVoice, {
    line: "Here's the path you built, read straight off the tree. Rewrite each line until it's the strategy you'd actually stand behind.",
    note: "This is the honest test: if the articulation sits cleanly, the tree was done. If rewriting it reopens forks you thought were settled, that's the signal it wasn't — backtrack to them."
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-6"
  }, /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[10px] tracking-[0.2em] block mb-2",
    style: {
      color: C.gold
    }
  }, "THE MAIN PATH"), /*#__PURE__*/React.createElement("textarea", {
    value: mainStatement,
    onChange: e => setMainStatement(e.target.value),
    rows: 3,
    className: "w-full px-4 py-3 rounded font-serif resize-none mb-5",
    style: {
      background: C.goldWell,
      border: `1px solid ${C.goldDim}`,
      color: C.ivory,
      fontSize: 17,
      lineHeight: 1.5
    }
  }), /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[10px] tracking-[0.2em] block mb-2",
    style: {
      color: C.teal
    }
  }, "THE PARKED FLANK"), /*#__PURE__*/React.createElement("textarea", {
    value: parkedStatement,
    onChange: e => setParkedStatement(e.target.value),
    rows: 3,
    className: "w-full px-4 py-3 rounded font-serif resize-none mb-6",
    style: {
      background: C.tealWell,
      border: `1px solid ${C.tealDim}`,
      color: C.ivory,
      fontSize: 17,
      lineHeight: 1.5
    }
  }), /*#__PURE__*/React.createElement(NextButton, {
    label: "This is the strategy — continue",
    onClick: onFinal,
    disabled: !mainStatement.trim()
  }))));
}

/* ================================================================== */
/*  FINAL                                                             */
/* ================================================================== */
function Final({
  security,
  setSecurity,
  confirmed,
  setConfirmed,
  savedOpen,
  onSaveOpen,
  onExportMd,
  onExportPdf,
  onReplay,
  onNewCase,
  onExit
}) {
  const secOpts = [["private", Lock, "Private", "Only you."], ["shared", Users, "Shared", "People you designate."], ["anon", Share2, "Anonymized", "Pooled, de-identified archive."]];
  const RECORD = {
    private: "PRIVATE",
    shared: "SHARED",
    anon: "ANONYMIZED"
  };
  const ExportRow = () => /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center gap-2 mt-6"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] tracking-[0.15em] mr-1",
    style: {
      color: C.faint
    }
  }, "KEEP A COPY"), /*#__PURE__*/React.createElement("button", {
    onClick: onExportPdf,
    className: "flex items-center gap-1.5 px-3 py-2 rounded font-mono text-[10px] tracking-wide",
    style: {
      border: `1px solid ${C.line}`,
      color: C.dim
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 12
  }), " PDF"), /*#__PURE__*/React.createElement("button", {
    onClick: onExportMd,
    className: "flex items-center gap-1.5 px-3 py-2 rounded font-mono text-[10px] tracking-wide",
    style: {
      border: `1px solid ${C.line}`,
      color: C.dim
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 12
  }), " MARKDOWN"));

  // (1) Final, locked — the three onward choices.
  if (confirmed) {
    return /*#__PURE__*/React.createElement("div", {
      className: "rounded-lg p-10 text-center",
      style: {
        background: C.panel,
        border: `1px solid ${C.gold}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-center mb-5"
    }, /*#__PURE__*/React.createElement(Check, {
      size: 40,
      style: {
        color: C.gold
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "font-serif mb-3",
      style: {
        fontSize: 24,
        color: C.ivory
      }
    }, "Session saved"), /*#__PURE__*/React.createElement("p", {
      className: "max-w-sm mx-auto leading-relaxed",
      style: {
        color: C.dim,
        fontSize: 15
      }
    }, "Kept in the book's own case-study language — the tree as built, the reason at each fork, the ground you reached. Your judgment compounds one session at a time."), /*#__PURE__*/React.createElement("div", {
      className: "font-mono text-[10px] tracking-[0.2em] mt-6",
      style: {
        color: C.faint
      }
    }, "RECORD LEVEL · ", RECORD[security]), /*#__PURE__*/React.createElement(ExportRow, null), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col sm:flex-row gap-3 justify-center mt-8"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onReplay,
      className: "flex items-center justify-center gap-2 px-5 py-3 rounded font-mono text-[11px] tracking-[0.1em]",
      style: {
        border: `1px solid ${C.gold}`,
        color: C.gold
      }
    }, /*#__PURE__*/React.createElement(Play, {
      size: 14
    }), " REPLAY THE SESSION"), /*#__PURE__*/React.createElement("button", {
      onClick: onNewCase,
      className: "flex items-center justify-center gap-2 px-5 py-3 rounded font-mono text-[11px] tracking-[0.1em]",
      style: {
        background: C.gold,
        color: C.field
      }
    }, /*#__PURE__*/React.createElement(Plus, {
      size: 14
    }), " START A NEW CASE"), /*#__PURE__*/React.createElement("button", {
      onClick: onExit,
      className: "flex items-center justify-center gap-2 px-5 py-3 rounded font-mono text-[11px] tracking-[0.1em]",
      style: {
        border: `1px solid ${C.line}`,
        color: C.dim
      }
    }, /*#__PURE__*/React.createElement(X, {
      size: 14
    }), " EXIT")));
  }

  // (2) Saved but still open — a backtrackable checkpoint.
  if (savedOpen) {
    return /*#__PURE__*/React.createElement("div", {
      className: "rounded-lg p-10 text-center",
      style: {
        background: C.panel,
        border: `1px solid ${C.teal}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-center mb-5"
    }, /*#__PURE__*/React.createElement(Anchor, {
      size: 36,
      style: {
        color: C.teal
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "font-serif mb-3",
      style: {
        fontSize: 24,
        color: C.ivory
      }
    }, "Saved — and still open"), /*#__PURE__*/React.createElement("p", {
      className: "max-w-md mx-auto leading-relaxed",
      style: {
        color: C.dim,
        fontSize: 15
      }
    }, "Kept as a working checkpoint. Use ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: C.ivory
      }
    }, "Backtrack"), " in the top bar to step back into any fork and revise — the checklist runs again on that road. When it's settled, finalize it."), /*#__PURE__*/React.createElement("div", {
      className: "font-mono text-[10px] tracking-[0.2em] mt-6 mb-6",
      style: {
        color: C.faint
      }
    }, "RECORD LEVEL · ", RECORD[security]), /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfirmed(true),
      className: "inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded font-mono text-[12px] tracking-[0.15em]",
      style: {
        background: C.gold,
        color: C.field
      }
    }, /*#__PURE__*/React.createElement(Check, {
      size: 16
    }), " FINALIZE THIS SESSION"), /*#__PURE__*/React.createElement(ExportRow, null));
  }

  // (3) Pre-save — choose the record level, then how to save.
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 py-4",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-1",
    style: {
      color: C.gold
    }
  }, "FINAL"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 22,
      color: C.ivory
    }
  }, "Confirm how this is kept")), /*#__PURE__*/React.createElement("div", {
    className: "p-6"
  }, /*#__PURE__*/React.createElement(StepLine, null, "Chosen knowingly, not ridden silently from setup. How should this session be recorded?"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-3 mb-6"
  }, secOpts.map(([id, Icon, title, desc]) => {
    const on = security === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => setSecurity(id),
      className: "text-left rounded-lg p-4",
      style: {
        background: on ? C.goldWell : C.panel2,
        border: `1px solid ${on ? C.gold : C.line}`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      size: 16,
      style: {
        color: on ? C.gold : C.dim
      },
      className: "mb-2"
    }), /*#__PURE__*/React.createElement("div", {
      className: "font-mono text-[12px] tracking-wide mb-1",
      style: {
        color: on ? C.gold : C.ivory
      }
    }, title), /*#__PURE__*/React.createElement("div", {
      className: "text-[12px]",
      style: {
        color: C.faint
      }
    }, desc));
  })), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-3 mb-5 font-mono text-[11px] leading-relaxed",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`,
      color: C.faint
    }
  }, "Two ways to save: keep it ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.teal
    }
  }, "backtrackable"), " to step back into the tree and revise, or commit it as ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gold
    }
  }, "final"), " and move on."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onSaveOpen,
    className: "flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded font-mono text-[12px] tracking-[0.12em]",
    style: {
      border: `1px solid ${C.teal}`,
      color: C.teal
    }
  }, /*#__PURE__*/React.createElement(Anchor, {
    size: 15
  }), " SAVE — KEEP BACKTRACKABLE"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmed(true),
    className: "flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded font-mono text-[12px] tracking-[0.12em]",
    style: {
      background: C.gold,
      color: C.field
    }
  }, /*#__PURE__*/React.createElement(Check, {
    size: 15
  }), " SAVE AS FINAL"))));
}

/* ================================================================== */
/*  TRACE PANEL — the live descent (summary surface)                  */
/* ================================================================== */
function TracePanel({
  nodes,
  rootId,
  currentId
}) {
  const root = rootId ? nodes[rootId] : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg self-start sticky top-6",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-3",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em]",
    style: {
      color: C.faint
    }
  }, "THE DESCENT TRACE")), /*#__PURE__*/React.createElement("div", {
    className: "p-5 overflow-auto",
    style: {
      maxHeight: "70vh"
    }
  }, root ? /*#__PURE__*/React.createElement(NodeView, {
    id: rootId,
    nodes: nodes,
    currentId: currentId
  }) : /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px]",
    style: {
      color: C.faint
    }
  }, "No trace yet."), /*#__PURE__*/React.createElement(Legend, null)));
}
function NodeView({
  id,
  nodes,
  currentId
}) {
  const n = nodes[id];
  if (!n) return null;
  const isCurrent = id === currentId;
  const decided = n.split != null && n.names.a && n.names.b;
  const heavier = n.heavier || (n.split != null ? n.split >= 50 ? "a" : "b" : null);
  const heavyChild = n.childHeavyId ? nodes[n.childHeavyId] : null;
  const parkedChild = n.childParkedId ? nodes[n.childParkedId] : null;
  const nameColor = which => heavier === which ? C.gold : C.teal;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "rounded px-3 py-2 mb-1",
    style: {
      background: isCurrent ? C.panel2 : "transparent",
      border: `1px solid ${isCurrent ? C.gold : "transparent"}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[8px] tracking-[0.2em] mb-1",
    style: {
      color: C.faint
    }
  }, n.branchType === "root" ? "ROOT" : n.branchType === "parked" ? "PARKED" : `L${n.depth}`, n.status === "stopped" && " · GROUND", n.status === "ignored" && " · SET ASIDE"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif leading-tight",
    style: {
      fontSize: 14,
      color: C.ivory
    }
  }, n.heading), decided && /*#__PURE__*/React.createElement("div", {
    className: "mt-1.5 space-y-0.5"
  }, /*#__PURE__*/React.createElement(Row, {
    name: n.names.a,
    pct: n.split,
    on: heavier === "a",
    color: nameColor("a")
  }), /*#__PURE__*/React.createElement(Row, {
    name: n.names.b,
    pct: 100 - n.split,
    on: heavier === "b",
    color: nameColor("b")
  })), n.status === "active" && !decided && /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] mt-1",
    style: {
      color: C.gold
    }
  }, "working…"), n.status === "stopped" && (n.stopSigns || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1 mt-1.5"
  }, n.stopSigns.map(s => /*#__PURE__*/React.createElement("span", {
    key: s,
    className: "font-mono px-1.5 py-0.5 rounded",
    style: {
      fontSize: 8,
      letterSpacing: "0.05em",
      background: C.tealWell,
      color: C.teal,
      border: `1px solid ${C.tealDim}`
    }
  }, signShort(s))))), heavyChild && /*#__PURE__*/React.createElement("div", {
    className: "ml-3 pl-3",
    style: {
      borderLeft: `2px solid ${C.gold}`
    }
  }, /*#__PURE__*/React.createElement(NodeView, {
    id: heavyChild.id,
    nodes: nodes,
    currentId: currentId
  })), parkedChild && /*#__PURE__*/React.createElement("div", {
    className: "ml-3 pl-3 mt-1",
    style: {
      borderLeft: `2px dashed ${C.tealDim}`
    }
  }, parkedChild.status === "parked" || parkedChild.status === "ignored" ? /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[8px] tracking-[0.2em]",
    style: {
      color: C.faint
    }
  }, "PARKED · ", parkedChild.share, "%", parkedChild.status === "ignored" ? " · SET ASIDE" : ""), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 13,
      color: parkedChild.status === "ignored" ? C.faint : C.teal
    }
  }, parkedChild.heading)) : /*#__PURE__*/React.createElement(NodeView, {
    id: parkedChild.id,
    nodes: nodes,
    currentId: currentId
  })));
}
function Row({
  name,
  pct,
  on,
  color
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] w-7",
    style: {
      color
    }
  }, pct, "%"), /*#__PURE__*/React.createElement("span", {
    className: "truncate",
    style: {
      fontSize: 12,
      color: on ? C.ivory : C.dim
    }
  }, name), on && /*#__PURE__*/React.createElement(ArrowDownRight, {
    size: 11,
    style: {
      color: C.gold
    }
  }));
}
function Legend() {
  const items = [["gold", C.gold, "committed"], ["teal", C.teal, "parked"], ["slate", C.slate, "contingent"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3 mt-4 pt-3",
    style: {
      borderTop: `1px solid ${C.line}`
    }
  }, items.map(([k, c, l]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 3,
      background: c,
      display: "inline-block",
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[9px] tracking-wide",
    style: {
      color: C.faint
    }
  }, l))));
}

/* ================================================================== */
/*  CO-PILOT VOICE + shared bits                                      */
/* ================================================================== */
function CoPilotVoice({
  line,
  note
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, /*#__PURE__*/React.createElement(Compass, {
    size: 13,
    style: {
      color: C.teal
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[9px] tracking-[0.3em]",
    style: {
      color: C.teal
    }
  }, "CO-PILOT")), /*#__PURE__*/React.createElement("p", {
    className: "font-serif italic leading-relaxed mb-2",
    style: {
      color: C.ivory,
      fontSize: 17
    }
  }, line), note && /*#__PURE__*/React.createElement("p", {
    className: "text-[12px] leading-relaxed",
    style: {
      color: C.faint
    }
  }, note));
}
function CoPilotFlag({
  copilot,
  onClose
}) {
  const col = copilot.soft ? C.teal : C.alert;
  const well = copilot.soft ? C.tealWell : "#2A1E14";
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4 mb-5 flex gap-3",
    style: {
      background: well,
      border: `1px solid ${col}`
    }
  }, /*#__PURE__*/React.createElement(Compass, {
    size: 16,
    style: {
      color: col,
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[9px] tracking-[0.3em]",
    style: {
      color: col
    }
  }, "CO-PILOT"), !copilot.soft && /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[9px] tracking-[0.15em]",
    style: {
      color: C.faint
    }
  }, "· PROCESS CHECK")), /*#__PURE__*/React.createElement("div", {
    className: "font-serif mb-1",
    style: {
      fontSize: 16,
      color: C.ivory
    }
  }, copilot.title), /*#__PURE__*/React.createElement("p", {
    className: "text-[13px] leading-relaxed",
    style: {
      color: C.dim
    }
  }, copilot.body)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.faint
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 15
  })));
}
function StepDots({
  index
}) {
  const labels = ["enumerate", "sort", "name", "weigh", "decide"];
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5"
  }, labels.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: l,
    className: "flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-1.5 h-1.5 rounded-full",
    style: {
      background: i <= index ? C.gold : C.line
    }
  }), i === index && /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[9px] tracking-[0.15em]",
    style: {
      color: C.gold
    }
  }, l.toUpperCase()))));
}
function Frame({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mx-auto px-6 py-14",
    style: {
      maxWidth: 760
    }
  }, children);
}
function Eyebrow({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.3em] mb-4",
    style: {
      color: C.gold
    }
  }, children);
}
function StepLine({
  children
}) {
  return /*#__PURE__*/React.createElement("p", {
    className: "leading-relaxed mb-5",
    style: {
      color: C.dim,
      fontSize: 15
    }
  }, children);
}
function NextButton({
  label,
  onClick,
  disabled
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    className: "flex items-center gap-2 px-6 py-3 rounded font-mono text-[12px] tracking-[0.12em]",
    style: {
      background: C.gold,
      color: C.field,
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, label.toUpperCase(), " ", /*#__PURE__*/React.createElement(ChevronRight, {
    size: 15
  }));
}
function BackButton({
  onClick,
  label = "Back"
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    className: "flex items-center gap-2 px-5 py-3 rounded font-mono text-[12px] tracking-[0.12em]",
    style: {
      border: `1px solid ${C.line}`,
      color: C.dim
    }
  }, /*#__PURE__*/React.createElement(CornerUpLeft, {
    size: 13
  }), " ", label.toUpperCase());
}

/* ================================================================== */
/*  OVERLAYS                                                          */
/* ================================================================== */
function PauseOverlay({
  onResume
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 flex items-center justify-center z-50",
    style: {
      background: "rgba(15,15,12,0.92)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement(Pause, {
    size: 40,
    style: {
      color: C.gold
    },
    className: "mx-auto mb-6"
  }), /*#__PURE__*/React.createElement("div", {
    className: "font-serif mb-2",
    style: {
      fontSize: 26,
      color: C.ivory
    }
  }, "Session paused"), /*#__PURE__*/React.createElement("p", {
    className: "mb-8 max-w-xs mx-auto",
    style: {
      color: C.dim,
      fontSize: 14
    }
  }, "The tree, the reasoning, and the dial are held exactly where you left them."), /*#__PURE__*/React.createElement("button", {
    onClick: onResume,
    className: "flex items-center gap-2 px-7 py-3 rounded font-mono text-[12px] tracking-[0.15em] mx-auto",
    style: {
      background: C.gold,
      color: C.field
    }
  }, /*#__PURE__*/React.createElement(Play, {
    size: 14
  }), " RESUME")));
}
function BacktrackModal({
  nodes,
  rootId,
  currentId,
  onPick,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 flex items-center justify-center z-50 p-6",
    style: {
      background: "rgba(15,15,12,0.9)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg w-full max-w-lg",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-4 flex items-center justify-between",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-1",
    style: {
      color: C.gold
    }
  }, "BACKTRACK"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 18,
      color: C.ivory
    }
  }, "Take an earlier fork again")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.faint
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-5 overflow-auto",
    style: {
      maxHeight: "60vh"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[13px] mb-4 leading-relaxed",
    style: {
      color: C.dim
    }
  }, "Pick a split to return to. Its downstream branches will be cleared, and the fork you try gets the full checklist again — backtracking is a different road, not a shortcut past the process."), /*#__PURE__*/React.createElement(BacktrackList, {
    id: rootId,
    nodes: nodes,
    currentId: currentId,
    onPick: onPick,
    depth: 0
  }))));
}
function BacktrackList({
  id,
  nodes,
  currentId,
  onPick,
  depth
}) {
  const n = nodes[id];
  if (!n) return null;
  const selectable = n.split != null; // has been worked
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: depth * 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => selectable && onPick(id),
    disabled: !selectable || id === currentId,
    className: "w-full text-left rounded px-3 py-2 mb-1 flex items-center justify-between",
    style: {
      background: id === currentId ? C.panel2 : "transparent",
      border: `1px solid ${selectable && id !== currentId ? C.line : "transparent"}`,
      opacity: selectable ? 1 : 0.5,
      cursor: selectable && id !== currentId ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-serif",
    style: {
      fontSize: 14,
      color: C.ivory
    }
  }, n.heading), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[9px] tracking-wide",
    style: {
      color: id === currentId ? C.gold : C.faint
    }
  }, id === currentId ? "HERE NOW" : selectable ? "GO BACK" : "—")), n.childHeavyId && /*#__PURE__*/React.createElement(BacktrackList, {
    id: n.childHeavyId,
    nodes: nodes,
    currentId: currentId,
    onPick: onPick,
    depth: depth + 1
  }), n.childParkedId && nodes[n.childParkedId] && nodes[n.childParkedId].split != null && /*#__PURE__*/React.createElement(BacktrackList, {
    id: n.childParkedId,
    nodes: nodes,
    currentId: currentId,
    onPick: onPick,
    depth: depth + 1
  }));
}

/* ================================================================== */
/*  KEY MODAL — connect Gemini for live enumeration                   */
/* ================================================================== */
function KeyModal({
  initialKey,
  initialPaid,
  initialOn,
  initialAllowPriv,
  initialModel,
  security,
  onClose,
  onSave
}) {
  const [k, setK] = useState(initialKey || "");
  const [paid, setPaid] = useState(!!initialPaid);
  const [on, setOn] = useState(initialOn !== false);
  const [allowPriv, setAllowPriv] = useState(!!initialAllowPriv);
  const [model, setModel] = useState(initialModel || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // {ok, msg}
  const privateFree = security === "private" && !paid;
  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      localStorage.setItem(LS.model, (model || "").trim());
    } catch {}
    try {
      await callGemini((k || "").trim(), "Reply with the single word: ok", "ping");
      const used = lsGet(MODEL_OK);
      setTestResult({
        ok: true,
        msg: used ? "Connected — using " + used + "." : "Connected — the key works."
      });
    } catch (e) {
      setTestResult({
        ok: false,
        msg: diagnoseLiveError(e)
      });
    } finally {
      setTesting(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 flex items-center justify-center z-50 p-6",
    style: {
      background: "rgba(15,15,12,0.9)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg w-full max-w-lg",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-4 flex items-center justify-between",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 15,
    style: {
      color: C.teal
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em]",
    style: {
      color: C.teal
    }
  }, "CO-PILOT SUGGESTIONS"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 18,
      color: C.ivory
    }
  }, "Live enumeration via Gemini"))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.faint
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[13px] leading-relaxed mb-4",
    style: {
      color: C.dim
    }
  }, "The co-pilot's only job here is to ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ivory
    }
  }, "list"), " possible contributors — it never weighs, ranks, or recommends. With a key it draws that list live; without one it uses its built-in list, fully on-device."), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[10px] tracking-[0.2em]",
    style: {
      color: C.gold
    }
  }, "GEMINI API KEY"), /*#__PURE__*/React.createElement("a", {
    href: "https://aistudio.google.com/apikey",
    target: "_blank",
    rel: "noreferrer",
    className: "font-mono text-[10px] tracking-wide",
    style: {
      color: C.teal
    }
  }, "GET A FREE KEY ↗")), /*#__PURE__*/React.createElement("input", {
    value: k,
    onChange: e => setK(e.target.value),
    type: "password",
    placeholder: "AIza…",
    className: "w-full px-3 py-2.5 rounded bg-transparent mb-1",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`,
      color: C.ivory,
      fontSize: 14
    }
  }), /*#__PURE__*/React.createElement("p", {
    className: "font-mono text-[10px] mb-4",
    style: {
      color: C.faint
    }
  }, "Saved locally on your device only. Sent nowhere but Google's API when a suggestion is drawn."), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "font-mono text-[10px] tracking-[0.2em]",
    style: {
      color: C.gold
    }
  }, "MODEL — OPTIONAL"), /*#__PURE__*/React.createElement("button", {
    onClick: runTest,
    disabled: testing || !k.trim(),
    className: "font-mono text-[10px] tracking-wide",
    style: {
      color: C.teal,
      opacity: testing || !k.trim() ? 0.5 : 1
    }
  }, testing ? "TESTING…" : "TEST CONNECTION")), /*#__PURE__*/React.createElement("input", {
    value: model,
    onChange: e => setModel(e.target.value),
    placeholder: "auto — picks the best available",
    className: "w-full px-3 py-2.5 rounded bg-transparent mb-1 font-mono",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`,
      color: C.ivory,
      fontSize: 13
    }
  }), /*#__PURE__*/React.createElement("p", {
    className: "font-mono text-[10px] mb-3",
    style: {
      color: C.faint
    }
  }, "Leave blank to let the app pick the cheapest working model from your key automatically. Only set this to force one."), testResult && /*#__PURE__*/React.createElement("div", {
    className: "rounded p-2.5 mb-4 text-[12px] leading-snug",
    style: {
      background: C.panel2,
      border: `1px solid ${testResult.ok ? C.tealDim : C.goldDim}`,
      color: testResult.ok ? C.teal : C.ivory
    }
  }, testResult.ok ? "✓ " : "✕ ", testResult.msg), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-2 mb-3 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: paid,
    onChange: e => setPaid(e.target.checked),
    style: {
      marginTop: 3,
      accentColor: C.gold
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[12px] leading-snug",
    style: {
      color: C.dim
    }
  }, "This is a ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ivory
    }
  }, "paid"), " Gemini key. On the paid tier Google doesn't use prompts for training — so live suggestions are safe to run even in Private mode.")), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-2 mb-4 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: on,
    onChange: e => setOn(e.target.checked),
    style: {
      marginTop: 3,
      accentColor: C.gold
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[12px] leading-snug",
    style: {
      color: C.dim
    }
  }, "Use live suggestions when allowed.")), privateFree && /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-3 mb-4",
    style: {
      background: C.tealWell,
      border: `1px solid ${C.tealDim}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-3"
  }, /*#__PURE__*/React.createElement(Lock, {
    size: 14,
    style: {
      color: C.teal,
      marginTop: 1,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-[12px] leading-relaxed",
    style: {
      color: C.dim
    }
  }, "This session is ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.teal
    }
  }, "Private"), " and the key is free-tier, where Google may use prompts to improve its products. To honour “visible only to you,” the co-pilot stays on-device here — unless you knowingly allow it below. Marking a paid key removes this entirely.")), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-2 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: allowPriv,
    onChange: e => setAllowPriv(e.target.checked),
    style: {
      marginTop: 3,
      accentColor: C.teal
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[12px] leading-snug",
    style: {
      color: C.ivory
    }
  }, "Use my free key in Private mode anyway — I accept the question may be sent to Google and used to improve its products."))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onSave(k.trim(), paid, on, allowPriv, (model || "").trim());
      onClose();
    },
    className: "flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded font-mono text-[12px] tracking-[0.12em]",
    style: {
      background: C.gold,
      color: C.field
    }
  }, /*#__PURE__*/React.createElement(Check, {
    size: 15
  }), " SAVE"), initialKey && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onSave("", false, false, false, "");
      onClose();
    },
    className: "px-5 py-3 rounded font-mono text-[12px] tracking-[0.12em]",
    style: {
      border: `1px solid ${C.line}`,
      color: C.dim
    }
  }, "REMOVE KEY")))));
}

/* ================================================================== */
/*  REPLAY — read-only walk back through the descent as it was built  */
/* ================================================================== */
function Replay({
  nodes,
  rootId,
  mainStatement,
  parkedStatement,
  onExit,
  isExample,
  title
}) {
  const order = [];
  (function walk(id) {
    const n = nodes[id];
    if (!n) return;
    order.push(id);
    if (n.childHeavyId) walk(n.childHeavyId);
    if (n.childParkedId) walk(n.childParkedId);
  })(rootId);
  const total = order.length + 1; // + the closing articulation
  const [i, setI] = useState(0);
  const atEnd = i >= total - 1;
  const n = i < order.length ? nodes[order[i]] : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "mx-auto px-6 py-8",
    style: {
      maxWidth: 820
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Play, {
    size: 14,
    style: {
      color: isExample ? C.teal : C.gold
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] tracking-[0.2em]",
    style: {
      color: isExample ? C.teal : C.gold
    }
  }, isExample ? "WORKED EXAMPLE" : "REPLAY"), isExample && title && /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] hidden sm:inline",
    style: {
      color: C.faint
    }
  }, "· ", title)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px]",
    style: {
      color: C.faint
    }
  }, i + 1, " / ", total), /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "font-mono text-[10px] tracking-wide flex items-center gap-1",
    style: {
      color: C.dim
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 12
  }), " ", isExample ? "CLOSE" : "CLOSE"))), isExample && /*#__PURE__*/React.createElement("p", {
    className: "font-mono text-[10px] mb-4",
    style: {
      color: C.faint
    }
  }, "From The Binary Decision Path — a finished session, read-only."), /*#__PURE__*/React.createElement("div", {
    className: "h-1 rounded-full mb-8 overflow-hidden",
    style: {
      background: C.line
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${(i + 1) / total * 100}%`,
      height: "100%",
      background: C.gold,
      transition: "width .3s"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-6 mb-8",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`,
      minHeight: 260
    }
  }, n ? /*#__PURE__*/React.createElement(ReplayNode, {
    n: n
  }) : /*#__PURE__*/React.createElement(ReplayArticulation, {
    main: mainStatement,
    parked: parkedStatement
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setI(x => Math.max(0, x - 1)),
    disabled: i === 0,
    className: "flex items-center gap-2 px-5 py-3 rounded font-mono text-[11px] tracking-[0.1em]",
    style: {
      border: `1px solid ${C.line}`,
      color: C.dim,
      opacity: i === 0 ? 0.4 : 1
    }
  }, /*#__PURE__*/React.createElement(CornerUpLeft, {
    size: 14
  }), " BACK"), atEnd ? /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded font-mono text-[11px] tracking-[0.1em]",
    style: {
      background: C.gold,
      color: C.field
    }
  }, /*#__PURE__*/React.createElement(Check, {
    size: 15
  }), " FINISH REPLAY") : /*#__PURE__*/React.createElement("button", {
    onClick: () => setI(x => x + 1),
    className: "flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded font-mono text-[11px] tracking-[0.1em]",
    style: {
      background: C.gold,
      color: C.field
    }
  }, "NEXT ", /*#__PURE__*/React.createElement(ChevronRight, {
    size: 16
  }))));
}
function ReplayNode({
  n
}) {
  const decided = n.split != null && n.names.a && n.names.b;
  const heavier = n.heavier || (n.split != null ? n.split >= 50 ? "a" : "b" : null);
  const heavyName = heavier === "a" ? n.names.a : n.names.b;
  const label = n.branchType === "root" ? "PRIME QUESTION" : n.branchType === "parked" ? `PARKED BRANCH · ${n.share}%` : `LEVEL ${n.depth}`;
  const labelColor = n.branchType === "parked" ? C.teal : C.gold;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-2",
    style: {
      color: labelColor
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "font-serif mb-5",
    style: {
      fontSize: 25,
      color: C.ivory,
      lineHeight: 1.2
    }
  }, n.heading), decided ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3 mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4",
    style: {
      background: heavier === "a" ? C.goldWell : C.panel2,
      border: `1px solid ${heavier === "a" ? C.gold : C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.2em] mb-1",
    style: {
      color: heavier === "a" ? C.gold : C.faint
    }
  }, n.split, "%", heavier === "a" ? n.status === "stopped" ? " · HEAVIER" : " · FOLLOWED" : ""), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 17,
      color: C.ivory
    }
  }, n.names.a)), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4",
    style: {
      background: heavier === "b" ? C.goldWell : C.panel2,
      border: `1px solid ${heavier === "b" ? C.gold : C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.2em] mb-1",
    style: {
      color: heavier === "b" ? C.gold : C.faint
    }
  }, 100 - n.split, "%", heavier === "b" ? n.status === "stopped" ? " · HEAVIER" : " · FOLLOWED" : ""), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 17,
      color: C.ivory
    }
  }, n.names.b))), n.reason && n.reason.trim() && /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-4 mb-4",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[9px] tracking-[0.2em] mb-1",
    style: {
      color: C.gold
    }
  }, "THE REASON"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 15,
      color: C.dim
    }
  }, n.reason)), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 15,
      color: C.dim
    }
  }, n.status === "stopped" ? /*#__PURE__*/React.createElement(React.Fragment, null, "Reached the ground", (n.stopSigns || []).length ? /*#__PURE__*/React.createElement(React.Fragment, null, " — ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.teal
    }
  }, n.stopSigns.map(signShort).join(", "))) : null, ".") : n.childHeavyId ? /*#__PURE__*/React.createElement(React.Fragment, null, "Followed the heavier line into “", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gold
    }
  }, heavyName), ".”") : null)) : /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 15,
      color: C.dim
    }
  }, n.status === "stopped" ? /*#__PURE__*/React.createElement(React.Fragment, null, "Reached the ground", (n.stopSigns || []).length ? /*#__PURE__*/React.createElement(React.Fragment, null, " — ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.teal
    }
  }, n.stopSigns.map(signShort).join(", "))) : null, ".") : n.status === "ignored" ? "Set aside on purpose — a flank noted, not taken further." : n.status === "parked" ? `Parked at ${n.share}% — held in reserve.` : "Not carried further."));
}
function ReplayArticulation({
  main,
  parked
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em] mb-2",
    style: {
      color: C.gold
    }
  }, "THE ARTICULATION"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif mb-6",
    style: {
      fontSize: 24,
      color: C.ivory
    }
  }, "The strategy, in your words"), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-5 mb-4 font-serif",
    style: {
      background: C.goldWell,
      border: `1px solid ${C.goldDim}`,
      fontSize: 17,
      color: C.ivory,
      lineHeight: 1.5
    }
  }, main || "—"), parked && parked.trim() && /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-5 font-serif",
    style: {
      background: C.tealWell,
      border: `1px solid ${C.tealDim}`,
      fontSize: 16,
      color: C.ivory,
      lineHeight: 1.5
    }
  }, parked));
}
function ExitScreen({
  onReopen
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "w-full min-h-screen flex items-center justify-center font-sans px-6",
    style: {
      background: C.field,
      color: C.ivory
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-center mb-5"
  }, /*#__PURE__*/React.createElement(Mark, {
    size: 40
  })), /*#__PURE__*/React.createElement("div", {
    className: "font-serif mb-3",
    style: {
      fontSize: 22
    }
  }, "The cockpit is closed"), /*#__PURE__*/React.createElement("p", {
    className: "mb-6",
    style: {
      color: C.dim,
      fontSize: 14
    }
  }, "Your session was saved. You can close this window now."), /*#__PURE__*/React.createElement("button", {
    onClick: onReopen,
    className: "font-mono text-[11px] tracking-[0.1em] px-5 py-2.5 rounded",
    style: {
      border: `1px solid ${C.line}`,
      color: C.dim
    }
  }, "REOPEN")));
}

/* ================================================================== */
/*  WORKED EXAMPLES — the two cases from The Binary Decision Path,     */
/*  authored as finished sessions the Replay view walks read-only.    */
/* ================================================================== */
const EX_BOARDROOM = {
  key: "boardroom",
  title: "The boardroom",
  subtitle: "How do we improve the bottom line?",
  rootId: "b1",
  mainStatement: "Lift the bottom line through revenue rather than cost; within revenue through volume rather than price; within volume through existing products; and there, through existing markets — a move a team can start on Monday.",
  parkedStatement: "Cost, price, new products, and new markets aren't dropped — they're parked, to be worked later and to shallower depth, in proportion to the leverage each carries.",
  nodes: {
    b1: {
      id: "b1",
      parentId: null,
      heading: "Improve the bottom line",
      branchType: "root",
      depth: 0,
      share: 100,
      status: "committed",
      contributors: [{
        id: "b1a",
        text: "pricing",
        tag: 2,
        source: "user"
      }, {
        id: "b1b",
        text: "headcount",
        tag: 2,
        source: "user"
      }, {
        id: "b1c",
        text: "new product line",
        tag: 1,
        source: "user"
      }, {
        id: "b1d",
        text: "supply contracts",
        tag: 2,
        source: "user"
      }, {
        id: "b1e",
        text: "marketing spend",
        tag: 1,
        source: "user"
      }, {
        id: "b1f",
        text: "underperforming region",
        tag: 1,
        source: "user"
      }],
      names: {
        a: "Revenue",
        b: "Cost"
      },
      split: 70,
      heavier: "a",
      reason: "Held at equal effort, revenue has more room to move than cost — the same push returns more. Cost isn't deleted; it's parked.",
      childHeavyId: "b2",
      childParkedId: "b3",
      stopSigns: []
    },
    b2: {
      id: "b2",
      parentId: "b1",
      heading: "Revenue",
      branchType: "heavy",
      depth: 1,
      share: 70,
      status: "committed",
      contributors: [{
        id: "b2a",
        text: "units sold",
        tag: 1,
        source: "ai"
      }, {
        id: "b2b",
        text: "market reach",
        tag: 1,
        source: "ai"
      }, {
        id: "b2c",
        text: "list pricing",
        tag: 2,
        source: "ai"
      }, {
        id: "b2d",
        text: "discount policy",
        tag: 2,
        source: "ai"
      }],
      names: {
        a: "Volume",
        b: "Price"
      },
      split: 70,
      heavier: "a",
      reason: "For the same effort there's more headroom in how much we sell than in what we charge.",
      childHeavyId: "b4",
      childParkedId: "b5",
      stopSigns: []
    },
    b3: {
      id: "b3",
      parentId: "b1",
      heading: "Cost",
      branchType: "parked",
      depth: 1,
      share: 30,
      status: "parked",
      contributors: [],
      names: {
        a: "",
        b: ""
      },
      split: null,
      heavier: null,
      reason: "",
      childHeavyId: null,
      childParkedId: null,
      stopSigns: []
    },
    b4: {
      id: "b4",
      parentId: "b2",
      heading: "Volume",
      branchType: "heavy",
      depth: 2,
      share: 49,
      status: "committed",
      contributors: [{
        id: "b4a",
        text: "proven catalogue",
        tag: 1,
        source: "ai"
      }, {
        id: "b4b",
        text: "best sellers",
        tag: 1,
        source: "ai"
      }, {
        id: "b4c",
        text: "new product line",
        tag: 2,
        source: "ai"
      }, {
        id: "b4d",
        text: "untested SKUs",
        tag: 2,
        source: "ai"
      }],
      names: {
        a: "Existing products",
        b: "New products"
      },
      split: 80,
      heavier: "a",
      reason: "Selling more of what already works returns faster, for the same push, than launching new lines.",
      childHeavyId: "b6",
      childParkedId: "b7",
      stopSigns: []
    },
    b5: {
      id: "b5",
      parentId: "b2",
      heading: "Price",
      branchType: "parked",
      depth: 2,
      share: 30,
      status: "parked",
      contributors: [],
      names: {
        a: "",
        b: ""
      },
      split: null,
      heavier: null,
      reason: "",
      childHeavyId: null,
      childParkedId: null,
      stopSigns: []
    },
    b6: {
      id: "b6",
      parentId: "b4",
      heading: "Existing products",
      branchType: "heavy",
      depth: 3,
      share: 39,
      status: "committed",
      contributors: [{
        id: "b6a",
        text: "current territories",
        tag: 1,
        source: "ai"
      }, {
        id: "b6b",
        text: "the underperforming region",
        tag: 1,
        source: "ai"
      }, {
        id: "b6c",
        text: "untapped geographies",
        tag: 2,
        source: "ai"
      }, {
        id: "b6d",
        text: "export markets",
        tag: 2,
        source: "ai"
      }],
      names: {
        a: "Existing markets",
        b: "New markets"
      },
      split: 80,
      heavier: "a",
      reason: "There's more to recover in the markets we already serve — the underperforming region especially — than in opening new ones.",
      childHeavyId: "b8",
      childParkedId: "b9",
      stopSigns: []
    },
    b7: {
      id: "b7",
      parentId: "b4",
      heading: "New products",
      branchType: "parked",
      depth: 3,
      share: 20,
      status: "parked",
      contributors: [],
      names: {
        a: "",
        b: ""
      },
      split: null,
      heavier: null,
      reason: "",
      childHeavyId: null,
      childParkedId: null,
      stopSigns: []
    },
    b8: {
      id: "b8",
      parentId: "b6",
      heading: "Existing markets",
      branchType: "heavy",
      depth: 4,
      share: 31,
      status: "stopped",
      contributors: [],
      names: {
        a: "",
        b: ""
      },
      split: null,
      heavier: null,
      reason: "",
      childHeavyId: null,
      childParkedId: null,
      stopSigns: ["actionable"]
    },
    b9: {
      id: "b9",
      parentId: "b6",
      heading: "New markets",
      branchType: "parked",
      depth: 4,
      share: 20,
      status: "parked",
      contributors: [],
      names: {
        a: "",
        b: ""
      },
      split: null,
      heavier: null,
      reason: "",
      childHeavyId: null,
      childParkedId: null,
      stopSigns: []
    }
  }
};
const EX_KITCHEN = {
  key: "kitchen",
  title: "The kitchen table",
  subtitle: "Should I leave my job?",
  rootId: "k1",
  mainStatement: "The real question was never whether to quit — it was how to start growing again. Held against the same courage and the same year of my life, growing where I am edges out leaving, and the next step is the work I've been declining because it scares me.",
  parkedStatement: "Leaving — growing somewhere new — stays on the table, parked and only slightly lighter. The near-even split is itself the finding: this was genuinely close, which is why it had been tearing at me.",
  nodes: {
    k1: {
      id: "k1",
      parentId: null,
      heading: "How do I start growing again?",
      branchType: "root",
      depth: 0,
      share: 100,
      status: "committed",
      contributors: [{
        id: "k1a",
        text: "stopped growing three years ago",
        tag: 1,
        source: "user"
      }, {
        id: "k1b",
        text: "comfort mistaken for growth",
        tag: 1,
        source: "user"
      }, {
        id: "k1c",
        text: "people I've been avoiding",
        tag: 1,
        source: "user"
      }, {
        id: "k1d",
        text: "a cleaner, dramatic exit",
        tag: 2,
        source: "user"
      }, {
        id: "k1e",
        text: "fifteen years of seniority",
        tag: 2,
        source: "user"
      }, {
        id: "k1f",
        text: "good title and money",
        tag: 2,
        source: "user"
      }],
      names: {
        a: "Grow where I am",
        b: "Grow somewhere new"
      },
      split: 55,
      heavier: "a",
      reason: "Held against the same effort, growing where I am edges it out — but only just. The near-even split is the finding: this is genuinely close, which is why it's been tearing at me.",
      childHeavyId: "k2",
      childParkedId: "k3",
      stopSigns: []
    },
    k2: {
      id: "k2",
      parentId: "k1",
      heading: "Grow where I am",
      branchType: "heavy",
      depth: 1,
      share: 55,
      status: "stopped",
      contributors: [{
        id: "k2a",
        text: "the work that scares me",
        tag: 1,
        source: "ai"
      }, {
        id: "k2b",
        text: "the manager role I've dodged",
        tag: 2,
        source: "ai"
      }],
      names: {
        a: "The work that scares me",
        b: "The manager role offered"
      },
      split: 60,
      heavier: "a",
      reason: "The growth I've been declining out of fear is the one that actually moves me — and naming it is the moment the knot came loose. I know what I need to do.",
      childHeavyId: null,
      childParkedId: null,
      stopSigns: ["resistance", "actionable"]
    },
    k3: {
      id: "k3",
      parentId: "k1",
      heading: "Grow somewhere new",
      branchType: "parked",
      depth: 1,
      share: 45,
      status: "parked",
      contributors: [],
      names: {
        a: "",
        b: ""
      },
      split: null,
      heavier: null,
      reason: "",
      childHeavyId: null,
      childParkedId: null,
      stopSigns: []
    }
  }
};
const EXAMPLES = [EX_BOARDROOM, EX_KITCHEN];
function ExamplePicker({
  examples,
  onPick,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 flex items-center justify-center z-50 p-6",
    style: {
      background: "rgba(15,15,12,0.9)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg w-full max-w-lg",
    style: {
      background: C.panel,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-4 flex items-center justify-between",
    style: {
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[10px] tracking-[0.2em]",
    style: {
      color: C.teal
    }
  }, "WORKED EXAMPLES"), /*#__PURE__*/React.createElement("div", {
    className: "font-serif",
    style: {
      fontSize: 18,
      color: C.ivory
    }
  }, "Watch a finished session")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.faint
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[13px] leading-relaxed mb-4",
    style: {
      color: C.dim
    }
  }, "Two cases from ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gold
    }
  }, "The Binary Decision Path"), " — the same two rooms the book opens with — each walked end to end and replayed read-only. Nothing here changes your own session."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, examples.map(ex => /*#__PURE__*/React.createElement("button", {
    key: ex.key,
    onClick: () => onPick(ex),
    className: "w-full text-left rounded-lg p-4 flex items-center justify-between",
    style: {
      background: C.panel2,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-serif mb-0.5",
    style: {
      fontSize: 16,
      color: C.ivory
    }
  }, ex.title), /*#__PURE__*/React.createElement("div", {
    className: "font-mono text-[11px]",
    style: {
      color: C.faint
    }
  }, ex.subtitle)), /*#__PURE__*/React.createElement(Play, {
    size: 16,
    style: {
      color: C.teal
    }
  })))))));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
