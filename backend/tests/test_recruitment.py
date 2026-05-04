"""
Unit Tests — Recruitment Module

Tests cover:
  - Input validation (schemas)         — Section C: input validation
  - Service-layer business logic       — Section C: unit tests
  - CV parser utility functions        — Section C: unit tests
  - Scoring formula                    — Section C: unit tests

Run with:
    cd backend
    pytest tests/ -v

Dependencies: pytest, unittest.mock (stdlib)
No database or HTTP server is required — all DB calls are mocked.
"""

import pytest
from datetime import date
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

# ── Schema / validation tests ──────────────────────────────────────────────────

from app.recruitment.schemas import (
    VacancyCreate,
    EvaluationCreate,
    FinalDecisionCreate,
    CandidateUpdate,
    SCORE_MAX,
    SCORE_MIN,
    VALID_EXPERIENCE_LEVELS,
    VALID_DECISIONS,
)


class TestVacancyCreateSchema:
    """Validate that VacancyCreate rejects bad inputs with clear messages."""

    VALID_PAYLOAD = {
        "title": "Software Engineer",
        "department": "Engineering",
        "experience_level": "Mid",
        "description": "We are looking for a skilled engineer with Python experience.",
        "requirements": "3+ years Python. REST API design. PostgreSQL experience required.",
        "status": "Draft",
    }

    def test_valid_payload_passes(self):
        """A fully valid payload should deserialise without error."""
        vacancy = VacancyCreate(**self.VALID_PAYLOAD)
        assert vacancy.title == "Software Engineer"

    def test_title_too_short_raises(self):
        """Title shorter than 3 characters must be rejected."""
        payload = {**self.VALID_PAYLOAD, "title": "AB"}
        with pytest.raises(ValidationError) as exc_info:
            VacancyCreate(**payload)
        assert "title" in str(exc_info.value).lower() or "min_length" in str(exc_info.value).lower()

    def test_invalid_experience_level_raises(self):
        """An experience level not in the controlled vocabulary must fail."""
        payload = {**self.VALID_PAYLOAD, "experience_level": "Expert"}
        with pytest.raises(ValidationError) as exc_info:
            VacancyCreate(**payload)
        assert "Expert" in str(exc_info.value) or "Invalid" in str(exc_info.value)

    def test_all_valid_experience_levels_pass(self):
        """Every value in VALID_EXPERIENCE_LEVELS must be accepted."""
        for level in VALID_EXPERIENCE_LEVELS:
            payload = {**self.VALID_PAYLOAD, "experience_level": level}
            vacancy = VacancyCreate(**payload)
            assert vacancy.experience_level == level

    def test_invalid_status_raises(self):
        """A status outside the controlled vocabulary must fail."""
        payload = {**self.VALID_PAYLOAD, "status": "Archived"}
        with pytest.raises(ValidationError):
            VacancyCreate(**payload)

    def test_description_too_short_raises(self):
        """A description with fewer than 20 visible characters must fail."""
        payload = {**self.VALID_PAYLOAD, "description": "<p>Short</p>"}
        with pytest.raises(ValidationError):
            VacancyCreate(**payload)

    def test_title_gets_stripped(self):
        """Leading/trailing whitespace on title must be stripped."""
        payload = {**self.VALID_PAYLOAD, "title": "  Backend Engineer  "}
        vacancy = VacancyCreate(**payload)
        assert vacancy.title == "Backend Engineer"


