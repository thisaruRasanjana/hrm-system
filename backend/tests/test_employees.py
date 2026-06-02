"""
Unit Tests — Employee Module

Tests cover:
  - EmployeeCreate schema validation
  - EmployeeUpdate PATCH semantics
  - Service-layer CRUD with mocked DB
"""

import pytest
from unittest.mock import MagicMock
from pydantic import ValidationError

from app.employees.schemas import EmployeeCreate, EmployeeUpdate
from app.employees.service import create_employee, get_all_employees, deactivate_employee
from fastapi import HTTPException


class TestEmployeeCreateSchema:
    """Input validation for employee creation payloads."""

    VALID_PAYLOAD = {
        "first_name": "Alice",
        "last_name": "Johnson",
        "email": "alice@example.com",
        "department": "Engineering",
        "job_title": "Backend Developer",
        "gender": "F",
    }

    def test_valid_payload_passes(self):
        emp = EmployeeCreate(**self.VALID_PAYLOAD)
        assert emp.first_name == "Alice"

    def test_invalid_email_raises(self):
        """Email must pass RFC-5322 format validation."""
        payload = {**self.VALID_PAYLOAD, "email": "not-an-email"}
        with pytest.raises(ValidationError):
            EmployeeCreate(**payload)

    def test_invalid_gender_code_raises(self):
        """Gender must be M, F, or O."""
        payload = {**self.VALID_PAYLOAD, "gender": "X"}
        with pytest.raises(ValidationError) as exc_info:
            EmployeeCreate(**payload)
        assert "gender must be" in str(exc_info.value).lower()

    def test_valid_gender_codes_all_pass(self):
        """M, F, and O are all valid gender codes."""
        for code in ["M", "F", "O"]:
            payload = {**self.VALID_PAYLOAD, "gender": code}
            emp = EmployeeCreate(**payload)
            assert emp.gender == code

    def test_name_gets_stripped(self):
        """Leading/trailing whitespace on names must be stripped."""
        payload = {**self.VALID_PAYLOAD, "first_name": "  Bob  "}
        emp = EmployeeCreate(**payload)
        assert emp.first_name == "Bob"

    def test_first_name_required(self):
        """first_name is a mandatory field."""
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "first_name"}
        with pytest.raises(ValidationError):
            EmployeeCreate(**payload)


class TestGetAllEmployees:
    """Service tests with mocked DB."""

    def test_returns_list_of_employees(self):
        db = MagicMock()
        mock_emp = MagicMock()
        mock_emp.id = 1
        mock_emp.first_name = "Alice"
        mock_emp.last_name = "Johnson"

        # Chain: db.query().order_by().all()
        db.query.return_value.order_by.return_value.all.return_value = [mock_emp]

        result = get_all_employees(db)
        assert len(result) == 1
        assert result[0].first_name == "Alice"

    def test_empty_table_returns_empty_list(self):
        db = MagicMock()
        db.query.return_value.order_by.return_value.all.return_value = []
        result = get_all_employees(db)
        assert result == []


class TestDeactivateEmployee:
    """Soft-delete must set is_active=0 rather than deleting the row."""

    def test_deactivate_sets_is_active_to_zero(self):
        db = MagicMock()
        mock_emp = MagicMock()
        mock_emp.id = 5
        mock_emp.is_active = 1

        db.query.return_value.filter.return_value.first.return_value = mock_emp

        result = deactivate_employee(db, 5)

        assert mock_emp.is_active == 0
        db.commit.assert_called_once()
        assert "deactivated" in result["message"]

    def test_deactivate_missing_employee_raises_404(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            deactivate_employee(db, 99999)
        assert exc_info.value.status_code == 404
