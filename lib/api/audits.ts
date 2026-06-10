import { jsonResponse } from "./responses.ts";
import { scrapeHomepage, type ScrapedHomepage } from "../scraper/homepage.ts";

type EndpointUser = {
  id: string;
  email?: string;
} | null;

type QueryResult<T> = PromiseLike<{
  data: T;
  error: { message: string } | null;
}>;

type EndpointSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: EndpointUser;
      };
    }>;
  };
  from: (table: "audits") => {
    select: (columns: string) => {
      order?: (
        column: string,
        options: { ascending: boolean },
      ) => QueryResult<unknown[] | null>;
      single?: () => QueryResult<unknown>;
    };
    insert: (values: {
      user_id: string;
      url: string;
      status: "queued";
      brand_tokens: {
        scrape: ScrapedHomepage;
      };
    }) => {
      select: (columns: string) => {
        single: () => QueryResult<unknown>;
      };
    };
  };
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

export async function createAuditEndpoint(
  request: Request,
  supabase: EndpointSupabaseClient,
  scraper: (url: string) => Promise<ScrapedHomepage> = scrapeHomepage,
) {
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return jsonResponse({ error: "URL is required" }, { status: 400 });
  }

  let scrapedPage: ScrapedHomepage;

  try {
    scrapedPage = await scraper(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return jsonResponse({ error: message }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("audits")
    .insert({
      user_id: user.id,
      url: scrapedPage.requestedUrl,
      status: "queued",
      brand_tokens: {
        scrape: scrapedPage,
      },
    })
    .select("*")
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }

  return jsonResponse({ audit: data }, { status: 201 });
}

async function getAuthenticatedUser(supabase: EndpointSupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
