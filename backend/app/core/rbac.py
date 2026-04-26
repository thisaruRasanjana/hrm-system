"""
app/core/rbac.py
----------------
FastAPI dependency functions for authentication and role-based access control.

WHY header-based auth (not JWT):
  This system uses a lightweight gateway-style auth model where an upstream
  proxy/gateway sets x-user-id and x-user-roles headers after verifying the
  user's token. The backend trusts these headers and focuses on authorisation.

  For production, the gateway should be the ONLY entry point so raw requests
  cannot spoof these headers.
"""

from fastapi import Header, HTTPException, Depends


def get_current_user(
    x_user_id: str | None = Header(None, alias="x-user-id"),
    x_user_roles: str | None = Header(None, alias="x-user-roles"),
) -> dict:
    """
    Extract and validate the authenticated user from request headers.

    Returns a dict with keys 'id' (int) and 'role' (str, lowercase).

    Raises HTTP 401 for missing, empty, or sentinel ("undefined") values,
    and for non-integer user IDs.
    """
    # Reject missing or placeholder values injected by some frontend frameworks.
    if not x_user_id or not x_user_id.strip() or x_user_id == "undefined":
        raise HTTPException(status_code=401, detail="Missing or invalid User ID header")

    if not x_user_roles or not x_user_roles.strip() or x_user_roles == "undefined":
        raise HTTPException(status_code=401, detail="Missing or invalid User Roles header")

    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="User ID must be an integer")

    return {
        "id":   user_id,
        "role": x_user_roles.strip().lower(),
    }


def require_roles(allowed_roles: list[str]):
    """
    Return a FastAPI dependency that enforces role-based access.

    Usage:
        current_user: dict = Depends(require_roles(["hr", "admin"]))

    Raises HTTP 403 if the authenticated user's role is not in *allowed_roles*.
    Role comparison is case-insensitive.
    """
    normalised_roles = [r.lower() for r in allowed_roles]

    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in normalised_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}",
            )
        return current_user

    return checker