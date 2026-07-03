import { supabaseBrowser } from "@/lib/supabaseClient";
import type { QuotationFormValues } from "./quotation-types";

export async function createQuotation(quotation: QuotationFormValues) {
  const { data, error } = await supabaseBrowser.from("quotations").insert(quotation).select("*").single();
  return { data, error };
}

export async function updateQuotation(id: string, quotation: QuotationFormValues) {
  const { data, error } = await supabaseBrowser.from("quotations").update(quotation).eq("id", id).select("*").single();
  return { data, error };
}

export async function deleteQuotation(id: string) {
  const { error } = await supabaseBrowser.from("quotations").delete().eq("id", id);
  return { error };
}

export async function updateQuotationStatus(id: string, status: string) {
  const { data, error } = await supabaseBrowser
    .from("quotations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
}

export async function archiveQuotation(id: string, archived = true) {
  const { data, error } = await supabaseBrowser
    .from("quotations")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
}

export async function bulkUpdateQuotationStatus(ids: string[], status: string) {
  const { data, error } = await supabaseBrowser
    .from("quotations")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("*");

  return { data, error };
}

export async function bulkArchiveQuotations(ids: string[], archived = true) {
  const { data, error } = await supabaseBrowser
    .from("quotations")
    .update({ archived, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("*");

  return { data, error };
}

export async function bulkDeleteQuotations(ids: string[]) {
  const { error } = await supabaseBrowser.from("quotations").delete().in("id", ids);
  return { error };
}
