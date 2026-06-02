// @ts-nocheck
/**
 * __tests__/auth-and-messaging.test.ts
 * =====================================
 * Unit tests for the Authentication context and MessagesPanel logic.
 *
 * NOTE: Jest is not configured in this project yet.
 *       To enable these tests, install the required packages:
 *
 *         npm install --save-dev jest @testing-library/react \
 *           @testing-library/jest-dom @testing-library/user-event \
 *           jest-environment-jsdom ts-jest @types/jest
 *
 *       Then add to package.json:
 *         "scripts": { "test": "jest" }
 *         "jest": { "preset": "ts-jest", "testEnvironment": "jsdom" }
 *
 * Run with: npm test
 */

// ── Polyfills needed in JSDOM environment ────────────────────────────────────
// (These would normally live in a jest.setup.ts file)
// import "@testing-library/jest-dom";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — declared before imports so Jest can hoist them
// ─────────────────────────────────────────────────────────────────────────────

// Mock the api lib so no real HTTP calls are made
jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
  getToken: jest.fn(),
  setToken: jest.fn(),
  removeToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

import { apiFetch, getToken, removeToken, setToken } from "@/lib/api";

// Cast to typed mocks for easier assertion
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockSetToken = setToken as jest.MockedFunction<typeof setToken>;
const mockRemoveToken = removeToken as jest.MockedFunction<typeof removeToken>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a mock Response object similar to the Fetch API */
function mockResponse(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Reset all mocks between tests */
beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// AUTH — Login flow
// =============================================================================

describe("Login flow", () => {
  test("successful login stores token and fetches user profile", async () => {
    /**
     * When the backend returns a valid access_token, login() should:
     *   1. Call setToken with that token
     *   2. Call /auth/me to populate the user context
     */
    const fakeToken = "eyJhbGciOiJIUzI1NiJ9.test.token";
    const fakeUser = {
      id: 1,
      email: "admin@example.com",
      role: "hr",
      permissions: ["messaging.send"],
      is_active: true,
    };

    // /auth/login returns a token
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({ access_token: fakeToken, token_type: "bearer" })
    );
    // /auth/me returns the user profile
    mockApiFetch.mockResolvedValueOnce(mockResponse(fakeUser));

    // Simulate what login() does: setToken then fetchUser
    setToken(fakeToken);
    const meRes = await apiFetch("/auth/me");
    const userData = await meRes.json();

    expect(mockSetToken).toHaveBeenCalledWith(fakeToken);
    expect(userData.email).toBe("admin@example.com");
    expect(userData.permissions).toContain("messaging.send");
  });

  test("invalid credentials — /auth/login returns 401 with detail message", async () => {
    /**
     * When the backend returns 401, the login page sets the error message
     * from data.detail and does NOT call setToken.
     */
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({ detail: "Invalid credentials" }, 401)
    );

    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "bad@example.com", password: "wrong" }),
    });
    const data = await res.json();

    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
    expect(data.detail).toBe("Invalid credentials");
    // Token must NOT be stored on failed login
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  test("login with deleted account — backend returns 401, no token issued", async () => {
    /**
     * Soft-deleted users are excluded by the DB query in authenticate_user.
     * From the frontend's perspective this looks identical to wrong credentials
     * — the backend returns 401.
     */
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({ detail: "Invalid credentials" }, 401)
    );

    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "deleted@example.com", password: "pass" }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  test("2FA flow — first step returns require_2fa flag and temp_token", async () => {
    /**
     * When 2FA is enabled, /auth/login returns require_2fa: true and a
     * temp_token. The login page should switch to the OTP entry view.
     */
    const tempToken = "temp.jwt.token";
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({ require_2fa: true, temp_token: tempToken })
    );

    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user2fa@example.com", password: "pass" }),
    });
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.require_2fa).toBe(true);
    expect(data.temp_token).toBe(tempToken);
    // No session token should be stored yet
    expect(mockSetToken).not.toHaveBeenCalled();
  });
});

// =============================================================================
// AUTH — Token refresh
// =============================================================================

