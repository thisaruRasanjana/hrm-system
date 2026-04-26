"""
app/core/config.py
------------------
Single source of truth for all application-wide constants.

WHY: Magic numbers (15, 10, 40) were duplicated in service.py and reports/service.py.
A single entitlement change previously required grep-and-replace across multiple files;
now it is one edit here.
"""

# ── Leave entitlements ────────────────────────────────────────────────────────
# Keys MUST match the `name` column in the `leave_types` database table.
LEAVE_ENTITLEMENTS: dict[str, float] = {
    "Annual Leave":  15.0,
    "Medical Leave": 15.0,
    "Casual Leave":  10.0,
}

# Total days allocated across all leave types per calendar year.
TOTAL_LEAVE_DAYS_ALLOCATED: float = sum(LEAVE_ENTITLEMENTS.values())  # 40.0

# ── Leave status constants ────────────────────────────────────────────────────
# WHY: Raw string literals like "PENDING" are error-prone (typos produce silent
# bugs). Using named constants causes failures at import time instead.
STATUS_PENDING  = "PENDING"
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_REQ_INFO = "REQ_INFO"

VALID_STATUSES: frozenset[str] = frozenset(
    {STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUS_REQ_INFO}
)

# ── File upload constraints ───────────────────────────────────────────────────
ALLOWED_UPLOAD_MIME_TYPES: list[str] = [
    "image/jpeg",
    "image/png",
    "application/pdf",
]
UPLOAD_DIR_MEDICAL = "uploads/medical_docs"

# ── Report / company metadata ─────────────────────────────────────────────────
COMPANY_NAME = "Insharp Technologies (Pvt) Ltd"
REPORT_TITLE = "Employee Leave Summary Report"
