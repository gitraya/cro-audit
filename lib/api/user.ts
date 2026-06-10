import { jsonResponse } from "./responses.ts";

type QueryResult<T> = PromiseLike<{
  data: T;
  error: { message: string } | null;
}>;

type EndpointSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: {
          id: string;
          email?: string;
        } | null;
      };
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        single: () => QueryResult<unknown>;
      };
    };
  };
};

export async function getUserEndpoint(supabase: EndpointSupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }

  return jsonResponse({ user, profile });
}
