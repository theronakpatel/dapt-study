# DAPT in ACS — Case Record Form

Web form for the study *Prescribing Patterns in Patients Receiving Dual Anti-platelet Therapy (DAPT) for Acute Coronary Syndrome (ACS): A Prospective Observational Study* (Protocol KBIEC/2026).

Hosted on Netlify. Each submission is stored as a record in **Netlify Blobs**; the admin export builds a CSV from all records on demand.

| URL | Purpose |
|---|---|
| `/` | Data collection form (`public/index.html`) |
| `/admin` | View records (HTTP basic auth) |
| `/admin/export.csv` | Download all records as CSV |

## Netlify setup

1. Site configuration → Environment variables → add `ADMIN_PASSWORD` (required) and optionally `ADMIN_USER` (default `admin`).
2. Redeploy. Build settings come from `netlify.toml` (publish `public`, functions `netlify/functions`).

## Layout

```
public/index.html             form
netlify/functions/submit.mjs  POST /submit → saves a record
netlify/functions/admin.mjs   GET /admin
netlify/functions/export.mjs  GET /admin/export.csv
netlify/lib/shared.mjs        field list, MAI scoring, CSV, auth
```

## Local development

```bash
npm install
npx netlify-cli dev
```

## Notes

- MAI ratings: A = appropriate, B = marginal, C = inappropriate, NA = not applicable. Totals add the criterion weight for each C, computed server-side.
- Multi-select fields are stored separated by `; `.
- To add a form field: add the input in `public/index.html` and its name to `FIELDS` in `netlify/lib/shared.mjs`.
