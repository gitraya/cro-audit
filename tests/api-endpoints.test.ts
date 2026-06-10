import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuditEndpoint,
  getAuditsEndpoint,
} from "../lib/api/audits.ts";
import { getUserEndpoint } from "../lib/api/user.ts";

const authenticatedUser = {
  id: "user-123",
  email: "raya@example.com",
};

test("GET /api/user returns 401 without an authenticated user", async () => {
  const response = await getUserEndpoint(createUserClient({ user: null }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("GET /api/user returns the authenticated user profile", async () => {
  const profile = {
    id: authenticatedUser.id,
    email: authenticatedUser.email,
    full_name: "Raya",
  };
  const response = await getUserEndpoint(
    createUserClient({ user: authenticatedUser, profileData: profile }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    user: authenticatedUser,
    profile,
  });
});

test("GET /api/user returns 500 when profile lookup fails", async () => {
  const response = await getUserEndpoint(
    createUserClient({
      user: authenticatedUser,
      profileError: { message: "profile lookup failed" },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "profile lookup failed" });
});

test("GET /api/audits returns 401 without an authenticated user", async () => {
  const response = await getAuditsEndpoint(createAuditsClient({ user: null }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("GET /api/audits returns audit history ordered by newest first", async () => {
  const audits = [
    {
      id: "audit-2",
      user_id: authenticatedUser.id,
      url: "https://new.example",
      status: "queued",
      created_at: "2026-06-10T00:00:00.000Z",
    },
  ];
  const client = createAuditsClient({
    user: authenticatedUser,
    auditsData: audits,
  });
  const response = await getAuditsEndpoint(client);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { audits });
  assert.deepEqual(client.calls.order, {
    column: "created_at",
    options: { ascending: false },
  });
});

test("GET /api/audits returns 500 when audit history lookup fails", async () => {
  const response = await getAuditsEndpoint(
    createAuditsClient({
      user: authenticatedUser,
      auditsError: { message: "audit query failed" },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "audit query failed" });
});

test("POST /api/audits returns 401 without an authenticated user", async () => {
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "https://example.com" }),
    createAuditsClient({ user: null }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("POST /api/audits returns 400 when URL is missing", async () => {
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "   " }),
    createAuditsClient({ user: authenticatedUser }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "URL is required" });
});

test("POST /api/audits creates a queued audit with the authenticated user id", async () => {
  const audit = {
    id: "audit-1",
    user_id: authenticatedUser.id,
    url: "https://example.com",
    status: "queued",
  };
  const client = createAuditsClient({
    user: authenticatedUser,
    insertedAuditData: audit,
  });
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "  https://example.com  " }),
    client,
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { audit });
  assert.deepEqual(client.calls.insert, {
    user_id: authenticatedUser.id,
    url: "https://example.com",
    status: "queued",
  });
});

test("POST /api/audits returns 500 when audit insert fails", async () => {
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "https://example.com" }),
    createAuditsClient({
      user: authenticatedUser,
      insertError: { message: "insert failed" },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "insert failed" });
});

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/audits", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
}

function createUserClient(options: {
  user: typeof authenticatedUser | null;
  profileData?: unknown;
  profileError?: { message: string } | null;
}) {
  return {
    auth: {
      async getUser() {
        return { data: { user: options.user } };
      },
    },
    from(table: string) {
      assert.equal(table, "profiles");

      return {
        select(columns: string) {
          assert.equal(columns, "*");

          return {
            eq(column: string, value: string) {
              assert.equal(column, "id");
              assert.equal(value, options.user?.id);

              return {
                async single() {
                  return {
                    data: options.profileData ?? null,
                    error: options.profileError ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function createAuditsClient(options: {
  user: typeof authenticatedUser | null;
  auditsData?: unknown[];
  auditsError?: { message: string } | null;
  insertedAuditData?: unknown;
  insertError?: { message: string } | null;
}) {
  const calls: {
    order?: {
      column: string;
      options: { ascending: boolean };
    };
    insert?: {
      user_id: string;
      url: string;
      status: "queued";
    };
  } = {};

  return {
    calls,
    auth: {
      async getUser() {
        return { data: { user: options.user } };
      },
    },
    from(table: string) {
      assert.equal(table, "audits");

      return {
        select(columns: string) {
          assert.equal(columns, "*");

          return {
            async order(column: string, orderOptions: { ascending: boolean }) {
              calls.order = { column, options: orderOptions };

              return {
                data: options.auditsData ?? [],
                error: options.auditsError ?? null,
              };
            },
          };
        },
        insert(values: { user_id: string; url: string; status: "queued" }) {
          calls.insert = values;

          return {
            select(columns: string) {
              assert.equal(columns, "*");

              return {
                async single() {
                  return {
                    data: options.insertedAuditData ?? null,
                    error: options.insertError ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}
