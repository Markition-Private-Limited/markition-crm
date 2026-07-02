import { createServerSupabase } from "@/lib/serverSupabase";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Lead, LeadFormValues } from "./lead-types";

export async function getLeads() {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if ((error as any).code === "42501") {
      return [];
    }
    throw error;
  }

  return (data ?? []) as Lead[];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("leads")
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

  return data as Lead;
}

export async function createLead(lead: LeadFormValues) {
  const { data, error } = await supabaseBrowser
    .from("leads")
    .insert(lead)
    .select("*")
    .single();

  return { data, error };
}

export async function updateLead(id: string, lead: LeadFormValues) {
  const { data, error } = await supabaseBrowser
    .from("leads")
    .update(lead)
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
}

export async function deleteLead(id: string) {
  const { error } = await supabaseBrowser
    .from("leads")
    .delete()
    .eq("id", id);

  return { error };
}
