"""
Unit tests for app/leave/service.py
Pure service-layer tests — no HTTP, uses in-memory SQLite via conftest fixtures.
"""
import pytest
from datetime import date, timedelta
from fastapi import HTTPException
from pydantic import ValidationError

from tests.conftest import make_employee, make_leave_type, make_leave_request
from app.leave.schemas import LeaveRequestCreate
from app.leave.service import (
    calculate_total_days,
    leave_type_exists,
    has_overlapping_leave,
    create_leave,
    approve_leave_request,
    reject_leave_request,
    request_info_leave_request,
    resubmit_leave_request,
    delete_leave_request,
    update_leave_request,
    get_leave_balance,
    create_leave_type,
    LEAVE_ENTITLEMENTS,
)


# =============================================================================
# calculate_total_days  (pure Python — no DB)
# =============================================================================
class TestCalculateTotalDays:
    def test_single_day_returns_one(self):
        d = date(2025, 6, 1)
        assert calculate_total_days(d, d, half_day=False) == 1.0

    def test_multi_day_count(self):
        assert calculate_total_days(date(2025, 1, 1), date(2025, 1, 5), False) == 5.0

    def test_half_day_same_date(self):
        d = date(2025, 6, 1)
        assert calculate_total_days(d, d, half_day=True) == 0.5

    def test_half_day_multi_date_raises(self):
        with pytest.raises(ValueError, match="single day"):
            calculate_total_days(date(2025, 1, 1), date(2025, 1, 2), half_day=True)

    def test_end_before_start_raises(self):
        with pytest.raises(ValueError, match="Invalid date range"):
            calculate_total_days(date(2025, 1, 5), date(2025, 1, 1), half_day=False)


# =============================================================================
# leave_type_exists
# =============================================================================
class TestLeaveTypeExists:
    def test_returns_true_for_existing(self, db):
        lt = make_leave_type(db, name="LTE Exists")
        assert leave_type_exists(db, lt.id) is True

    def test_returns_false_for_nonexistent(self, db):
        assert leave_type_exists(db, 999_999) is False


# =============================================================================
# has_overlapping_leave
# =============================================================================
class TestHasOverlappingLeave:
    def test_no_overlap_when_no_requests(self, db):
        emp = make_employee(db)
        future = date.today() + timedelta(days=90)
        assert has_overlapping_leave(db, emp.id, future, future) is False

    def test_detects_overlap_with_pending(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="HOL Pending")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="PENDING")
        assert has_overlapping_leave(db, emp.id, today, today) is True

    def test_detects_overlap_with_approved(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="HOL Approved")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="APPROVED")
        assert has_overlapping_leave(db, emp.id, today, today) is True

    def test_rejected_does_not_count_as_overlap(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="HOL Rejected")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="REJECTED")
        assert has_overlapping_leave(db, emp.id, today, today) is False

    def test_past_request_does_not_overlap_future(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="HOL Past")
        past = date(2020, 1, 1)
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=past, end_date=past, status="APPROVED")
        future = date.today() + timedelta(days=30)
        assert has_overlapping_leave(db, emp.id, future, future) is False


# =============================================================================
# create_leave
# =============================================================================
def _make_payload(leave_type_id, start=None, end=None, half_day=False, attachments=None):
    today = date.today()
    return LeaveRequestCreate(
        leave_type_id=leave_type_id,
        start_date=start or today,
        end_date=end or (start or today),
        half_day=half_day,
        reason="Need rest",
        attachment_urls=attachments or [],
    )


class TestCreateLeave:
    def test_happy_path_creates_pending_request(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="CL Happy")
        req = create_leave(db, emp.id, _make_payload(lt.id))
        assert req.leave_request_id is not None
        assert req.status == "PENDING"
        assert req.total_days == 1.0
        assert req.employee_id == emp.id

    def test_invalid_leave_type_raises(self, db):
        emp = make_employee(db)
        with pytest.raises(ValueError, match="Invalid leave_type_id"):
            create_leave(db, emp.id, _make_payload(999_999))

    def test_start_after_end_raises(self, db):
        """
        The Pydantic schema now validates end_date >= start_date via a
        model_validator, so the error is raised at schema construction
        (ValidationError) before the service layer is ever reached.
        This is the correct behaviour — fail as early as possible.
        """
        lt = make_leave_type(db, name="CL StartAfterEnd")
        with pytest.raises(ValidationError, match="end_date cannot be before start_date"):
            _make_payload(lt.id, start=date(2025, 5, 10), end=date(2025, 5, 1))

    def test_medical_leave_without_attachment_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="Medical Leave ML1")
        payload = _make_payload(lt.id, attachments=[])
        with pytest.raises(ValueError, match="Medical leave requires"):
            create_leave(db, emp.id, payload)

    def test_medical_leave_with_attachment_succeeds(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="Medical Leave ML2")
        payload = _make_payload(lt.id, attachments=["http://example.com/doc.pdf"])
        req = create_leave(db, emp.id, payload)
        assert req.status == "PENDING"

    def test_half_day_auto_switches_to_annual_leave(self, db):
        emp = make_employee(db)
        al = make_leave_type(db, name="Annual Leave")       # required for the switch
        other = make_leave_type(db, name="CL Half Day Switch")
        today = date.today()
        payload = LeaveRequestCreate(
            leave_type_id=other.id,
            start_date=today,
            end_date=today,
            half_day=True,
            reason="Half day",
        )
        req = create_leave(db, emp.id, payload)
        assert req.total_days == 0.5
        assert req.leave_type_id == al.id

    def test_overlapping_leave_raises_http_exception(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="CL Overlap")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="PENDING")
        with pytest.raises(HTTPException) as exc_info:
            create_leave(db, emp.id, _make_payload(lt.id, start=today, end=today))
        assert exc_info.value.status_code == 400


