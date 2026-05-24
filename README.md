# Warehouse Data Reconciliation Engine

Compares **WMS** (Warehouse Management System) and **WCS** (Warehouse Control System) Excel exports, matches records by a concatenated ID, compares quantities, and generates a formatted `Comparison_Report.xlsx`.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run reconciliation
python reconcile.py <wcs_file> <wms_file> [output_file]
```

### Example

```bash
python reconcile.py "PTL Close Container_22_May_2026.xlsx" "Export__8_.xlsx"
```

This produces `Comparison_Report.xlsx` in the current directory.

## Input File Requirements

| File | Required Columns |
|------|-----------------|
| **WCS** (e.g. `PTL Close Container_22_May_2026.xlsx`) | `Carton Barcode`, `Item`, `PutQty` |
| **WMS** (e.g. `Export__8_.xlsx`) | `ID`, `SKU`, `Qty` |

## How It Works

1. **Load** — Reads both Excel files; auto-detects the header row if the WMS file has metadata rows above it.
2. **Clean** — Converts key columns to string, strips whitespace, removes hidden characters, preserves leading zeros, converts quantities to numeric safely.
3. **Concatenate** — Builds a common ID:
   - WCS: `<Carton Barcode>-<Item>`
   - WMS: `<ID>-<SKU>`
4. **Validate** — Checks for missing columns, null keys, duplicates, and row counts.
5. **Match** — Full outer join on the concatenated ID (VLOOKUP/XLOOKUP equivalent). Duplicates are aggregated by summing quantities.
6. **Report** — Generates a formatted Excel file with:
   - Green fill for **Matched** rows
   - Red fill for **Unmatched** rows
   - Bold headers, autofilter, frozen top row, auto-adjusted column widths

## Output

`Comparison_Report.xlsx` with a single sheet **Comparison_Report**:

| ID | WCS Qty | WMS Qty | Status |
|----|---------|---------|--------|
| B0002655835-800492-000141 | 5 | 5 | Matched |
| B0002655836-800492-000142 | 3 | 2 | Unmatched |

## Programmatic Usage

```python
from reconcile import reconcile

reconcile(
    wcs_path="PTL Close Container_22_May_2026.xlsx",
    wms_path="Export__8_.xlsx",
    output_path="Comparison_Report.xlsx",
    # Optional: override auto-detected header rows (0-indexed)
    # wms_header_row=3,
    # wcs_header_row=0,
)
```
