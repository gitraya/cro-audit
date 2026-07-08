import { notFound, redirect } from "next/navigation";
import { AuditDetail } from "./audit-detail";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AuditPage({ params }: AuditPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: audit, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !audit) {
    notFound();
  }

  // Server renders the first, fully-styled snapshot; the client component then
  // polls the row and updates in place while the audit is still running.
  return <AuditDetail initialAudit={audit} />;
}
