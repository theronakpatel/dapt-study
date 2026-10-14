# DAPT in ACS — Case Record Form

Web form for the study *Prescribing Patterns in Patients Receiving Dual Anti-platelet Therapy (DAPT) for Acute Coronary Syndrome (ACS): A Prospective Observational Study* (Protocol KBIEC/2026).

Each submission is appended as one row to a CSV file. No dependencies beyond Python 3.

## Run

```bash
ADMIN_PASSWORD='change-me' python3 server.py
```

| URL | Purpose |
|---|---|
| `/` | Data collection form |
| `/admin` | View records (HTTP basic auth) |
| `/admin/export.csv` | Download all records as CSV |

## Configuration (environment variables)

| Variable | Default |
|---|---|
| `PORT` | `8000` |
| `ADMIN_USER` | `admin` |
| `ADMIN_PASSWORD` | `admin123` — change this |
| `CSV_PATH` | `data/records.csv` |

## Notes

- MAI ratings: A = appropriate, B = marginal, C = inappropriate, NA = not applicable. Totals add the criterion weight for each C, computed server-side.
- Multi-select fields are stored separated by `; `.
- `data/` is git-ignored so collected patient data is never committed. Serve over HTTPS if exposed beyond a local network.
