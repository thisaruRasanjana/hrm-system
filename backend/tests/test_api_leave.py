"""
API integration tests for app/leave/router.py
Uses FastAPI TestClient with in-memory SQLite DB injected via conftest.
Auth is tested by sending x-user-id / x-user-roles headers directly.
"""
import pytest
from datetime import date, timedelta

from tests.conftest import make_employee, make_leave_type, make_leave_request


# =============================================================================
# POST /leave/requests  — Submit a new leave
# =============================================================================
class TestSubmitLeave:
    def test_employee_can_create_leave(self, client, db):
        emp = make_employee(db, first_name="Alice")
        lt = make_leave_type(db, name="API Annual Leave")
        today = date.today().isoformat()
        resp = client.post(
            "/leave/requests",
            json={"leave_type_id": lt.id, "start_date": today,
                  "end_date": today, "half_day": False, "reason": "Rest"},
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "PENDING"
        assert data["employee_id"] == emp.id

    def test_overlapping_leave_returns_400(self, client, db):
        emp = make_employee(db, first_name="Bob")
        lt = make_leave_type(db, name="API AL Overlap")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="PENDING")
        resp = client.post(
            "/leave/requests",
            json={"leave_type_id": lt.id, "start_date": today.isoformat(),
                  "end_date": today.isoformat(), "half_day": False},
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 400

    def test_unauthenticated_returns_401(self, client, db):
        lt = make_leave_type(db, name="API AL No Auth")
        today = date.today().isoformat()
        resp = client.post(
            "/leave/requests",
            json={"leave_type_id": lt.id, "start_date": today,
                  "end_date": today, "half_day": False},
        )
        assert resp.status_code == 401

    def test_wrong_role_returns_403(self, client, db):
        lt = make_leave_type(db, name="API AL Wrong Role")
        today = date.today().isoformat()
        resp = client.post(
            "/leave/requests",
            json={"leave_type_id": lt.id, "start_date": today,
                  "end_date": today, "half_day": False},
            headers={"x-user-id": "1", "x-user-roles": "manager"},
        )
        assert resp.status_code == 403


# =============================================================================
# GET /leave/requests/me  — My requests
# =============================================================================
class TestGetMyLeave:
    def test_returns_own_requests(self, client, db):
        emp = make_employee(db, first_name="Carol")
        lt = make_leave_type(db, name="API My Req")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today)
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_returns_empty_list_for_new_employee(self, client, db):
        emp = make_employee(db, first_name="Dave")
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/leave/requests/me")
        assert resp.status_code == 401


