import { createServerSupabase } from "@/lib/serverSupabase";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Quotation, QuotationFormValues } from "./quotation-types";

export async function getQuotations(filters: { search?: string; status?: string; archived?: boolean } = {}) {
  const supabase = await createServerSupabase();

  let query = supabase.from("quotations").select("*").order("created_at", { ascending: false });

  const search = filters.search?.trim();
  if (search) {
    query = query.or(
      `quotation_number.ilike.%${search}%,reference_number.ilike.%${search}%,sales_representative.ilike.%${search}%,currency.ilike.%${search}%`,
    );
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.archived !== undefined) {
    query = query.eq("archived", filters.archived);
  }

  const { data, error } = await query;
  if (error) {
    if ((error as any).code === "42501") {
      return [];
    }
    throw error;
  }

  return (data ?? []) as Quotation[];
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if ((error as any).code === "42501") {
      return null;
    }
    if (error.details?.includes("No rows found")) {
      return null;
    }
    throw error;
  }

  return data as Quotation;
}

export async function createQuotation(quotation: QuotationFormValues) {
  const { data, error } = await supabaseBrowser
    .from("quotations")
    .insert(quotation)
    .select("*")
    .single();

  return { data, error };
}

export async function updateQuotation(id: string, quotation: QuotationFormValues) {
  const { data, error } = await supabaseBrowser
    .from("quotations")
    .update(quotation)
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
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

export async function deleteQuotation(id: string) {
  const { error } = await supabaseBrowser.from("quotations").delete().eq("id", id);
  return { error };
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