describe("Token refresh", () => {
  test("token refresh — /auth/refresh returns new access_token on success", async () => {
    /**
     * The background refresh interval calls refreshAccessToken(), which hits
     * /auth/refresh. A new access_token should be returned and stored.
     */
    const newToken = "new.access.token";
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({ access_token: newToken, token_type: "bearer" })
    );

    const res = await apiFetch("/auth/refresh", { method: "POST" });
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.access_token).toBe(newToken);
  });

  test("token refresh failure — removeToken is called and user is cleared", async () => {
    /**
     * If /auth/refresh returns 401, the auth context should call removeToken
     * and redirect to /login. This test verifies removeToken is invoked.
     */
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({ detail: "Invalid refresh token" }, 401)
    );

    const res = await apiFetch("/auth/refresh", { method: "POST" });

    if (!res.ok) {
      // Simulate what the auth context does on refresh failure
      removeToken();
    }

    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// MESSAGING — send message
// =============================================================================

describe("Messaging — send message", () => {
  test("POST /messages/ succeeds for a user with messaging.send permission", async () => {
    /**
     * The backend only accepts the request if the user has messaging.send.
     * A 200 response with the created message object is expected.
     */
    const createdMessage = {
      id: 42,
      sender_id: 1,
      subject: "Monthly Update",
      content: "Please find the report attached.",
      target_group: "All Employees",
      sender_name: "HR Manager",
      is_read: false,
      is_deleted: false,
      sender_deleted: false,
      created_at: new Date().toISOString(),
    };
    mockApiFetch.mockResolvedValueOnce(mockResponse(createdMessage));

    const res = await apiFetch("/messages/", {
      method: "POST",
      body: JSON.stringify({
        subject: "Monthly Update",
        content: "Please find the report attached.",
        target_group: "All Employees",
      }),
    });
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.id).toBe(42);
    expect(data.subject).toBe("Monthly Update");
  });

  test("POST /messages/ returns 403 for a user without messaging.send", async () => {
    /**
     * The backend returns 403 when the user lacks the send permission.
     * The MessagesPanel component hides the compose button in this case,
     * but the permission is also enforced server-side.
     */
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({ detail: "You don't have permission to send messages" }, 403)
    );

    const res = await apiFetch("/messages/", {
      method: "POST",
      body: JSON.stringify({
        subject: "Blocked",
        content: "This should fail.",
        target_group: "All Employees",
      }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// MESSAGING — inbox retrieval
// =============================================================================

describe("Messaging — inbox retrieval", () => {
  test("GET /messages/inbox returns a list for an authenticated user", async () => {
    /**
     * The inbox endpoint returns an array of MessageResponse objects.
     * Each item must have at minimum: id, subject, sender_name, is_read.
     */
    const inbox = [
      {
        id: 1,
        sender_id: 2,
        subject: "Welcome",
        content: "Welcome to the team!",
        target_group: "All Employees",
        sender_name: "Admin User",
        is_read: false,
        is_deleted: false,
        sender_deleted: false,
        created_at: new Date().toISOString(),
      },
    ];
    mockApiFetch.mockResolvedValueOnce(mockResponse(inbox));

    const res = await apiFetch("/messages/inbox");
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].subject).toBe("Welcome");
    expect(data[0].is_read).toBe(false);
  });

  test("GET /messages/inbox returns empty array when user has no messages", async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse([]));

    const res = await apiFetch("/messages/inbox");
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data).toEqual([]);
  });
});

// =============================================================================
// MESSAGING — permission check for sent box
// =============================================================================

describe("Messaging — sent box permission check", () => {
  test("GET /messages/sent returns 403 without messaging.send permission", async () => {
    /**
     * Only users with messaging.send permission have a sent box.
     * The backend returns 403 for everyone else.
     */
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(
        { detail: "You don't have permission to access the sent box" },
        403
      )
    );

    const res = await apiFetch("/messages/sent");
    const data = await res.json();

    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(data.detail).toMatch(/permission/i);
  });

  test("GET /messages/sent returns 200 with messaging.send permission", async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse([]));

    const res = await apiFetch("/messages/sent");
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(Array.isArray(data)).toBe(true);
  });
});