# =============================================================================
# approve_leave_request
# =============================================================================
class TestApproveLeaveRequest:
    def test_happy_path(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Approve")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        result = approve_leave_request(db, req.leave_request_id, approved_by=99)
        assert result.status == "APPROVED"
        assert result.approved_by == 99
        assert result.approved_date == date.today()
        assert result.rejection_reason is None

    def test_with_manager_comment(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Approve Comment")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        result = approve_leave_request(db, req.leave_request_id, approved_by=99,
                                       manager_comment="Looks good")
        assert result.manager_comment == "Looks good"

    def test_not_found_returns_none(self, db):
        assert approve_leave_request(db, 999_999, approved_by=1) is None

    def test_non_pending_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Approve NonPending")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="APPROVED")
        with pytest.raises(ValueError, match="Only pending"):
            approve_leave_request(db, req.leave_request_id, approved_by=99)


# =============================================================================
# reject_leave_request
# =============================================================================
class TestRejectLeaveRequest:
    def test_happy_path(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Reject")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        result = reject_leave_request(db, req.leave_request_id,
                                      approved_by=99, rejection_reason="Not enough cover")
        assert result.status == "REJECTED"
        assert result.rejection_reason == "Not enough cover"
        assert result.approved_date == date.today()

    def test_missing_reason_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Reject NoReason")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        with pytest.raises(ValueError, match="rejection_reason is required"):
            reject_leave_request(db, req.leave_request_id, approved_by=99,
                                 rejection_reason="   ")

    def test_empty_reason_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Reject EmptyReason")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        with pytest.raises(ValueError, match="rejection_reason is required"):
            reject_leave_request(db, req.leave_request_id, approved_by=99,
                                 rejection_reason="")

    def test_not_found_returns_none(self, db):
        assert reject_leave_request(db, 999_999, approved_by=1,
                                    rejection_reason="x") is None

    def test_non_pending_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Reject NonPending")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="REJECTED")
        with pytest.raises(ValueError, match="Only pending"):
            reject_leave_request(db, req.leave_request_id, approved_by=99,
                                 rejection_reason="double reject")


# =============================================================================
# request_info_leave_request
# =============================================================================
class TestRequestInfoLeaveRequest:
    def test_happy_path(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL ReqInfo")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        result = request_info_leave_request(db, req.leave_request_id,
                                            approved_by=99,
                                            manager_comment="Please attach docs")
        assert result.status == "REQ_INFO"
        assert result.manager_comment == "Please attach docs"

    def test_missing_comment_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL ReqInfo NoComment")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        with pytest.raises(ValueError, match="manager_comment is required"):
            request_info_leave_request(db, req.leave_request_id,
                                       approved_by=99, manager_comment="  ")

    def test_non_pending_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL ReqInfo NonPending")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="APPROVED")
        with pytest.raises(ValueError, match="Only pending"):
            request_info_leave_request(db, req.leave_request_id,
                                       approved_by=99, manager_comment="hi")

    def test_not_found_returns_none(self, db):
        assert request_info_leave_request(db, 999_999, approved_by=1,
                                          manager_comment="hi") is None


# =============================================================================
# resubmit_leave_request
# =============================================================================
class TestResubmitLeaveRequest:
    def test_happy_path_changes_status_to_pending(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Resubmit Happy")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="REQ_INFO")
        result = resubmit_leave_request(db, req.leave_request_id, emp.id,
                                        attachment_urls=["http://new.pdf"],
                                        reason="Updated reason")
        assert result.status == "PENDING"
        assert result.manager_comment is None
        assert "http://new.pdf" in result.attachment_urls

    def test_wrong_status_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Resubmit WrongStatus")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="PENDING")
        with pytest.raises(ValueError, match="Only requests needing info"):
            resubmit_leave_request(db, req.leave_request_id, emp.id,
                                   attachment_urls=None, reason=None)

    def test_wrong_employee_raises(self, db):
        emp = make_employee(db)
        other = make_employee(db, first_name="Other")
        lt = make_leave_type(db, name="AL Resubmit WrongEmp")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="REQ_INFO")
        with pytest.raises(ValueError, match="not found or not authorized"):
            resubmit_leave_request(db, req.leave_request_id, other.id,
                                   attachment_urls=None, reason=None)


# =============================================================================
# delete_leave_request
# =============================================================================
class TestDeleteLeaveRequest:
    def test_happy_path(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Delete Happy")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        assert delete_leave_request(db, req.leave_request_id, emp.id) is True

    def test_non_pending_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Delete NonPending")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="APPROVED")
        with pytest.raises(ValueError, match="Only PENDING"):
            delete_leave_request(db, req.leave_request_id, emp.id)

    def test_wrong_employee_raises(self, db):
        emp = make_employee(db)
        other = make_employee(db, first_name="Other2")
        lt = make_leave_type(db, name="AL Delete WrongEmp")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        with pytest.raises(ValueError, match="not found or not authorized"):
            delete_leave_request(db, req.leave_request_id, other.id)

    def test_not_found_raises(self, db):
        with pytest.raises(ValueError, match="not found or not authorized"):
            delete_leave_request(db, 999_999, employee_id=1)


# =============================================================================
# update_leave_request
# =============================================================================
class TestUpdateLeaveRequest:
    def test_happy_path(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Update Happy")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        new_start = date.today() + timedelta(days=10)
        new_end = new_start + timedelta(days=2)
        payload = LeaveRequestCreate(
            leave_type_id=lt.id,
            start_date=new_start,
            end_date=new_end,
            half_day=False,
            reason="Updated",
        )
        updated = update_leave_request(db, req.leave_request_id, emp.id, payload)
        assert updated.start_date == new_start
        assert updated.total_days == 3.0

    def test_invalid_leave_type_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Update InvalidType")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id)
        today = date.today()
        payload = LeaveRequestCreate(
            leave_type_id=999_999,
            start_date=today,
            end_date=today,
            half_day=False,
            reason="x",
        )
        with pytest.raises(ValueError, match="Invalid leave type"):
            update_leave_request(db, req.leave_request_id, emp.id, payload)

    def test_non_pending_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Update NonPending")
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 status="APPROVED")
        today = date.today()
        payload = LeaveRequestCreate(
            leave_type_id=lt.id,
            start_date=today,
            end_date=today,
            half_day=False,
            reason="x",
        )
        with pytest.raises(ValueError, match="Only PENDING"):
            update_leave_request(db, req.leave_request_id, emp.id, payload)

    def test_overlap_with_other_request_raises(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="AL Update Overlap")
        # Existing approved request on day X
        day_x = date.today() + timedelta(days=20)
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=day_x, end_date=day_x, status="APPROVED")
        # Pending request we will try to update into the same day
        req2 = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                  start_date=day_x + timedelta(days=5),
                                  end_date=day_x + timedelta(days=5))
        payload = LeaveRequestCreate(
            leave_type_id=lt.id,
            start_date=day_x,
            end_date=day_x,
            half_day=False,
            reason="x",
        )
        with pytest.raises(ValueError, match="overlapping"):
            update_leave_request(db, req2.leave_request_id, emp.id, payload)


