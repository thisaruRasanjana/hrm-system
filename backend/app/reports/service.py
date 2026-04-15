from io import StringIO
import csv
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.leave.models import LeaveRequest, LeaveType


def build_leave_report_query(
    db: Session,
    employee_id: int | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    query = (
        db.query(LeaveRequest, LeaveType.name.label("leave_type_name"))
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
    )

    if employee_id is not None:
        query = query.filter(LeaveRequest.employee_id == employee_id)

    if leave_type_id is not None:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    if status:
        query = query.filter(LeaveRequest.status == status)

    if start_date is not None:
        query = query.filter(LeaveRequest.start_date >= start_date)

    if end_date is not None:
        query = query.filter(LeaveRequest.end_date <= end_date)

    return query.order_by(LeaveRequest.start_date.desc())


def get_leave_report(
    db: Session,
    employee_id: int | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    results = build_leave_report_query(
        db=db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
    ).all()

    records = []
    total_leave_days = 0.0
    approved_requests = 0
    pending_requests = 0
    rejected_requests = 0
    req_info_requests = 0

    for leave, leave_type_name in results:
        total_leave_days += float(leave.total_days or 0)

        if leave.status == "APPROVED":
            approved_requests += 1
        elif leave.status == "PENDING":
            pending_requests += 1
        elif leave.status == "REJECTED":
            rejected_requests += 1
        elif leave.status == "REQ_INFO":
            req_info_requests += 1

        records.append({
            "leave_request_id": leave.leave_request_id,
            "employee_id": leave.employee_id,
            "leave_type_id": leave.leave_type_id,
            "leave_type_name": leave_type_name,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "total_days": leave.total_days,
            "half_day": leave.half_day,
            "status": leave.status,
            "reason": leave.reason,
            "approved_by": leave.approved_by,
            "approved_date": leave.approved_date,
            "rejection_reason": leave.rejection_reason,
            "manager_comment": leave.manager_comment,
        })

    summary = {
        "total_requests": len(records),
        "total_leave_days": total_leave_days,
        "approved_requests": approved_requests,
        "pending_requests": pending_requests,
        "rejected_requests": rejected_requests,
        "req_info_requests": req_info_requests,
    }

    return {
        "summary": summary,
        "records": records,
    }


def generate_leave_report_csv(report_data: dict) -> str:
    output = StringIO()
    writer = csv.writer(output)

    summary = report_data["summary"]
    records = report_data["records"]

    writer.writerow(["LEAVE REPORT SUMMARY"])
    writer.writerow(["Total Requests", summary["total_requests"]])
    writer.writerow(["Total Leave Days", summary["total_leave_days"]])
    writer.writerow(["Approved Requests", summary["approved_requests"]])
    writer.writerow(["Pending Requests", summary["pending_requests"]])
    writer.writerow(["Rejected Requests", summary["rejected_requests"]])
    writer.writerow(["Request Info Requests", summary["req_info_requests"]])
    writer.writerow([])

    writer.writerow([
        "Request ID",
        "Employee ID",
        "Leave Type ID",
        "Leave Type Name",
        "Start Date",
        "End Date",
        "Total Days",
        "Half Day",
        "Status",
        "Reason",
        "Approved By",
        "Approved Date",
        "Rejection Reason",
        "Manager Comment",
    ])

    for row in records:
        writer.writerow([
            row["leave_request_id"],
            row["employee_id"],
            row["leave_type_id"],
            row["leave_type_name"],
            row["start_date"],
            row["end_date"],
            row["total_days"],
            row["half_day"],
            row["status"],
            row["reason"],
            row["approved_by"],
            row["approved_date"],
            row["rejection_reason"],
            row["manager_comment"],
        ])

    return output.getvalue()