import { createServerSupabase } from "@/lib/serverSupabase";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Contact, ContactFormValues } from "./contact-types";

export async function getContacts(filters: {
  search?: string;
  status?: string;
  companyId?: string;
} = {}) {
  const supabase = await createServerSupabase();

  const query = supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    if ((error as any).code === "42501") {
      return [];
    }
    throw error;
  }

  return (data ?? []) as Contact[];
}

export async function getContactById(id: string): Promise<Contact | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("contacts")
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

  return data as Contact;
}

export async function createContact(contact: ContactFormValues) {
  const { data, error } = await supabaseBrowser
    .from("contacts")
    .insert(contact)
    .select("*")
    .single();

  return { data, error };
}

export async function updateContact(id: string, contact: ContactFormValues) {
  const { data, error } = await supabaseBrowser
    .from("contacts")
    .update(contact)
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
}

export async function deleteContact(id: string) {
  const { error } = await supabaseBrowser
    .from("contacts")
    .delete()
    .eq("id", id);

  return { error };
}
