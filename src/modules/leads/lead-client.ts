import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Lead, LeadFormValues } from "./lead-types";

export async function createLead(lead: LeadFormValues) {
  const { data, error } = await supabaseBrowser
    .from("leads")
    .insert(lead)
    .select("*")
    .single();

  return { data: data as Lead | null, error };
}

export async function updateLead(id: string, lead: LeadFormValues) {
  const { data, error } = await supabaseBrowser
    .from("leads")
    .update(lead)
    .eq("id", id)
    .select("*")
    .single();

  return { data: data as Lead | null, error };
}

export async function deleteLead(id: string) {
  const { error } = await supabaseBrowser
    .from("leads")
    .delete()
    .eq("id", id);

  return { error };
}
