from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from app.database.database import get_db
from app.reports.schemas import LeaveReportResponse
from app.reports.service import get_leave_report, generate_leave_report_csv

from fastapi.responses import StreamingResponse
from app.reports.service import generate_leave_report_pdf

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/leave", response_model=LeaveReportResponse)
def preview_leave_report(
    employee_id: int | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    return get_leave_report(
        db=db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/leave/export/csv")
def export_leave_report_csv(
    employee_id: int | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    report_data = get_leave_report(
        db=db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
    )

    csv_content = generate_leave_report_csv(report_data)

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=leave_report.csv"
        },
    )

@router.get("/leave/pdf")
def download_leave_pdf(db: Session = Depends(get_db)):
    data = get_leave_report(db)

    pdf_buffer = generate_leave_report_pdf(data)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=leave_report.pdf"},
    )