class TestEvaluationCreateSchema:
    """Validate score range enforcement on EvaluationCreate."""

    VALID_EVAL = {
        "round_number": 1,
        "technical_skills": 4,
        "problem_solving": 3,
        "communication": 5,
        "cultural_fit": 4,
        "attitude": 5,
    }

    def test_valid_scores_pass(self):
        """All scores within 0–5 must be accepted."""
        ev = EvaluationCreate(**self.VALID_EVAL)
        assert ev.technical_skills == 4

    def test_score_above_max_raises(self):
        """A score above SCORE_MAX must be rejected."""
        payload = {**self.VALID_EVAL, "technical_skills": SCORE_MAX + 1}
        with pytest.raises(ValidationError):
            EvaluationCreate(**payload)

    def test_score_below_min_raises(self):
        """A negative score must be rejected."""
        payload = {**self.VALID_EVAL, "attitude": SCORE_MIN - 1}
        with pytest.raises(ValidationError):
            EvaluationCreate(**payload)

    def test_round_number_below_one_raises(self):
        """round_number must be >= 1."""
        payload = {**self.VALID_EVAL, "round_number": 0}
        with pytest.raises(ValidationError):
            EvaluationCreate(**payload)


class TestFinalDecisionSchema:
    """Validate decision vocabulary enforcement."""

    def test_valid_decisions_pass(self):
        """Every entry in VALID_DECISIONS must deserialise correctly."""
        for decision in VALID_DECISIONS:
            fd = FinalDecisionCreate(decision=decision)
            assert fd.decision == decision

    def test_invalid_decision_raises(self):
        """A decision string not in the vocabulary must fail with a clear message."""
        with pytest.raises(ValidationError) as exc_info:
            FinalDecisionCreate(decision="Maybe Later")
        assert "Invalid decision" in str(exc_info.value)


class TestCandidateUpdateSchema:
    """Validate email format enforcement on candidate updates."""

    def test_valid_email_passes(self):
        update = CandidateUpdate(email="candidate@example.com")
        assert update.email == "candidate@example.com"

    def test_invalid_email_raises(self):
        with pytest.raises(ValidationError):
            CandidateUpdate(email="not-an-email")

    def test_empty_email_raises(self):
        with pytest.raises(ValidationError):
            CandidateUpdate(email="")


# ── Service-layer unit tests ───────────────────────────────────────────────────

from app.recruitment.service import (
    EVALUATION_MAX_TOTAL,
    STATUS_CALLED,
    STATUS_FIRST_ROUND,
    STATUS_SECOND_ROUND,
    STATUS_UPLOADED,
    _has_valid_email,
    create_vacancy,
    get_all_vacancies,
    get_vacancy_by_id,
    update_application_notes,
)
from app.recruitment import schemas as rec_schemas


class TestHasValidEmail:
    """Unit tests for the _has_valid_email private helper."""

    def test_real_email_returns_true(self):
        assert _has_valid_email("user@example.com") is True

    def test_none_returns_false(self):
        assert _has_valid_email(None) is False

    def test_empty_string_returns_false(self):
        assert _has_valid_email("") is False

    def test_processing_placeholder_returns_false(self):
        """'Processing...' is an intermediate placeholder — must be treated as missing."""
        assert _has_valid_email("Processing...") is False

    def test_placeholder_email_returns_false(self):
        assert _has_valid_email("placeholder@email.com") is False

    def test_string_without_at_returns_false(self):
        assert _has_valid_email("notanemail") is False


class TestEvaluationScoreFormula:
    """
    Verify that the normalisation formula produces correct results.
    Formula: (sum_of_5_scores / EVALUATION_MAX_TOTAL) * 100
    """

    def test_perfect_score_gives_100(self):
        """5 + 5 + 5 + 5 + 5 = 25; 25/25 * 100 = 100.0"""
        raw_total = 5 * 5
        score = (raw_total / EVALUATION_MAX_TOTAL) * 100.0
        assert score == 100.0

    def test_zero_score_gives_0(self):
        """All zeros should yield 0.0."""
        score = (0 / EVALUATION_MAX_TOTAL) * 100.0
        assert score == 0.0

    def test_midpoint_score(self):
        """3 + 3 + 3 + 3 + 3 = 15; 15/25 * 100 = 60.0"""
        raw_total = 3 * 5
        score = (raw_total / EVALUATION_MAX_TOTAL) * 100.0
        assert score == pytest.approx(60.0)

    def test_mixed_score(self):
        """1 + 2 + 3 + 4 + 5 = 15; 15/25 * 100 = 60.0"""
        raw_total = 1 + 2 + 3 + 4 + 5
        score = (raw_total / EVALUATION_MAX_TOTAL) * 100.0
        assert score == pytest.approx(60.0)


