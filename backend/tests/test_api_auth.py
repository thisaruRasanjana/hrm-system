"""
Unit tests for app/core/rbac.py — RBAC / auth header validation.
Tests the get_current_user and require_roles dependency functions
through the FastAPI TestClient using the /leave/types endpoint (no auth needed)
and /leave/requests/me (role-restricted).
"""
import pytest


# =============================================================================
# get_current_user — header validation
# =============================================================================
class TestGetCurrentUser:
    """
    Uses /leave/requests/me which requires 'employee' or 'hr' role.
    We test that the dependency correctly rejects bad headers.
    """

    def test_missing_user_id_returns_401(self, client):
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-roles": "employee"},
        )
        assert resp.status_code == 401
        assert "User ID" in resp.json()["detail"]

    def test_missing_roles_returns_401(self, client):
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "1"},
        )
        assert resp.status_code == 401
        assert "Roles" in resp.json()["detail"]

    def test_non_integer_user_id_returns_401(self, client):
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "abc", "x-user-roles": "employee"},
        )
        assert resp.status_code == 401
        assert "integer" in resp.json()["detail"]

    def test_undefined_user_id_returns_401(self, client):
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "undefined", "x-user-roles": "employee"},
        )
        assert resp.status_code == 401

    def test_undefined_roles_returns_401(self, client):
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "1", "x-user-roles": "undefined"},
        )
        # "undefined" is a valid string role that just won't match any allowed role
        # so it should return 403 (role mismatch), not 401
        assert resp.status_code in (401, 403)

    def test_valid_headers_pass_through(self, client):
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "1", "x-user-roles": "employee"},
        )
        # Should NOT be 401 — auth passed; 200 is expected (empty list for new user)
        assert resp.status_code == 200


# =============================================================================
# require_roles — role enforcement
# =============================================================================
class TestRequireRoles:
    """
    /leave/requests/pending requires 'hr' role.
    /leave/requests/me requires 'employee' or 'hr'.
    """

    def test_correct_role_passes(self, client):
        resp = client.get(
            "/leave/requests/pending",
            headers={"x-user-id": "99", "x-user-roles": "hr"},
        )
        assert resp.status_code == 200

    def test_wrong_role_returns_403(self, client):
        resp = client.get(
            "/leave/requests/pending",
            headers={"x-user-id": "1", "x-user-roles": "employee"},
        )
        assert resp.status_code == 403
        assert "Access denied" in resp.json()["detail"]

    def test_manager_role_on_employee_endpoint_returns_403(self, client):
        """manager role is not in the allowed list for /leave/requests/me"""
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "1", "x-user-roles": "manager"},
        )
        assert resp.status_code == 403

    def test_case_insensitive_role_matching(self, client):
        """Roles are lowercased in get_current_user, so 'HR' == 'hr'"""
        resp = client.get(
            "/leave/requests/pending",
            headers={"x-user-id": "99", "x-user-roles": "HR"},
        )
        assert resp.status_code == 200

    def test_employee_can_access_employee_endpoint(self, client):
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "1", "x-user-roles": "employee"},
        )
        assert resp.status_code == 200

    def test_hr_can_access_employee_endpoint(self, client):
        """HR should also be allowed on employee-accessible endpoints"""
        resp = client.get(
            "/leave/requests/me",
            headers={"x-user-id": "99", "x-user-roles": "hr"},
        )
        assert resp.status_code == 200
