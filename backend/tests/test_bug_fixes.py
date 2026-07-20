"""
tests/test_bug_fixes.py
=======================
Regression tests for the QA bug-fix batch (HRM_BUG_FIXES.md).

These are deliberately lightweight — pure functions and MagicMock DB sessions —
so they run without a live database, matching the rest of the suite.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.security import hash_password
from app.auth.service import authenticate_user


def _mock_user(*, is_active=True, is_deleted=False, raw_password="secret123"):
    user = MagicMock()
    user.id = 1
    user.email = "qa@test.local"
    user.username = "qa"
    user.password_hash = hash_password(raw_password)
    user.is_active = is_active
    user.is_deleted = is_deleted
    user.refresh_token = None
    user.roles = []
    user.is_superadmin = False
    return user


def _db_returning(user):
    """MagicMock db whose query().options().filter().first() yields `user`."""
    db = MagicMock()
    db.query.return_value.options.return_value.filter.return_value.first.return_value = user
    return db


# ── BUG-01 — deactivated account cannot log in ────────────────────────────────

def test_deactivated_user_cannot_authenticate():
    """A user found with correct credentials but is_active=False must be rejected
    (returns None → caller raises the generic 401)."""
    user = _mock_user(is_active=False)
    db = _db_returning(user)

    result = authenticate_user(db, user.email, "secret123")

    assert result is None, "Deactivated account must not receive a session"


def test_active_user_still_authenticates():
    """The deactivation guard must not break normal login for active accounts."""
    user = _mock_user(is_active=True)
    db = _db_returning(user)

    result = authenticate_user(db, user.email, "secret123")

    assert result is not None
    assert "access_token" in result and result["token_type"] == "bearer"


# ── BUG-19 — document-request status transition guard ─────────────────────────

def test_request_status_transition_guard():
    from app.documents.services.hr_request_service import _ensure_valid_transition
    from app.documents.models.request_model import RequestStatus

    # Legal forward transitions + idempotent same-status.
    _ensure_valid_transition(RequestStatus.PENDING, RequestStatus.IN_PROGRESS)
    _ensure_valid_transition(RequestStatus.IN_PROGRESS, RequestStatus.COMPLETED)
    _ensure_valid_transition(RequestStatus.APPROVED, RequestStatus.COMPLETED)
    _ensure_valid_transition(RequestStatus.COMPLETED, RequestStatus.COMPLETED)

    # Illegal: reopening a terminal/advanced state back to PENDING.
    for current, new in [
        (RequestStatus.APPROVED, RequestStatus.PENDING),
        (RequestStatus.COMPLETED, RequestStatus.PENDING),
        (RequestStatus.REJECTED, RequestStatus.APPROVED),
    ]:
        with pytest.raises(HTTPException) as exc:
            _ensure_valid_transition(current, new)
        assert exc.value.status_code == 400


# ── BUG-03/07/21 — upload magic-byte validation ───────────────────────────────

def test_detect_content_type_allows_images_and_docs_rejects_scripts():
    from app.core.file_validation import detect_content_type, PDF, PNG, JPEG, DOCX, WEBP

    assert detect_content_type(b"%PDF-1.7") == PDF
    assert detect_content_type(b"\x89PNG\r\n\x1a\n") == PNG
    assert detect_content_type(b"\xff\xd8\xff\xe0") == JPEG
    assert detect_content_type(b"PK\x03\x04....") == DOCX
    assert detect_content_type(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == WEBP

    # Executables and script/markup payloads must not be detected as allowed.
    assert detect_content_type(b"MZ\x90\x00") is None
    assert detect_content_type(b"<html><script>alert(1)</script>") is None
    assert detect_content_type(b"<svg xmlns='http://www.w3.org/2000/svg'>") is None
    assert detect_content_type(b"#!/bin/sh\n") is None


def test_validate_upload_rejects_empty_and_wrong_type():
    from app.core.file_validation import validate_upload, IMAGE_TYPES

    # Empty file → 400 File is empty (BUG-21).
    empty = MagicMock()
    empty.file.read.return_value = b""
    with pytest.raises(HTTPException) as exc:
        validate_upload(empty, IMAGE_TYPES)
    assert exc.value.status_code == 400 and "empty" in exc.value.detail.lower()

    # An .exe masquerading as an image → 400 (BUG-07).
    exe = MagicMock()
    exe.file.read.return_value = b"MZ\x90\x00\x03evil"
    with pytest.raises(HTTPException) as exc:
        validate_upload(exe, IMAGE_TYPES)
    assert exc.value.status_code == 400

    # A genuine PNG passes and the extension is normalized from the detected type.
    png = MagicMock()
    png.file.read.return_value = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    content, mime, ext = validate_upload(png, IMAGE_TYPES)
    assert ext == ".png" and mime == "image/png"
