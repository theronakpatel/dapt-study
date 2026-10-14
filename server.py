#!/usr/bin/env python3
"""DAPT-ACS Case Record Form server.

  /                 -> data collection form
  POST /submit      -> appends one record to the CSV file
  /admin            -> list of records (password protected)
  /admin/export.csv -> download all records as CSV (password protected)

Run:  python3 server.py
Env:  PORT (8000), ADMIN_USER (admin), ADMIN_PASSWORD (admin123), CSV_PATH (data/records.csv)
"""
import base64
import csv
import html
import io
import json
import os
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.environ.get("CSV_PATH", os.path.join(BASE, "data", "records.csv"))
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
PORT = int(os.environ.get("PORT", "8000"))

MAI_CRITERIA = [
    ("indication", 3), ("effectiveness", 3), ("dosage", 2), ("correct_directions", 2),
    ("practical_directions", 1), ("drug_drug_interaction", 2), ("drug_disease_interaction", 2),
    ("duplication", 1), ("duration", 1), ("cost", 1),
]
DRUGS = ["aspirin", "p2y12", "ppi"]
MAX_ADR = 5

FIELDS = [
    "submitted_at", "protocol_no",
    # 1. Patient details
    "study_id", "ip_no", "age", "sex", "height_cm", "weight_kg", "smoking_status",
    "smoking_current", "admission_date", "discharge_date", "allergies", "consent",
    # 2. Diagnosis and PCI
    "acs_type", "stent_type", "num_stents", "culprit_vessel", "culprit_other",
    "haemoglobin", "serum_creatinine",
    # 3. Past history & comorbidity
    "hypertension", "diabetes", "ckd", "dyslipidaemia", "previous_mi_pci",
    "previous_bleeding", "other_comorbidity",
    # 4. DAPT prescribed
    "aspirin_loading_mg", "aspirin_maintenance_mg", "p2y12_inhibitor", "p2y12_other",
    "p2y12_loading_mg", "p2y12_maintenance_mg", "p2y12_frequency", "dapt_duration_months",
    "ppi", "anticoagulant", "choice_dose_appropriate",
]
# 5. MAI assessment
FIELDS += [f"mai_{c}_{d}" for c, _ in MAI_CRITERIA for d in DRUGS]
FIELDS += [f"mai_total_{d}" for d in DRUGS]
# 6. Outcomes
FIELDS += ["mace", "adr_bleeding"]
for i in range(1, MAX_ADR + 1):
    FIELDS += [f"adr{i}_event", f"adr{i}_drug", f"adr{i}_barc", f"adr{i}_action"]
FIELDS += ["collected_by", "collected_date", "verified_by", "verified_date"]

SUMMARY_COLS = [
    ("submitted_at", "Submitted"), ("study_id", "Study ID"), ("ip_no", "IP No."),
    ("age", "Age"), ("sex", "Sex"), ("acs_type", "ACS"), ("p2y12_inhibitor", "P2Y12"),
    ("ppi", "PPI"), ("mai_total_aspirin", "MAI Asp"), ("mai_total_p2y12", "MAI P2Y12"),
    ("mai_total_ppi", "MAI PPI"), ("mace", "MACE"), ("adr_bleeding", "ADR"),
    ("collected_by", "Collected by"),
]

lock = threading.Lock()


def safe(value: str) -> str:
    """Neutralise spreadsheet formula injection."""
    value = value.strip().replace("\r", " ").replace("\n", " ")
    if value[:1] in ("=", "+", "@") or (value[:1] == "-" and not value[1:].replace(".", "", 1).isdigit()):
        return "'" + value
    return value