# =============================================================================
# get_leave_balance
# =============================================================================
class TestGetLeaveBalance:
    def test_full_balance_when_no_leaves(self, db):
        emp = make_employee(db)
        balance = get_leave_balance(db, emp.id)
        # All entitlements should be fully remaining
        for leave_type, total in LEAVE_ENTITLEMENTS.items():
            assert balance[leave_type] == total

    def test_balance_reduced_after_approved_leave(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="Annual Leave")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today,
                           status="APPROVED", total_days=3.0)
        balance = get_leave_balance(db, emp.id)
        assert balance["Annual Leave"] == LEAVE_ENTITLEMENTS["Annual Leave"] - 3.0

    def test_balance_not_below_zero(self, db):
        emp = make_employee(db)
        lt = make_leave_type(db, name="Casual Leave")
        today = date.today()
        # Use more days than the entitlement
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today,
                           status="APPROVED", total_days=999.0)
        balance = get_leave_balance(db, emp.id)
        assert balance["Casual Leave"] == 0.0


# =============================================================================
# create_leave_type
# =============================================================================
class TestCreateLeaveType:
    def test_happy_path(self, db):
        lt = create_leave_type(db, name="Paternity Leave CLT", description="For new fathers")
        assert lt.id is not None
        assert lt.name == "Paternity Leave CLT"

    def test_duplicate_name_raises(self, db):
        create_leave_type(db, name="Unique Leave CLT Dup")
        with pytest.raises(ValueError, match="Leave type already exists"):
            create_leave_type(db, name="Unique Leave CLT Dup")
