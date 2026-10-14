import { getStore } from "@netlify/blobs";

export const MAI_CRITERIA = [
  ["indication", 3], ["effectiveness", 3], ["dosage", 2], ["correct_directions", 2],
  ["practical_directions", 1], ["drug_drug_interaction", 2], ["drug_disease_interaction", 2],
  ["duplication", 1], ["duration", 1], ["cost", 1],
];
export const DRUGS = ["aspirin", "p2y12", "ppi"];
export const MAX_ADR = 5;

export const FIELDS = [
  "submitted_at", "protocol_no",
  // 1. Patient details
  "study_id", "ip_no", "age", "sex", "height_cm", "weight_kg", "smoking_status",
  "smoking_current", "admission_date", "discharge_date", "allergies", "consent",
  // 2. Diagnosis and PCI
  "acs_type", "stent_type", "num_stents", "culprit_vessel", "culprit_other",
  "haemoglobin", "serum_creatinine",
  // 3. Past history & comorbidity
  "hypertension", "diabetes", "ckd", "dyslipidaemia", "previous_mi_pci",
  "previous_bleeding", "other_comorbidity",
  // 4. DAPT prescribed
  "aspirin_loading_mg", "aspirin_maintenance_mg", "p2y12_inhibitor", "p2y12_other",
  "p2y12_loading_mg", "p2y12_maintenance_mg", "p2y12_frequency", "dapt_duration_months",
  "ppi", "anticoagulant", "choice_dose_appropriate",
  // 5. MAI assessment
  ...MAI_CRITERIA.flatMap(([c]) => DRUGS.map((d) => `mai_${c}_${d}`)),
  ...DRUGS.map((d) => `mai_total_${d}`),
  // 6. Outcomes
  "mace", "adr_bleeding",
  ...Array.from({ length: MAX_ADR }, (_, i) =>
    ["event", "drug", "barc", "action"].map((k) => `adr${i + 1}_${k}`)).flat(),
  "collected_by", "collected_date", "verified_by", "verified_date",
];

export const store = () => getStore({ name: "crf-records", consistency: "strong" });

/** Neutralise spreadsheet formula injection. */
export function safe(value) {
  const v = String(value).trim().replace(/[\r\n]+/g, " ");
  if (/^[=+@]/.test(v) || (v.startsWith("-") && isNaN(Number(v)))) return "'" + v;
  return v;
}

export function buildRecord(params) {
  const rec = {};
  for (const k of FIELDS) rec[k] = safe(params.getAll(k).join("; "));
  rec.submitted_at = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
  for (const d of DRUGS) {
    rec[`mai_total_${d}`] = String(
      MAI_CRITERIA.reduce((s, [c, w]) => s + (rec[`mai_${c}_${d}`] === "C" ? w : 0), 0));
  }
  return rec;
}

export async function readAll() {
  const s = store();
  const { blobs } = await s.list();
  const keys = blobs.map((b) => b.key).sort();
  const out = [];
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = await Promise.all(keys.slice(i, i + 50).map((k) => s.get(k, { type: "json" })));
    out.push(...chunk.filter(Boolean));
  }
  return out;
}

export function toCSV(records) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [FIELDS.join(","), ...records.map((r) => FIELDS.map((f) => esc(r[f])).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8
}

/** Returns a 401/500 Response if not authorized, otherwise null. */
export function checkAuth(req) {
  const user = Netlify.env.get("ADMIN_USER") || "admin";
  const pass = Netlify.env.get("ADMIN_PASSWORD");
  if (!pass) {
    return new Response("ADMIN_PASSWORD environment variable is not set in Netlify.", { status: 500 });
  }
  const expected = "Basic " + btoa(`${user}:${pass}`);
  if (req.headers.get("authorization") === expected) return null;
  return new Response("Login required", {
    status: 401, headers: { "WWW-Authenticate": 'Basic realm="CRF Admin"' },
  });
}