class TestGetAllVacancies:
    """Service layer tests using a mocked DB session."""

    def _make_mock_vacancy(self, vid=1, title="Engineer", department="IT", status="Active"):
        """Helper: create a minimal mock Vacancy ORM object."""
        v = MagicMock()
        v.id = vid
        v.title = title
        v.department = department
        v.status = status
        v.__dict__ = {"id": vid, "title": title, "department": department, "status": status}
        return v

    def test_returns_vacancies_with_applicant_count(self):
        """get_all_vacancies must attach an 'applicants' count to each result."""
        db = MagicMock()
        mock_vacancy = self._make_mock_vacancy()

        # Mock db.query(...).all() to return one vacancy.
        db.query.return_value.all.return_value = [mock_vacancy]
        # Mock the applicant count sub-query to return 3.
        db.query.return_value.filter.return_value.scalar.return_value = 3

        result = get_all_vacancies(db)

        assert len(result) == 1
        assert result[0]["applicants"] == 3

    def test_empty_db_returns_empty_list(self):
        """An empty vacancies table must return an empty list, not an error."""
        db = MagicMock()
        db.query.return_value.all.return_value = []

        result = get_all_vacancies(db)
        assert result == []


class TestUpdateApplicationNotes:
    """Test that saving notes correctly advances status to STATUS_CALLED."""

    def test_notes_saved_and_status_set_to_called(self):
        """Saving notes must set application.status = STATUS_CALLED automatically."""
        db = MagicMock()

        mock_app = MagicMock()
        mock_app.id = 1
        mock_app.status = STATUS_UPLOADED
        mock_app.notes = None

        db.query.return_value.filter.return_value.first.return_value = mock_app

        data = rec_schemas.ApplicationUpdate(notes="Called — very promising candidate.")
        result = update_application_notes(db, 1, data)

        assert result.status == STATUS_CALLED
        assert result.notes == "Called — very promising candidate."
        db.commit.assert_called_once()

    def test_missing_application_returns_none(self):
        """A missing application_id must return None (router converts to 404)."""
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        result = update_application_notes(
            db, 99999, rec_schemas.ApplicationUpdate(notes="Test")
        )
        assert result is None


# ── CV Parser unit tests ───────────────────────────────────────────────────────

from app.recruitment.cv_parser import _extract_email, _extract_phone, _extract_name


class TestCvParserExtractEmail:
    def test_extracts_valid_email(self):
        text = "Name: John Doe\nEmail: john.doe@example.com\nPhone: 0771234567"
        assert _extract_email(text) == "john.doe@example.com"

    def test_returns_none_when_no_email(self):
        """Must return None, never a placeholder string."""
        text = "John Doe\n123 Main Street\nNo email here"
        assert _extract_email(text) is None


class TestCvParserExtractPhone:
    def test_extracts_phone_number(self):
        text = "Contact: +94 77 123 4567"
        phone = _extract_phone(text)
        assert phone is not None
        # Verify it contains enough digits.
        digits = "".join(c for c in phone if c.isdigit())
        assert len(digits) >= 7

    def test_returns_none_when_no_phone(self):
        """Must return None, never '0000000000'."""
        text = "Name: Jane Smith\nEmail: jane@example.com"
        assert _extract_phone(text) is None


class TestCvParserExtractName:
    def test_extracts_name_from_first_valid_line(self):
        text = "John Smith\njohn@example.com\nSoftware Engineer"
        name = _extract_name(text, fallback_filename="cv_file")
        assert name == "John Smith"

    def test_falls_back_to_filename(self):
        text = "https://linkedin.com/in/johndoe\njohn@test.com"
        name = _extract_name(text, fallback_filename="John_Doe_CV")
        assert name == "John_Doe_CV"
