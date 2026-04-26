"""
app/reports/router.py
---------------------
HTTP endpoints for leave report generation and export.

All heavy logic (data aggregation, PDF/CSV rendering) lives in service.py.
The router is responsible only for:
  - Validating query parameters.
  - Delegating to service functions.
  - Wrapping exceptions in appropriate HTTP responses.
  - Returning the correct Content-Type for file downloads.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user, require_roles
from app.database.database import get_db
from app.leave.service import get_leave_balance, LEAVE_ENTITLEMENTS
from app.reports.schemas import LeaveReportResponse
from app.reports.service import (
    get_leave_report,
    generate_leave_report_csv,
    generate_leave_report_pdf,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


def _validate_date_range(start_date: date | None, end_date: date | None) -> None:
    """Raise HTTP 400 if both dates are provided but end precedes start."""
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date must not be before start_date",
        )


# ---------------------------------------------------------------------------
# Employee leave balance (HR only)
# ---------------------------------------------------------------------------

@router.get("/employee-balance/{employee_id}")
def get_employee_balance(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["hr"])),
) -> list[dict]:
    """
    Return per-leave-type balance (allocated / used / remaining) for one employee.

    HR only — employees use GET /leave/balance/me instead.
    """
    remaining = get_leave_balance(db, employee_id)

    return [
        {
            "leave_type": leave_type,
            "allocated":  allocated,
            "used":       round(allocated - remaining.get(leave_type, allocated), 1),
            "remaining":  remaining.get(leave_type, allocated),
        }
        for leave_type, allocated in LEAVE_ENTITLEMENTS.items()
    ]


# ---------------------------------------------------------------------------
# Leave report — JSON preview
# ---------------------------------------------------------------------------

@router.get("/leave", response_model=LeaveReportResponse)
def preview_leave_report(
    employee_id:   int | None = None,
    leave_type_id: int | None = None,
    status:        str | None = None,
    start_date:    date | None = None,
    end_date:      date | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Return the leave report as structured JSON for in-browser preview.

    Any authenticated user may call this; the service filters records
    based on the caller's role.
    """
    _validate_date_range(start_date, end_date)

    try:
        return get_leave_report(
            db=db,
            current_user=current_user,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")


# ---------------------------------------------------------------------------
# Leave report — CSV export
# ---------------------------------------------------------------------------

@router.get("/leave/export/csv")
def export_leave_report_csv(
    employee_id:   int | None = None,
    leave_type_id: int | None = None,
    status:        str | None = None,
    start_date:    date | None = None,
    end_date:      date | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Response:
    """
    Generate and stream the leave report as a downloadable CSV file.

    The Content-Disposition header instructs the browser to save the file
    rather than display it inline.
    """
    _validate_date_range(start_date, end_date)

    try:
        report_data  = get_leave_report(
            db=db,
            current_user=current_user,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )
        csv_content = generate_leave_report_csv(report_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CSV export failed: {exc}")

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leave_report.csv"},
    )


# ---------------------------------------------------------------------------
# Leave report — PDF export
# ---------------------------------------------------------------------------

@router.get("/leave/pdf")
def download_leave_pdf(
    employee_id:   int | None = None,
    leave_type_id: int | None = None,
    status:        str | None = None,
    start_date:    date | None = None,
    end_date:      date | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Response:
    """
    Generate and stream the leave report as a downloadable PDF file.

    ReportLab renders the PDF into a BytesIO buffer; the raw bytes are
    returned via FastAPI's Response so the connection is not dropped
    mid-stream (which happened with StreamingResponse on some clients).
    """
    _validate_date_range(start_date, end_date)

    try:
        data       = get_leave_report(
            db=db,
            current_user=current_user,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )
        pdf_buffer = generate_leave_report_pdf(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF export failed: {exc}")

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=leave_report.pdf"},
    )