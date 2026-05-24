#!/usr/bin/env python3
"""
FastAPI Backend — Warehouse Reconciliation System
==================================================
Wraps the existing reconcile.py engine and exposes it via HTTP.
Real-time progress is streamed to the frontend via Server-Sent Events (SSE).

Endpoints
---------
POST  /api/upload/wcs          Upload WCS Excel file
POST  /api/upload/wms          Upload WMS Excel file
POST  /api/reconcile           Create reconciliation job (returns job_id)
GET   /api/reconcile/{id}/stream  SSE stream — live progress events
GET   /api/download/{id}       Download Comparison_Report.xlsx
DELETE /api/job/{id}           Cleanup temp files
GET   /api/health              Health check
"""

import asyncio
import io as _io
import json
import os
import shutil
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from openpyxl import load_workbook as _load_wb
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Import reconciliation engine functions
from reconcile import (
    WCS_REQUIRED_COLS,
    WMS_REQUIRED_COLS,
    add_wcs_id,
    add_wms_id,
    clean_wcs,
    clean_wms,
    generate_report,
    get_duplicate_details,
    load_excel,
    match_datasets,
    validate_duplicates,
    validate_id_format,
    validate_no_null_keys,
    validate_row_counts,
    _build_summary,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Warehouse Reconciliation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Temp storage
# ---------------------------------------------------------------------------
TEMP_DIR = Path(tempfile.gettempdir()) / "wh_reconciliation"
TEMP_DIR.mkdir(exist_ok=True)

# In-memory stores
uploads: Dict[str, dict] = {}   # upload_id → {path, filename, rows, cols}
jobs: Dict[str, dict] = {}       # job_id → {wcs_upload_id, wms_upload_id, ...}

_executor = ThreadPoolExecutor(max_workers=4)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_upload(upload_id: str) -> dict:
    if upload_id not in uploads:
        raise HTTPException(404, f"Upload {upload_id!r} not found")
    return uploads[upload_id]


def _get_job(job_id: str) -> dict:
    if job_id not in jobs:
        raise HTTPException(404, f"Job {job_id!r} not found")
    return jobs[job_id]


def _file_size_label(n_bytes: int) -> str:
    if n_bytes >= 1_048_576:
        return f"{n_bytes / 1_048_576:.1f} MB"
    return f"{n_bytes / 1024:.1f} KB"


# ---------------------------------------------------------------------------
# Upload endpoints
# ---------------------------------------------------------------------------

async def _handle_upload(file: UploadFile, file_type: str) -> dict:
    """Common upload handler for both WCS and WMS files."""
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Only Excel files (.xlsx / .xls) are supported")

    upload_id = str(uuid.uuid4())
    upload_dir = TEMP_DIR / "uploads" / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{file_type}_{file.filename}"
    dest = upload_dir / safe_name

    content = await file.read()
    dest.write_bytes(content)

    try:
        # Fast metadata extraction — read_only mode reads only the XML dimension
        # tag + first row. No full file parse (saves 30-120s on low-CPU hosts).
        wb = _load_wb(filename=_io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        first_row = next(ws.rows, [])
        columns = [
            str(c.value).strip() if c.value is not None else f"Col_{i+1}"
            for i, c in enumerate(first_row)
        ]
        row_count = max((ws.max_row or 1) - 1, 0)
        wb.close()
        rows = row_count
    except Exception as exc:
        shutil.rmtree(upload_dir, ignore_errors=True)
        raise HTTPException(400, f"Cannot read Excel file: {exc}")

    record = {
        "upload_id": upload_id,
        "path": str(dest),
        "filename": file.filename,
        "size_bytes": len(content),
        "size_label": _file_size_label(len(content)),
        "rows": rows,
        "columns": columns,
        "uploaded_at": datetime.now().isoformat(),
    }
    uploads[upload_id] = record
    return record


@app.post("/api/upload/wcs")
async def upload_wcs(file: UploadFile = File(...)):
    record = await _handle_upload(file, "wcs")
    return {k: record[k] for k in ("upload_id", "filename", "rows", "columns", "size_label")}


@app.post("/api/upload/wms")
async def upload_wms(file: UploadFile = File(...)):
    record = await _handle_upload(file, "wms")
    return {k: record[k] for k in ("upload_id", "filename", "rows", "columns", "size_label")}


# ---------------------------------------------------------------------------
# Create reconciliation job
# ---------------------------------------------------------------------------

class ReconcileRequest(BaseModel):
    wcs_upload_id: str
    wms_upload_id: str


@app.post("/api/reconcile")
async def create_job(req: ReconcileRequest):
    _get_upload(req.wcs_upload_id)  # validates existence
    _get_upload(req.wms_upload_id)

    job_id = str(uuid.uuid4())
    job_dir = TEMP_DIR / "jobs" / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    jobs[job_id] = {
        "job_id": job_id,
        "wcs_upload_id": req.wcs_upload_id,
        "wms_upload_id": req.wms_upload_id,
        "job_dir": str(job_dir),
        "report_path": None,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }
    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# SSE streaming reconciliation
# ---------------------------------------------------------------------------

@app.get("/api/reconcile/{job_id}/stream")
async def reconcile_stream(job_id: str):
    """
    Opens an SSE connection and runs the reconciliation pipeline in a thread.
    Emits a JSON event for every stage:
      {"step": "...", "status": "processing"|"completed"|"failed", "message": "...", "ts": "HH:MM:SS"}
    Final sentinel event: {"__done__": true}
    """
    job = _get_job(job_id)

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def emit(step: str, status: str, message: str = "", **extra):
        payload = {
            "step": step,
            "status": status,
            "message": message,
            "ts": datetime.now().strftime("%H:%M:%S"),
        }
        payload.update(extra)
        asyncio.run_coroutine_threadsafe(queue.put(json.dumps(payload)), loop)

    def run_pipeline():
        wcs_upload = uploads[job["wcs_upload_id"]]
        wms_upload = uploads[job["wms_upload_id"]]
        job_dir = Path(job["job_dir"])
        output_path = str(job_dir / "Comparison_Report.xlsx")

        try:
            # ── 1. File Validation ────────────────────────────────────────────
            emit("File Validation", "processing", "Loading and validating input files…")
            try:
                wcs_raw = load_excel(wcs_upload["path"], WCS_REQUIRED_COLS)
                wms_raw = load_excel(wms_upload["path"], WMS_REQUIRED_COLS)
                wcs_rows = len(wcs_raw)
                wms_rows = len(wms_raw)
                emit("File Validation", "completed",
                     f"WCS: {wcs_rows:,} rows | WMS: {wms_rows:,} rows loaded")
            except Exception as exc:
                emit("File Validation", "failed", str(exc))
                return

            # ── 2. Data Cleaning ──────────────────────────────────────────────
            emit("Data Cleaning", "processing",
                 "Normalizing strings, removing hidden characters, preserving leading zeros…")
            try:
                wcs_clean = clean_wcs(wcs_raw)
                wms_clean = clean_wms(wms_raw)
                emit("Data Cleaning", "completed", "All key columns cleaned and normalized")
            except Exception as exc:
                emit("Data Cleaning", "failed", str(exc))
                return

            # ── 3. ID Concatenation ───────────────────────────────────────────
            emit("ID Concatenation", "processing",
                 "Building composite matching keys (<Carton Barcode>-<Item> / <ID>-<SKU>)…")
            try:
                wcs_with_id = add_wcs_id(wcs_clean)
                wms_with_id = add_wms_id(wms_clean)
                emit("ID Concatenation", "completed",
                     "Composite IDs built for both datasets")
            except Exception as exc:
                emit("ID Concatenation", "failed", str(exc))
                return

            # ── 4. Duplicate Detection ────────────────────────────────────────
            emit("Duplicate Detection", "processing",
                 "Scanning for duplicate IDs in both datasets…")
            try:
                validate_no_null_keys(wcs_with_id, "ID", "WCS")
                validate_no_null_keys(wms_with_id, "ID", "WMS")
                validate_id_format(wcs_with_id, "ID", "WCS")
                validate_id_format(wms_with_id, "ID", "WMS")
                validate_duplicates(wcs_with_id, "ID", "WCS")
                validate_duplicates(wms_with_id, "ID", "WMS")
                dup_wcs = get_duplicate_details(wcs_with_id, "ID", "WCS")
                dup_wms = get_duplicate_details(wms_with_id, "ID", "WMS")
                dup_df = pd.concat([dup_wcs, dup_wms], ignore_index=True)
                n_dups = len(dup_df)
                msg = ("No duplicates found" if n_dups == 0
                       else f"{n_dups} duplicate ID(s) detected — quantities will be summed")
                emit("Duplicate Detection", "completed", msg, duplicate_count=int(n_dups))
            except Exception as exc:
                emit("Duplicate Detection", "failed", str(exc))
                return

            # ── 5. Quantity Aggregation ───────────────────────────────────────
            emit("Quantity Aggregation", "processing",
                 "Summing quantities per unique ID…")
            try:
                validate_row_counts(wcs_with_id, wms_with_id)
                emit("Quantity Aggregation", "completed",
                     f"WCS: {wcs_rows:,} | WMS: {wms_rows:,} rows aggregated")
            except Exception as exc:
                emit("Quantity Aggregation", "failed", str(exc))
                return

            # ── 6. Record Matching ────────────────────────────────────────────
            emit("Record Matching", "processing",
                 "Running full outer join on composite IDs (VLOOKUP equivalent)…")
            try:
                report_df = match_datasets(wcs_with_id, wms_with_id)
                total = len(report_df)
                matched = int((report_df["Status"] == "Matched").sum())
                emit("Record Matching", "completed",
                     f"{total:,} unique IDs compared")
            except Exception as exc:
                emit("Record Matching", "failed", str(exc))
                return

            # ── 7. Mismatch Analysis ──────────────────────────────────────────
            emit("Mismatch Analysis", "processing",
                 "Calculating match rate and quantity discrepancies…")
            try:
                unmatched = int((report_df["Status"] == "Unmatched").sum())
                missing_wms = int((report_df["Status"] == "Missing in WMS").sum())
                missing_wcs = int((report_df["Status"] == "Missing in WCS").sum())
                match_pct = round((matched / total * 100), 2) if total > 0 else 0.0
                emit(
                    "Mismatch Analysis", "completed",
                    f"Match rate: {match_pct}% | Unmatched: {unmatched:,}",
                    summary={
                        "total": total,
                        "matched": matched,
                        "unmatched": unmatched,
                        "missing_wms": missing_wms,
                        "missing_wcs": missing_wcs,
                        "match_pct": match_pct,
                        "total_wcs_qty": int(report_df["WCS Qty"].sum()),
                        "total_wms_qty": int(report_df["WMS Qty"].sum()),
                    },
                )
            except Exception as exc:
                emit("Mismatch Analysis", "failed", str(exc))
                return

            # ── 8. Excel Report Generation ────────────────────────────────────
            emit("Excel Report Generation", "processing",
                 "Building 5-sheet Excel workbook with conditional formatting…")
            try:
                generate_report(
                    report_df, output_path, dup_df,
                    wcs_upload["path"], wms_upload["path"],
                    wcs_rows, wms_rows,
                )
                emit("Excel Report Generation", "completed",
                     "Comparison_Report.xlsx generated (5 sheets)")
            except Exception as exc:
                emit("Excel Report Generation", "failed", str(exc))
                return

            # ── 9. Final Export Packaging ─────────────────────────────────────
            emit("Final Export Packaging", "processing",
                 "Packaging and verifying final report…")
            try:
                file_size = Path(output_path).stat().st_size
                job["report_path"] = output_path
                job["status"] = "completed"
                emit("Final Export Packaging", "completed",
                     f"Report ready — {_file_size_label(file_size)}",
                     download_ready=True)
            except Exception as exc:
                emit("Final Export Packaging", "failed", str(exc))
                return

        except Exception as exc:
            emit("Pipeline Error", "failed", f"Unexpected error: {exc}")
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)

    # Launch pipeline in thread executor
    loop.run_in_executor(_executor, run_pipeline)

    async def event_generator():
        try:
            while True:
                item = await asyncio.wait_for(queue.get(), timeout=300.0)
                if item is None:
                    yield "data: {\"__done__\": true}\n\n"
                    break
                yield f"data: {item}\n\n"
        except asyncio.TimeoutError:
            yield "data: {\"__done__\": true, \"error\": \"timeout\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Download endpoint
# ---------------------------------------------------------------------------

@app.get("/api/download/{job_id}")
async def download_report(job_id: str):
    job = _get_job(job_id)
    if not job.get("report_path"):
        raise HTTPException(400, "Report not yet generated for this job")
    rp = Path(job["report_path"])
    if not rp.exists():
        raise HTTPException(404, "Report file not found on disk")
    return FileResponse(
        path=str(rp),
        filename="Comparison_Report.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

@app.delete("/api/job/{job_id}")
async def cleanup_job(job_id: str):
    job_dir = TEMP_DIR / "jobs" / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)
    jobs.pop(job_id, None)
    return {"message": "Job cleaned up"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ---------------------------------------------------------------------------
# Serve built frontend in production
# ---------------------------------------------------------------------------

_frontend_dist = Path(__file__).parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="static")


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
