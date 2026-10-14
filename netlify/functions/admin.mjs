import { checkAuth, readAll } from "../lib/shared.mjs";

const SUMMARY_COLS = [
  ["submitted_at", "Submitted"], ["study_id", "Study ID"], ["ip_no", "IP No."],
  ["age", "Age"], ["sex", "Sex"], ["acs_type", "ACS"], ["p2y12_inhibitor", "P2Y12"],
  ["ppi", "PPI"], ["mai_total_aspirin", "MAI Asp"], ["mai_total_p2y12", "MAI P2Y12"],
  ["mai_total_ppi", "MAI PPI"], ["mace", "MACE"], ["adr_bleeding", "ADR"],
  ["collected_by", "Collected by"],
];

const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(records) {
  const n = SUMMARY_COLS.length + 1;
  const head = SUMMARY_COLS.map(([, l]) => `<th>${e(l)}</th>`).join("") + "<th></th>";
  const rows = records.slice().reverse().map((r, i) => {
    const cells = SUMMARY_COLS.map(([k]) => `<td>${e(r[k] || "—")}</td>`).join("");
    const detail = Object.entries(r).filter(([, v]) => v)
      .map(([k, v]) => `<div><b>${e(k)}</b><span>${e(v)}</span></div>`).join("");
    return `<tr class="row">${cells}<td><button onclick="t(${i})">View</button></td></tr>` +
      `<tr class="det" id="d${i}" hidden><td colspan="${n}"><div class="grid">${detail}</div></td></tr>`;
  }).join("") || `<tr><td colspan="${n}" class="empty">No records yet.</td></tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CRF Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#f3f6fb;--card:#fff;--ink:#1b2433;--muted:#667085;--line:#e3e8f0;--accent:#0f766e;--soft:#e6f4f2}
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:14px}
  header{background:linear-gradient(120deg,#0f766e,#155e75);color:#fff;padding:22px 16px}
  .wrap{max-width:1200px;margin:0 auto}
  header .wrap{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}
  h1{margin:0;font-size:20px} header p{margin:4px 0 0;opacity:.85}
  .btn{display:inline-block;font:inherit;font-weight:600;padding:10px 16px;border-radius:10px;text-decoration:none}
  .btn.white{background:#fff;color:var(--accent)} .btn.outline{border:1px solid rgba(255,255,255,.6);color:#fff}
  main{padding:20px 16px}
  .bar{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  .bar input{font:inherit;padding:9px 12px;border:1px solid var(--line);border-radius:9px;min-width:220px;flex:1;max-width:360px}
  .stat{background:var(--soft);color:var(--accent);padding:8px 12px;border-radius:9px;font-weight:600}
  .table-wrap{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow-x:auto}
  table{border-collapse:collapse;width:100%}
  th,td{padding:9px 11px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
  th{background:#f8fafc;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  tr.row:hover td{background:#fafcff}
  td button{font:inherit;font-size:12.5px;padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:#fff;cursor:pointer}
  tr.det td{background:#fbfcfe;white-space:normal}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px 18px;padding:6px 0}
  .grid div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dotted var(--line);padding:3px 0}
  .grid b{font-weight:500;color:var(--muted);font-size:12.5px}.grid span{text-align:right;word-break:break-word}
  .empty{text-align:center;color:var(--muted);padding:40px}
</style></head>
<body>
<header><div class="wrap">
  <div><h1>CRF Admin — DAPT in ACS</h1><p>All submitted case records</p></div>
  <div><a class="btn outline" href="/">Open form</a> <a class="btn white" href="/admin/export.csv">⬇ Export CSV</a></div>
</div></header>
<main class="wrap">
  <div class="bar"><span class="stat">${records.length} record(s)</span>
    <input id="q" type="search" placeholder="Search by Study ID, IP No., name…"></div>
  <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
</main>
<script>
function t(i){const d=document.getElementById('d'+i);d.hidden=!d.hidden}
document.getElementById('q').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  document.querySelectorAll('tr.row').forEach(r=>{const s=r.textContent.toLowerCase().includes(q);r.hidden=!s;if(!s)r.nextElementSibling.hidden=true});
});
</script>
</body></html>`;
}

export default async (req) => {
  const denied = checkAuth(req);
  if (denied) return denied;
  return new Response(page(await readAll()), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
};

export const config = { path: ["/admin", "/admin/"] };
