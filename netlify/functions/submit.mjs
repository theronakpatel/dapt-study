import { buildRecord, store, DRUGS } from "../lib/shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const params = new URLSearchParams(await req.text());
  if (!(params.get("study_id") || "").trim()) return json({ ok: false, error: "Study ID is required" }, 400);

  const rec = buildRecord(params);
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await store().setJSON(key, rec);

  return json({ ok: true, study_id: rec.study_id,
    totals: Object.fromEntries(DRUGS.map((d) => [d, rec[`mai_total_${d}`]])) });
};

export const config = { path: "/submit" };
