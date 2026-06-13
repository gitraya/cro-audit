import { jsonResponse } from "./responses.ts";
import { runAuditPipeline } from "../cro-audit/pipeline.ts";

type EndpointUser = {
  id: string;
  email?: string;
} | null;

type QueryResult<T> = PromiseLike<{
  data: T;
  error: { message: string } | null;
}>;

type SelectBuilder = {
  order?: (
    column: string,
    options: { ascending: boolean },
  ) => QueryResult<unknown[] | null>;
  eq?: (
    column: string,
    value: string,
  ) => {
    single: () => QueryResult<unknown>;
  };
};

type EndpointSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: EndpointUser;
      };
    }>;
  };
  from: (table: "audits") => {
    select: (columns: string) => SelectBuilder;
    insert: (values: {
      user_id: string;
      url: string;
      status: "queued";
      stage: "scraping";
    }) => {
      select: (columns: string) => {
        single: () => QueryResult<unknown>;
      };
    };
  };
};

export type CreateAuditOptions = {
  // Continues the pipeline after the response is sent (Vercel `after()`).
  schedule: (task: () => Promise<void>) => void;
  runPipeline?: (auditId: string, url: string) => Promise<void>;
};

export async function getAuditsEndpoint(supabase: EndpointSupabaseClient) {
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const query = supabase.from("audits").select("*");
  const { data, error } = await query.order!("created_at", {
    ascending: false,
  });

  if (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }

  return jsonResponse({ audits: data });
}

// Async kick-off: creates the audit row and schedules the pipeline to keep
// running after the response is sent. Returns { auditId } immediately and never
// awaits the full pipeline.
export async function createAuditEndpoint(
  request: Request,
  supabase: EndpointSupabaseClient,
  options: CreateAuditOptions,
) {
  const { schedule, runPipeline = runAuditPipeline } = options;
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return jsonResponse({ error: "URL is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("audits")
    .insert({
      user_id: user.id,
      url,
      status: "queued",
      stage: "scraping",
    })
    .select("id")
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }

  const { id: auditId } = data as { id: string };

  schedule(() => runPipeline(auditId, url));

  return jsonResponse({ auditId }, { status: 201 });
}

async function getAuthenticatedUser(supabase: EndpointSupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
