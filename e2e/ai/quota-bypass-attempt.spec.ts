/**
 * AI-16: Quota bypass via pre-debit refund.
 * Verifies that the pre-debit + refund mechanism works correctly:
 * when a stream ends with confirmation pending (skipIncrement=true),
 * the message slot is refunded and subsequent requests still work.
 *
 * Uses AI_PROVIDER=mock.
 */

import { test, expect } from "@playwright/test";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { USER_AI_ADMIN, seedAiUsage, clearAiUsage } from "../seed/data/ai";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

test.describe.configure({ mode: "serial" });

test.describe("AI-16: Quota bypass — pre-debit refund", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await clearAiUsage(db, "ai-test");
  });

  test("a confirmation-pending response does not permanently consume a message slot", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_ADMIN.email,
      USER_AI_ADMIN.password,
    );

    // Seed usage to 399 (one below pro limit of 400)
    await seedAiUsage(db, "ai-test", 399);

    // Send a message that triggers the mock's "delete" flow → requiresConfirmation=true
    // The mock yields request_confirmation tool_call → requiresConfirmation in tool result
    // → skipIncrement=true → slot refunded → usage stays at 399
    const r1 = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "delete something", sessionId: "quota-bypass-1" }),
    });
    expect(r1.status).toBe(200);

    // A second regular request should succeed (usage still at 399, not 400)
    const r2 = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "olá", sessionId: "quota-bypass-2" }),
    });
    // Should NOT be 429 AI_LIMIT_EXCEEDED if refund worked
    // (may be 200 for mock, or 429 only if refund failed and usage hit 400)
    if (r2.status === 429) {
      const body = (await r2.json()) as Record<string, unknown>;
      expect(body.code).not.toBe("AI_LIMIT_EXCEEDED");
    } else {
      expect(r2.status).toBe(200);
    }
  });

  test("at-limit user is correctly blocked regardless of confirmation state", async () => {
    const { idToken } = await signInWithEmailPassword(
      USER_AI_ADMIN.email,
      USER_AI_ADMIN.password,
    );

    await seedAiUsage(db, "ai-test", 400);

    const r = await fetch(`${FUNCTIONS_BASE}/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ message: "olá", sessionId: "quota-bypass-3" }),
    });

    expect(r.status).toBe(429);
    const body = (await r.json()) as Record<string, unknown>;
    expect(body.code).toBe("AI_LIMIT_EXCEEDED");
  });
});
