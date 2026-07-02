import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Contact, ContactFormValues } from "./contact-types";

export async function createContact(contact: ContactFormValues) {
  const { data, error } = await supabaseBrowser
    .from("contacts")
    .insert(contact)
    .select("*")
    .single();

  return { data: data as Contact | null, error };
}

export async function updateContact(id: string, contact: ContactFormValues) {
  const { data, error } = await supabaseBrowser
    .from("contacts")
    .update(contact)
    .eq("id", id)
    .select("*")
    .single();

  return { data: data as Contact | null, error };
}

export async function deleteContact(id: string) {
  const { error } = await supabaseBrowser
    .from("contacts")
    .delete()
    .eq("id", id);

  return { error };
}
