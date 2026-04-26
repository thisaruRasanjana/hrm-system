from io import StringIO, BytesIO
import csv
from datetime import date, datetime
from collections import defaultdict
from sqlalchemy.orm import Session, aliased
from sqlalchemy import or_, cast, String, func
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    HRFlowable, KeepTogether
)
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas

from app.leave.models import LeaveRequest, LeaveType
from app.employees.models import Employee
from app.leave.service import get_leave_balance


def build_leave_report_query(
    db: Session,
    employee_id: int | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    Approver = aliased(Employee)
    query = (
        db.query(
            LeaveRequest, 
            LeaveType.name.label("leave_type_name"),
            Employee.employee_id.label("employee_code"),
            Employee.first_name,
            Employee.last_name,
            Employee.department,
            Employee.designation,
            Employee.joined_date,
            Employee.status.label("employee_status"),
            func.concat(Approver.first_name, " ", Approver.last_name).label("approved_by_name"),
            )
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .outerjoin(Employee, LeaveRequest.employee_id == Employee.id)
        .outerjoin(Approver, LeaveRequest.approved_by == Approver.id)
    )

    if employee_id is not None:
        query = query.filter(LeaveRequest.employee_id == employee_id)

    if leave_type_id is not None:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    if status:
        query = query.filter(LeaveRequest.status == status)

    if start_date is not None and end_date is not None:
        query = query.filter(
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,)

    elif start_date is not None:
        query = query.filter(LeaveRequest.end_date >= start_date)
    elif end_date is not None:
        query = query.filter(LeaveRequest.start_date <= end_date)    


    return query.order_by(LeaveRequest.start_date.desc())


def get_leave_report(
    db: Session,
    current_user: dict,
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

    # Analytics helpers
    leaves_per_month = defaultdict(float)
    employee_counts = defaultdict(int)
    
    # Cache for balances to avoid redundant DB calls
    balance_cache = {}

    for (leave, 
         leave_type_name,
            employee_code,
            first_name,
            last_name,
            department,
            designation,
            joined_date,
            employee_status,
            approved_by_name,
    ) in results:
        total_leave_days += float(leave.total_days or 0)

        if leave.status == "APPROVED":
            approved_requests += 1
            month_key = leave.start_date.strftime("%Y-%m")
            leaves_per_month[month_key] += float(leave.total_days or 0)
        
        elif leave.status == "PENDING":
            pending_requests += 1
        elif leave.status == "REJECTED":
            rejected_requests += 1
        elif leave.status == "REQ_INFO":
            req_info_requests += 1

        emp_name = f"{first_name} {last_name}".strip() or "Unknown"
        employee_counts[emp_name] += 1

        if leave.employee_id not in balance_cache:
            balance_cache[leave.employee_id] = get_leave_balance(db, leave.employee_id)
        
        current_balance = balance_cache[leave.employee_id].get(leave_type_name, 0.0)

        records.append({
            "leave_request_id": leave.leave_request_id,
            "employee_id": leave.employee_id,
            "employee_code": employee_code,
            "employee_name": emp_name,
            "department": department,
            "designation": designation,
            "joined_date": joined_date,
            "employee_status": employee_status.value if employee_status else None,
            "leave_type_id": leave.leave_type_id,
            "leave_type_name": leave_type_name,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "total_days": leave.total_days,
            "half_day": leave.half_day,
            "status": leave.status,
            "reason": leave.reason,
            "approved_by": leave.approved_by,
            "approved_by_name": approved_by_name,
            "approved_date": leave.approved_date,
            "rejection_reason": leave.rejection_reason,
            "manager_comment": leave.manager_comment,
            "balance": current_balance
        })

    summary = {
        "total_requests": len(records),
        "total_leave_days": total_leave_days,
        "approved_requests": approved_requests,
        "pending_requests": pending_requests,
        "rejected_requests": rejected_requests,
        "req_info_requests": req_info_requests,
    }

    metadata = {
        "title": "Employee Leave Summary Report",
        "company": "Insharp Technologies (Pvt) Ltd",
        "generated_at": datetime.now(),
        "generated_by": f"User ID: {current_user['id']} ({current_user['role'].upper()})",
        "period_start": start_date,
        "period_end": end_date,
        # include employee_id so the PDF can render per-type balance cards
        "employee_id": employee_id,
    }

    analytics = {
        "leaves_per_month": dict(sorted(leaves_per_month.items())),
        "employee_frequency": [
            {"employee_name": name, "request_count": count}
            for name, count in sorted(employee_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]
    }

    return {
        "metadata": metadata,
        "summary": summary,
        "analytics": analytics,
        "records": records,
    }


def generate_leave_report_csv(report_data: dict) -> str:
    output = StringIO()
    writer = csv.writer(output)

    metadata = report_data["metadata"]
    summary = report_data["summary"]
    records = report_data["records"]

    # ── Header ──
    writer.writerow([metadata["title"]])
    writer.writerow(["Company", metadata["company"]])
    writer.writerow(["Generated At", metadata["generated_at"].strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow(["Generated By", metadata["generated_by"]])
    writer.writerow(["Period", f"{metadata['period_start'] or 'All'} to {metadata['period_end'] or 'All'}"])
    writer.writerow([])

    # ── Summary ──
    writer.writerow(["SUMMARY"])
    writer.writerow(["Total Requests", summary["total_requests"]])
    writer.writerow(["Approved Requests", summary["approved_requests"]])
    writer.writerow(["Pending Requests", summary["pending_requests"]])
    writer.writerow(["Rejected Requests", summary["rejected_requests"]])
    writer.writerow([])

    # ── Per-employee summary ──
    # Group records by employee
    from collections import defaultdict
    from app.leave.service import LEAVE_ENTITLEMENTS, TOTAL_ALLOCATED

    emp_map: dict = {}
    for r in records:
        eid = r["employee_id"]
        if eid not in emp_map:
            emp_map[eid] = {
                "employee_code": r.get("employee_code") or f"EMP-{str(eid).zfill(3)}",
                "employee_name": r.get("employee_name") or f"Employee {eid}",
                "department": r.get("department") or "N/A",
                "designation": r.get("designation") or "Staff",
                "allocated": TOTAL_ALLOCATED,
                "used": 0.0,
                "pending": 0.0,
            }
        emp = emp_map[eid]
        days = float(r.get("total_days") or 0)
        if r["status"] == "APPROVED":
            emp["used"] += days
        elif r["status"] == "PENDING":
            emp["pending"] += days

    writer.writerow([
        "Employee ID",
        "Employee Name",
        "Department",
        "Designation",
        "Allocated (Year)",
        "Used (YTD)",
        "Pending",
        "Remaining",
    ])

    for emp in emp_map.values():
        remaining = max(0.0, emp["allocated"] - emp["used"])
        writer.writerow([
            emp["employee_code"],
            emp["employee_name"],
            emp["department"],
            emp["designation"],
            emp["allocated"],
            emp["used"],
            emp["pending"],
            remaining,
        ])

    writer.writerow([])
    writer.writerow(["DETAILED RECORDS"])
    writer.writerow([
        "Request ID",
        "Employee Code",
        "Employee Name",
        "Department",
        "Leave Type",
        "Start Date",
        "End Date",
        "Days",
        "Status",
        "Approver",
    ])
    for row in records:
        writer.writerow([
            row["leave_request_id"],
            row.get("employee_code"),
            row.get("employee_name"),
            row.get("department"),
            row["leave_type_name"],
            row["start_date"],
            row["end_date"],
            row["total_days"],
            row["status"],
            row.get("approved_by_name"),
        ])

    return output.getvalue()


# ─── Colour palette ───────────────────────────────────────────────────────────
_NAVY      = colors.HexColor("#1E2A3A")
_ORANGE    = colors.HexColor("#F2924E")
_ORANGE_LT = colors.HexColor("#FEF0E7")
_GREEN     = colors.HexColor("#22C55E")
_GREEN_LT  = colors.HexColor("#DCFCE7")
_RED       = colors.HexColor("#EF4444")
_RED_LT    = colors.HexColor("#FEE2E2")
_AMBER     = colors.HexColor("#F59E0B")
_AMBER_LT  = colors.HexColor("#FEF3C7")
_BLUE      = colors.HexColor("#3B82F6")
_BLUE_LT   = colors.HexColor("#DBEAFE")
_GREY_LT   = colors.HexColor("#F8F9FA")
_GREY_MID  = colors.HexColor("#E5E7EB")
_GREY_TXT  = colors.HexColor("#6B7280")
_DARK_TXT  = colors.HexColor("#111827")


STATUS_COLORS = {
    "APPROVED":  (_GREEN_LT, _GREEN),
    "PENDING":   (_AMBER_LT, _AMBER),
    "REJECTED":  (_RED_LT,   _RED),
    "REQ_INFO":  (_BLUE_LT,  _BLUE),
}


# ─── Custom flowable: solid coloured rectangle block ─────────────────────────
class ColorBar(Flowable):
    def __init__(self, width, height, fill_color):
        super().__init__()
        self.width  = width
        self.height = height
        self.fill_color = fill_color

    def draw(self):
        self.canv.setFillColor(self.fill_color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)


# ─── Custom flowable: mini horizontal bar for trend chart ────────────────────
class BarChartRow(Flowable):
    def __init__(self, label, value, max_value, bar_color, full_width=420):
        super().__init__()
        self.label      = label
        self.value      = value
        self.max_value  = max_value or 1
        self.bar_color  = bar_color
        self.full_width = full_width
        self.height     = 22

    def draw(self):
        c = self.canv
        bar_w = (self.value / self.max_value) * (self.full_width - 140)
        # label
        c.setFont("Helvetica", 8)
        c.setFillColor(_DARK_TXT)
        c.drawString(0, 6, self.label)
        # bg track
        c.setFillColor(_GREY_MID)
        c.roundRect(100, 4, self.full_width - 140, 14, 4, fill=1, stroke=0)
        # filled bar
        if bar_w > 0:
            c.setFillColor(self.bar_color)
            c.roundRect(100, 4, bar_w, 14, 4, fill=1, stroke=0)
        # value label
        c.setFillColor(_DARK_TXT)
        c.drawRightString(self.full_width, 6, f"{self.value:.1f} days")


# ─── Page template (header band + footer) ────────────────────────────────────
def _make_page_decorator(metadata):
    company   = metadata["company"]
    gen_at    = metadata["generated_at"]
    period_s  = str(metadata["period_start"] or "—")
    period_e  = str(metadata["period_end"]   or "—")
    gen_by    = metadata["generated_by"]

    if isinstance(gen_at, datetime):
        gen_at_str = gen_at.strftime("%d %B %Y, %H:%M")
    else:
        gen_at_str = str(gen_at)

    def decorator(canv, doc):
        w, h = letter

        # ── TOP HEADER BAND ─────────────────────────────────────────────
        canv.saveState()
        canv.setFillColor(_NAVY)
        canv.rect(0, h - 80, w, 80, fill=1, stroke=0)

        # Orange accent stripe on left edge
        canv.setFillColor(_ORANGE)
        canv.rect(0, h - 80, 6, 80, fill=1, stroke=0)

        # Company name (large, white)
        canv.setFillColor(colors.white)
        canv.setFont("Helvetica-Bold", 16)
        canv.drawString(22, h - 32, company)

        # Report title (small, orange)
        canv.setFillColor(_ORANGE)
        canv.setFont("Helvetica-Bold", 9)
        canv.drawString(22, h - 50, "EMPLOYEE LEAVE SUMMARY REPORT")

        # Right side meta
        canv.setFillColor(colors.HexColor("#CBD5E1"))
        canv.setFont("Helvetica", 7.5)
        right_x = w - 36
        canv.drawRightString(right_x, h - 24, f"Generated: {gen_at_str}")
        canv.drawRightString(right_x, h - 36, f"By: {gen_by}")
        canv.drawRightString(right_x, h - 48, f"Period: {period_s}  →  {period_e}")
        canv.restoreState()

        # ── FOOTER ──────────────────────────────────────────────────────
        canv.saveState()
        canv.setFillColor(_GREY_MID)
        canv.rect(0, 0, w, 28, fill=1, stroke=0)
        canv.setFillColor(_GREY_TXT)
        canv.setFont("Helvetica", 7.5)
        canv.drawString(36, 10, f"© {datetime.now().year} {company} — Confidential")
        canv.drawRightString(w - 36, 10, f"Page {doc.page}")
        canv.restoreState()

    return decorator


def generate_leave_report_pdf(data):
    buffer   = BytesIO()
    metadata = data["metadata"]
    summary  = data["summary"]
    records  = data["records"]

    PAGE_W, PAGE_H = letter
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40, rightMargin=40,
        topMargin=100, bottomMargin=50,
    )

    # ── Styles ────────────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()

    section_title = ParagraphStyle(
        "SectionTitle",
        fontName="Helvetica-Bold", fontSize=11,
        textColor=_NAVY, spaceBefore=20, spaceAfter=12,
    )
    card_label = ParagraphStyle(
        "CardLabel",
        fontName="Helvetica", fontSize=7.5,
        textColor=_GREY_TXT, leading=10, spaceAfter=2,
    )
    card_value = ParagraphStyle(
        "CardValue",
        fontName="Helvetica-Bold", fontSize=22,
        textColor=_DARK_TXT, leading=26, spaceAfter=2,
    )
    card_sub = ParagraphStyle(
        "CardSub",
        fontName="Helvetica", fontSize=7,
        textColor=_GREY_TXT, leading=9,
    )
    tbl_header = ParagraphStyle(
        "TH", fontName="Helvetica-Bold", fontSize=7.5,
        textColor=colors.white,
    )
    tbl_cell = ParagraphStyle(
        "TC", fontName="Helvetica", fontSize=7.5,
        textColor=_DARK_TXT, leading=11,
    )
    tbl_cell_bold = ParagraphStyle(
        "TCB", fontName="Helvetica-Bold", fontSize=7.5,
        textColor=_DARK_TXT, leading=11,
    )
    tbl_cell_right = ParagraphStyle(
        "TCR", fontName="Helvetica-Bold", fontSize=7.5,
        textColor=_DARK_TXT, leading=10, alignment=TA_RIGHT,
    )

    elements = []

    # ── Helper: section heading with orange accent bar ────────────────────────
    def section_heading(title):
        row = Table(
            [[
                Table([[""]], colWidths=[4], rowHeights=[14],
                      style=TableStyle([("BACKGROUND", (0,0), (-1,-1), _ORANGE),
                                        ("TOPPADDING",  (0,0),(-1,-1),0),
                                        ("BOTTOMPADDING",(0,0),(-1,-1),0)])),
                Paragraph(title, section_title),
            ]],
            colWidths=[12, PAGE_W - 80 - 12],
        )
        row.setStyle(TableStyle([
            ("VALIGN",      (0,0),(-1,-1),"MIDDLE"),
            ("TOPPADDING",  (0,0),(-1,-1),0),
            ("BOTTOMPADDING",(0,0),(-1,-1),0),
            ("LEFTPADDING", (0,0),(-1,-1),0),
            ("RIGHTPADDING",(0,0),(-1,-1),0),
        ]))
        return row

    # ── Helper: status badge ──────────────────────────────────────────────────
    def make_badge(status):
        bg, fg = STATUS_COLORS.get(status, (_GREY_LT, _GREY_TXT))
        style = ParagraphStyle(
            f"badge_{status}",
            fontName="Helvetica-Bold", fontSize=7,
            textColor=fg, backColor=bg,
            alignment=TA_CENTER, borderPad=2,
        )
        labels = {
            "APPROVED": "✓ Approved",
            "PENDING":  "⏳ Pending",
            "REJECTED": "✗ Rejected",
            "REQ_INFO": "ℹ Info Req.",
        }
        return Paragraph(labels.get(status, status), style)

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 0.5 — EMPLOYEE PROFILE (single-employee reports only)
    # ══════════════════════════════════════════════════════════════════════════
    single_emp_id = metadata.get("employee_id")
    if single_emp_id:
        try:
            from app.database.database import SessionLocal as _SL
            from app.employees.models import Employee as _Emp
            _db = _SL()
            emp = _db.query(_Emp).filter(_Emp.id == int(single_emp_id)).first()
            _db.close()

            if emp:
                elements.append(section_heading("Employee Details"))
                
                profile_lbl = ParagraphStyle("profLbl", fontName="Helvetica-Bold", fontSize=7.5, textColor=_GREY_TXT, leading=10)
                profile_val = ParagraphStyle("profVal", fontName="Helvetica", fontSize=9, textColor=_DARK_TXT, leading=12)

                def _fmt_date(d):
                    if d:
                        try:
                            return datetime.strptime(str(d), "%Y-%m-%d").strftime("%d %b %Y")
                        except Exception:
                            return str(d)
                    return "—"

                emp_info = [
                    [Paragraph("Name:", profile_lbl), Paragraph(f"{emp.first_name} {emp.last_name}", profile_val),
                     Paragraph("Department:", profile_lbl), Paragraph(emp.department or "—", profile_val)],
                    [Paragraph("Employee ID:", profile_lbl), Paragraph(emp.employee_id or "—", profile_val),
                     Paragraph("Designation:", profile_lbl), Paragraph(emp.designation or "—", profile_val)],
                    [Paragraph("Email:", profile_lbl), Paragraph(emp.email or "—", profile_val),
                     Paragraph("Joined Date:", profile_lbl), Paragraph(_fmt_date(emp.joined_date), profile_val)],
                ]

                emp_table = Table(emp_info, colWidths=[80, 180, 80, 180])
                emp_table.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                
                profile_container = Table(
                    [[emp_table]],
                    colWidths=[PAGE_W - 80],
                )
                profile_container.setStyle(TableStyle([
                    ("BACKGROUND", (0,0),(-1,-1), _GREY_LT),
                    ("TOPPADDING", (0,0),(-1,-1), 10),
                    ("BOTTOMPADDING", (0,0),(-1,-1), 10),
                    ("LEFTPADDING", (0,0),(-1,-1), 12),
                    ("RIGHTPADDING", (0,0),(-1,-1), 12),
                    ("LINEAFTER", (0,0),(-1,-1), 3, colors.white),
                ]))
                
                elements.append(profile_container)
                elements.append(Spacer(1, 24))
        except Exception as e:
            print(f"Error fetching employee profile for PDF: {e}")
            pass

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — SUMMARY STAT CARDS  (4 cards in one balanced row)
    # ══════════════════════════════════════════════════════════════════════════

    elements.append(section_heading("Report Summary"))

    CARD_W = (PAGE_W - 80 - 9) / 4   # 4 cards, 3 × 3-pt gaps
    cards = [
        ("Total Requests", str(summary["total_requests"]),    "All leave requests",  _ORANGE, _ORANGE_LT),
        ("Approved",       str(summary["approved_requests"]), "Fully approved",      _GREEN,  _GREEN_LT),
        ("Pending",        str(summary["pending_requests"]),  "Awaiting decision",   _AMBER,  _AMBER_LT),
        ("Rejected",       str(summary["rejected_requests"]), "Not approved",        _RED,    _RED_LT),
    ]

    card_cells = []
    for lbl, val, sub, accent, bg in cards:
        inner = Table(
            [[ColorBar(CARD_W - 16, 4, accent)],
             [Spacer(1, 4)],
             [Paragraph(lbl, card_label)],
             [Paragraph(val, card_value)],
             [Paragraph(sub, card_sub)],
             [Spacer(1, 4)]],
            colWidths=[CARD_W - 16],
        )
        inner.setStyle(TableStyle([
            ("TOPPADDING",    (0,0),(-1,-1), 0),
            ("BOTTOMPADDING", (0,0),(-1,-1), 0),
            ("LEFTPADDING",   (0,0),(-1,-1), 0),
            ("RIGHTPADDING",  (0,0),(-1,-1), 0),
        ]))
        card_cells.append(inner)

    cards_row = Table([card_cells], colWidths=[CARD_W]*4)
    cards_row.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), _GREY_LT),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ("RIGHTPADDING",  (0,0),(-1,-1), 8),
        ("LINEAFTER",     (0,0),(2,-1),  3, colors.white),
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
    ]))
    elements.append(cards_row)

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1.5 — LEAVE BALANCE BY TYPE  (single-employee reports only)
    # ══════════════════════════════════════════════════════════════════════════
    from app.leave.service import LEAVE_ENTITLEMENTS, get_leave_balance as _get_balance
    from app.database.database import SessionLocal as _SL

    single_emp_id = metadata.get("employee_id")
    if single_emp_id:
        try:
            _db = _SL()
            remaining_map = _get_balance(_db, int(single_emp_id))
            _db.close()

            elements.append(Spacer(1, 24))
            elements.append(section_heading("Leave Balance by Type"))

            _TYPE_COLORS = {
                "Annual Leave":  (_ORANGE,   _ORANGE_LT),
                "Medical Leave": (colors.HexColor("#3B82F6"), colors.HexColor("#EFF6FF")),
                "Casual Leave":  (colors.HexColor("#16A34A"), colors.HexColor("#F0FDF4")),
            }

            bal_label = ParagraphStyle("balLbl", fontName="Helvetica-Bold", fontSize=7,
                                       textColor=_GREY_TXT, leading=9)
            bal_value = ParagraphStyle("balVal", fontName="Helvetica-Bold", fontSize=20,
                                       textColor=_DARK_TXT, leading=24)
            bal_sub   = ParagraphStyle("balSub", fontName="Helvetica", fontSize=7,
                                       textColor=_GREY_TXT, leading=9)

            BAL_CARD_W = (PAGE_W - 80) / 3
            bal_cells = []
            for lt, alloc in LEAVE_ENTITLEMENTS.items():
                rem  = remaining_map.get(lt, alloc)
                used = round(alloc - rem, 1)
                acc, bg = _TYPE_COLORS.get(lt, (_NAVY, _GREY_LT))
                inner = Table(
                    [[ColorBar(BAL_CARD_W - 16, 4, acc)],
                     [Spacer(1, 4)],
                     [Paragraph(lt, bal_label)],
                     [Paragraph(str(int(rem)), bal_value)],
                     [Paragraph(f"Remaining of {int(alloc)} allocated  •  {used} used", bal_sub)],
                     [Spacer(1, 4)]],
                    colWidths=[BAL_CARD_W - 16],
                )
                inner.setStyle(TableStyle([
                    ("TOPPADDING",    (0,0),(-1,-1), 0),
                    ("BOTTOMPADDING", (0,0),(-1,-1), 0),
                    ("LEFTPADDING",   (0,0),(-1,-1), 0),
                    ("RIGHTPADDING",  (0,0),(-1,-1), 0),
                ]))
                bal_cells.append(inner)

            bal_row = Table([bal_cells], colWidths=[BAL_CARD_W]*3)
            bal_row.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,-1), _GREY_LT),
                ("TOPPADDING",    (0,0),(-1,-1), 8),
                ("BOTTOMPADDING", (0,0),(-1,-1), 8),
                ("LEFTPADDING",   (0,0),(-1,-1), 8),
                ("RIGHTPADDING",  (0,0),(-1,-1), 8),
                ("LINEAFTER",     (0,0),(1,-1),  3, colors.white),
                ("VALIGN",        (0,0),(-1,-1), "TOP"),
            ]))
            elements.append(bal_row)
        except Exception:
            pass  # silently skip if balance cannot be fetched

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — EMPLOYEE LEAVE SUMMARY TABLE
    # ══════════════════════════════════════════════════════════════════════════
    from app.leave.service import TOTAL_ALLOCATED

    elements.append(Spacer(1, 24))
    elements.append(section_heading("Employee Leave Summary"))

    # Build per-employee aggregates from records
    emp_summary: dict = {}
    for r in records:
        eid = r["employee_id"]
        if eid not in emp_summary:
            emp_summary[eid] = {
                "code":      r.get("employee_code") or f"EMP-{str(eid).zfill(3)}",
                "name":      r.get("employee_name") or f"Employee {eid}",
                "dept":      r.get("department") or "N/A",
                "allocated": TOTAL_ALLOCATED,
                "used":      0.0,
                "pending":   0.0,
            }
        days = float(r.get("total_days") or 0)
        if r["status"] == "APPROVED":
            emp_summary[eid]["used"] += days
        elif r["status"] == "PENDING":
            emp_summary[eid]["pending"] += days

    sum_header = [
        Paragraph("Emp. ID",     tbl_header),
        Paragraph("Name",        tbl_header),
        Paragraph("Department",  tbl_header),
        Paragraph("Allocated",   tbl_header),
        Paragraph("Used (YTD)",  tbl_header),
        Paragraph("Pending",     tbl_header),
        Paragraph("Remaining",   tbl_header),
    ]
    sum_rows = [sum_header]
    for emp in emp_summary.values():
        remaining = max(0.0, emp["allocated"] - emp["used"])
        sum_rows.append([
            Paragraph(emp["code"],              tbl_cell),
            Paragraph(emp["name"],              tbl_cell_bold),
            Paragraph(emp["dept"],              tbl_cell),
            Paragraph(f"{emp['allocated']:.0f} d", tbl_cell_right),
            Paragraph(f"{emp['used']:.1f} d",      tbl_cell_right),
            Paragraph(f"{emp['pending']:.1f} d",   tbl_cell_right),
            Paragraph(f"{remaining:.1f} d",         tbl_cell_right),
        ])

    SUM_COL_W = [65, 120, 95, 55, 65, 55, 65]
    sum_table = Table(sum_rows, colWidths=SUM_COL_W, repeatRows=1)
    sum_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  _NAVY),
        ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
        ("TOPPADDING",    (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("GRID",          (0,0), (-1,-1), 0.25, _GREY_MID),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, _GREY_LT]),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        # highlight remaining column header with orange
        ("BACKGROUND",    (6,0), (6,0),  _ORANGE),
    ]))
    elements.append(sum_table)

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — DETAILED LEAVE RECORDS TABLE
    # ══════════════════════════════════════════════════════════════════════════
    elements.append(Spacer(1, 24))
    elements.append(section_heading("Detailed Leave Records"))

    def fmt_date(d):
        try:
            return datetime.strptime(str(d), "%Y-%m-%d").strftime("%d %b %Y")
        except Exception:
            return str(d)

    detail_header = [
        Paragraph("Employee",   tbl_header),
        Paragraph("Department", tbl_header),
        Paragraph("Leave Type", tbl_header),
        Paragraph("Start Date", tbl_header),
        Paragraph("End Date",   tbl_header),
        Paragraph("Days",       tbl_header),
        Paragraph("Status",     tbl_header),
        Paragraph("Approver",   tbl_header),
    ]

    detail_rows = [detail_header]
    for r in records:
        detail_rows.append([
            Paragraph(r.get("employee_name") or "—",    tbl_cell_bold),
            Paragraph(r.get("department") or "—",        tbl_cell),
            Paragraph(r.get("leave_type_name") or "—",  tbl_cell),
            Paragraph(fmt_date(r["start_date"]),         tbl_cell),
            Paragraph(fmt_date(r["end_date"]),           tbl_cell),
            Paragraph(f"{float(r['total_days']):.1f}",  tbl_cell_right),
            make_badge(r["status"]),
            Paragraph(r.get("approved_by_name") or "—", tbl_cell),
        ])

    DET_COL_W = [105, 65, 75, 62, 62, 35, 58, 70]
    rec_table = Table(detail_rows, colWidths=DET_COL_W, repeatRows=1)
    rec_styles = [
        ("BACKGROUND",   (0, 0), (-1, 0),  _NAVY),
        ("TEXTCOLOR",    (0, 0), (-1, 0),  colors.white),
        ("TOPPADDING",   (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("GRID",         (0, 0), (-1, -1), 0.3, _GREY_MID),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _GREY_LT]),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
    ]
    rec_table.setStyle(TableStyle(rec_styles))
    elements.append(rec_table)

    # ── Build with page decoration ─────────────────────────────────────────────
    decorator = _make_page_decorator(metadata)
    doc.build(elements, onFirstPage=decorator, onLaterPages=decorator)
    buffer.seek(0)
    return buffer