def build_record(form: dict) -> dict:
    rec = {k: safe("; ".join(form.get(k, []))) for k in FIELDS}
    rec["submitted_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for d in DRUGS:  # compute MAI totals server-side: weight counts when rated C (inappropriate)
        rec[f"mai_total_{d}"] = str(sum(w for c, w in MAI_CRITERIA if rec[f"mai_{c}_{d}"] == "C"))
    return rec


def read_records() -> list:
    if not os.path.exists(CSV_PATH):
        return []
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def append_record(rec: dict) -> None:
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    with lock:
        new = not os.path.exists(CSV_PATH) or os.path.getsize(CSV_PATH) == 0
        # utf-8-sig on creation writes a BOM so Excel opens accents/symbols correctly
        with open(CSV_PATH, "a", newline="", encoding="utf-8-sig" if new else "utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
            if new:
                w.writeheader()
            w.writerow(rec)


def admin_page(records: list) -> str:
    e = html.escape
    head = "".join(f"<th>{e(label)}</th>" for _, label in SUMMARY_COLS) + "<th></th>"
    rows = []
    for i, r in enumerate(reversed(records)):
        cells = "".join(f"<td>{e(r.get(k, '') or '—')}</td>" for k, _ in SUMMARY_COLS)
        detail = "".join(
            f"<div><b>{e(k)}</b><span>{e(v)}</span></div>" for k, v in r.items() if v
        )
        rows.append(
            f'<tr class="row">{cells}<td><button onclick="t({i})">View</button></td></tr>'
            f'<tr class="det" id="d{i}" hidden><td colspan="{len(SUMMARY_COLS)+1}"><div class="grid">{detail}</div></td></tr>'
        )
    body = "".join(rows) or f'<tr><td colspan="{len(SUMMARY_COLS)+1}" class="empty">No records yet.</td></tr>'
    with open(os.path.join(BASE, "admin.html"), encoding="utf-8") as f:
        tpl = f.read()
    return tpl.replace("{{COUNT}}", str(len(records))).replace("{{HEAD}}", head).replace("{{ROWS}}", body)


class Handler(BaseHTTPRequestHandler):
    server_version = "CRF/1.0"

    def send(self, code, body, ctype="text/html; charset=utf-8", extra=None):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def authorized(self) -> bool:
        expected = base64.b64encode(f"{ADMIN_USER}:{ADMIN_PASSWORD}".encode()).decode()
        if self.headers.get("Authorization", "") == f"Basic {expected}":
            return True
        self.send(401, "Login required", "text/plain", {"WWW-Authenticate": 'Basic realm="CRF Admin"'})
        return False

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path in ("/", "/index.html"):
            with open(os.path.join(BASE, "index.html"), encoding="utf-8") as f:
                return self.send(200, f.read())
        if path == "/admin":
            if self.authorized():
                return self.send(200, admin_page(read_records()))
            return
        if path == "/admin/export.csv":
            if not self.authorized():
                return
            with lock:
                data = open(CSV_PATH, "rb").read() if os.path.exists(CSV_PATH) else \
                    ("﻿" + ",".join(FIELDS) + "\r\n").encode("utf-8")
            name = f"dapt_acs_records_{datetime.now():%Y%m%d_%H%M}.csv"
            return self.send(200, data, "text/csv; charset=utf-8",
                             {"Content-Disposition": f'attachment; filename="{name}"'})
        self.send(404, "Not found", "text/plain")

    def do_POST(self):
        if urlparse(self.path).path != "/submit":
            return self.send(404, "Not found", "text/plain")
        length = int(self.headers.get("Content-Length", 0))
        if length > 1_000_000:
            return self.send(413, json.dumps({"ok": False, "error": "Too large"}), "application/json")
        form = parse_qs(self.rfile.read(length).decode("utf-8"), keep_blank_values=True)
        if not "".join(form.get("study_id", [])).strip():
            return self.send(400, json.dumps({"ok": False, "error": "Study ID is required"}), "application/json")
        rec = build_record(form)
        append_record(rec)
        self.send(200, json.dumps({"ok": True, "study_id": rec["study_id"], "totals":
                                   {d: rec[f"mai_total_{d}"] for d in DRUGS}}), "application/json")

    def log_message(self, fmt, *args):
        print(f"[{datetime.now():%H:%M:%S}] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    print(f"Form:   http://localhost:{PORT}/")
    print(f"Admin:  http://localhost:{PORT}/admin   (user: {ADMIN_USER})")
    print(f"CSV:    {CSV_PATH}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