# =============================================================================
# GET /leave/requests/pending  — Pending requests (HR only)
# =============================================================================
class TestGetPendingRequests:
    def test_hr_can_access(self, client, db):
        hr = make_employee(db, first_name="HR1", roles=["hr"])
        emp = make_employee(db, first_name="Pending1")
        lt = make_leave_type(db, name="API Pending HR")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="PENDING")
        resp = client.get(
            "/leave/requests/pending",
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_employee_cannot_access_pending(self, client, db):
        resp = client.get(
            "/leave/requests/pending",
            headers={"x-user-id": "1", "x-user-roles": "employee"},
        )
        assert resp.status_code == 403


# =============================================================================
# GET /leave/requests/{id}  — Get single request
# =============================================================================
class TestGetLeaveRequestById:
    def test_employee_can_see_own_request(self, client, db):
        emp = make_employee(db, first_name="Eve")
        lt = make_leave_type(db, name="API Single Own")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.get(
            f"/leave/requests/{req.leave_request_id}",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        assert resp.json()["leave_request_id"] == req.leave_request_id

    def test_employee_cannot_see_others_request(self, client, db):
        emp1 = make_employee(db, first_name="Frank")
        emp2 = make_employee(db, first_name="Grace")
        lt = make_leave_type(db, name="API Single Others")
        today = date.today()
        req = make_leave_request(db, employee_id=emp1.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.get(
            f"/leave/requests/{req.leave_request_id}",
            headers={"x-user-id": str(emp2.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 403

    def test_not_found_returns_404(self, client):
        resp = client.get(
            "/leave/requests/999999",
            headers={"x-user-id": "1", "x-user-roles": "hr"},
        )
        assert resp.status_code == 404

    def test_hr_can_see_any_request(self, client, db):
        emp = make_employee(db, first_name="Henry")
        hr = make_employee(db, first_name="HR2", roles=["hr"])
        lt = make_leave_type(db, name="API Single HR View")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.get(
            f"/leave/requests/{req.leave_request_id}",
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 200


# =============================================================================
# PATCH /leave/requests/{id}/approve
# =============================================================================
class TestApproveRequest:
    def test_hr_can_approve(self, client, db):
        emp = make_employee(db, first_name="Irene")
        hr = make_employee(db, first_name="HR3", roles=["hr"])
        lt = make_leave_type(db, name="API Approve")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/approve",
            json={"manager_comment": "Approved!"},
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "APPROVED"

    def test_hr_cannot_approve_own_request(self, client, db):
        hr = make_employee(db, first_name="HR4", roles=["hr"])
        lt = make_leave_type(db, name="API Approve Self")
        today = date.today()
        req = make_leave_request(db, employee_id=hr.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/approve",
            json={},
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 403

    def test_not_found_returns_404(self, client):
        resp = client.patch(
            "/leave/requests/999999/approve",
            json={},
            headers={"x-user-id": "99", "x-user-roles": "hr"},
        )
        assert resp.status_code == 404

    def test_employee_cannot_approve(self, client, db):
        emp = make_employee(db, first_name="Jack")
        lt = make_leave_type(db, name="API Approve EmpRole")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/approve",
            json={},
            headers={"x-user-id": "99", "x-user-roles": "employee"},
        )
        assert resp.status_code == 403


# =============================================================================
# PATCH /leave/requests/{id}/reject
# =============================================================================
class TestRejectRequest:
    def test_hr_can_reject_with_reason(self, client, db):
        emp = make_employee(db, first_name="Kate")
        hr = make_employee(db, first_name="HR5", roles=["hr"])
        lt = make_leave_type(db, name="API Reject")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/reject",
            json={"rejection_reason": "Not approved due to project deadline"},
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "REJECTED"
        assert resp.json()["rejection_reason"] == "Not approved due to project deadline"

    def test_hr_cannot_reject_own_request(self, client, db):
        hr = make_employee(db, first_name="HR6", roles=["hr"])
        lt = make_leave_type(db, name="API Reject Self")
        today = date.today()
        req = make_leave_request(db, employee_id=hr.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/reject",
            json={"rejection_reason": "self"},
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 403

    def test_reject_not_found_returns_404(self, client):
        resp = client.patch(
            "/leave/requests/999999/reject",
            json={"rejection_reason": "test"},
            headers={"x-user-id": "99", "x-user-roles": "hr"},
        )
        assert resp.status_code == 404


# =============================================================================
# PATCH /leave/requests/{id}/request-info
# =============================================================================
class TestRequestInfo:
    def test_hr_can_request_info(self, client, db):
        emp = make_employee(db, first_name="Leo")
        hr = make_employee(db, first_name="HR7", roles=["hr"])
        lt = make_leave_type(db, name="API ReqInfo")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/request-info",
            json={"manager_comment": "Please provide medical certificate"},
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "REQ_INFO"

    def test_hr_cannot_request_info_own(self, client, db):
        hr = make_employee(db, first_name="HR8", roles=["hr"])
        lt = make_leave_type(db, name="API ReqInfo Self")
        today = date.today()
        req = make_leave_request(db, employee_id=hr.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/request-info",
            json={"manager_comment": "hi"},
            headers={"x-user-id": str(hr.id), "x-user-roles": "hr"},
        )
        assert resp.status_code == 403


# =============================================================================
# PATCH /leave/requests/{id}/resubmit
# =============================================================================
class TestResubmitRequest:
    def test_employee_can_resubmit_req_info(self, client, db):
        emp = make_employee(db, first_name="Mia")
        lt = make_leave_type(db, name="API Resubmit")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today, status="REQ_INFO")
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/resubmit",
            json={"attachment_urls": ["http://doc.pdf"], "reason": "Added docs"},
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "PENDING"

    def test_resubmit_wrong_status_returns_400(self, client, db):
        emp = make_employee(db, first_name="Nick")
        lt = make_leave_type(db, name="API Resubmit WrongStatus")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today, status="PENDING")
        resp = client.patch(
            f"/leave/requests/{req.leave_request_id}/resubmit",
            json={"attachment_urls": [], "reason": "test"},
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 400


# =============================================================================
# DELETE /leave/requests/{id}
# =============================================================================
class TestDeleteLeave:
    def test_employee_can_delete_own_pending(self, client, db):
        emp = make_employee(db, first_name="Olivia")
        lt = make_leave_type(db, name="API Delete")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today)
        resp = client.delete(
            f"/leave/requests/{req.leave_request_id}",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        assert resp.json()["detail"] == "Leave request deleted"

    def test_cannot_delete_approved_request(self, client, db):
        emp = make_employee(db, first_name="Paul")
        lt = make_leave_type(db, name="API Delete Approved")
        today = date.today()
        req = make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                                 start_date=today, end_date=today, status="APPROVED")
        resp = client.delete(
            f"/leave/requests/{req.leave_request_id}",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 400


# =============================================================================
# GET /leave/types  — List leave types (public endpoint)
# =============================================================================
class TestLeaveTypes:
    def test_returns_list(self, client, db):
        make_leave_type(db, name="API Type List")
        resp = client.get("/leave/types")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_response_has_required_fields(self, client, db):
        make_leave_type(db, name="API Type Fields")
        resp = client.get("/leave/types")
        assert resp.status_code == 200
        first = resp.json()[0]
        assert "id" in first
        assert "name" in first


# =============================================================================
# GET /leave/balance/me
# =============================================================================
class TestLeaveBalance:
    def test_returns_balance_dict(self, client, db):
        emp = make_employee(db, first_name="Quinn")
        resp = client.get(
            "/leave/balance/me",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "Annual Leave" in data
        assert "Medical Leave" in data
        assert "Casual Leave" in data

    def test_employee_without_leaves_has_full_balance(self, client, db):
        emp = make_employee(db, first_name="Rachel")
        resp = client.get(
            "/leave/balance/me",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["Annual Leave"] == 15.0
        assert data["Medical Leave"] == 15.0
        assert data["Casual Leave"] == 10.0


# =============================================================================
# GET /leave/history/me
# =============================================================================
class TestLeaveHistory:
    def test_returns_list(self, client, db):
        emp = make_employee(db, first_name="Sam")
        lt = make_leave_type(db, name="API History")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="APPROVED")
        resp = client.get(
            "/leave/history/me",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_filter_by_status(self, client, db):
        emp = make_employee(db, first_name="Tina")
        lt = make_leave_type(db, name="API History Filter")
        today = date.today()
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today, end_date=today, status="APPROVED")
        make_leave_request(db, employee_id=emp.id, leave_type_id=lt.id,
                           start_date=today + timedelta(days=5),
                           end_date=today + timedelta(days=5), status="REJECTED")
        resp = client.get(
            "/leave/history/me?status=APPROVED",
            headers={"x-user-id": str(emp.id), "x-user-roles": "employee"},
        )
        assert resp.status_code == 200
        results = resp.json()
        assert all(r["status"] == "APPROVED" for r in results)


# =============================================================================
# GET /leave/summary  — HR only
# =============================================================================
class TestLeaveSummary:
    def test_hr_can_access_summary(self, client, db):
        today = date.today()
        resp = client.get(
            f"/leave/summary?start_date={today.isoformat()}&end_date={today.isoformat()}",
            headers={"x-user-id": "99", "x-user-roles": "hr"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_employee_cannot_access_summary(self, client):
        today = date.today()
        resp = client.get(
            f"/leave/summary?start_date={today.isoformat()}&end_date={today.isoformat()}",
            headers={"x-user-id": "1", "x-user-roles": "employee"},
        )
        assert resp.status_code == 403
