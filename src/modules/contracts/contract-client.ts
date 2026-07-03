import { supabaseBrowser } from "@/lib/supabaseClient";
import type { ContractCommentEntry, ContractFormValues } from "./contract-types";

export async function createContract(contract: ContractFormValues) {
  const { data, error } = await supabaseBrowser.from("contracts").insert(contract).select("*").single();
  return { data, error };
}

export async function updateContract(id: string, contract: ContractFormValues) {
  const { data, error } = await supabaseBrowser.from("contracts").update(contract).eq("id", id).select("*").single();
  return { data, error };
}

export async function deleteContract(id: string) {
  const { error } = await supabaseBrowser.from("contracts").delete().eq("id", id);
  return { error };
}

export async function archiveContract(id: string, archived = true) {
  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

export async function terminateContract(id: string) {
  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ status: "Terminated", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

export async function renewContract(id: string) {
  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ status: "Renewed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

export async function updateContractStatus(id: string, status: string) {
  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

export async function bulkUpdateContractStatus(ids: string[], status: string) {
  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("*");
  return { data, error };
}

export async function bulkArchiveContracts(ids: string[], archived = true) {
  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ archived, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("*");
  return { data, error };
}

export async function bulkDeleteContracts(ids: string[]) {
  const { error } = await supabaseBrowser.from("contracts").delete().in("id", ids);
  return { error };
}

export async function appendContractComment(id: string, comment: ContractCommentEntry) {
  const { data: contract, error: fetchError } = await supabaseBrowser
    .from("contracts")
    .select("comments")
    .eq("id", id)
    .single();

  if (fetchError) {
    return { data: null, error: fetchError };
  }

  const comments = Array.isArray(contract?.comments)
    ? contract.comments
    : (() => {
        try {
          return JSON.parse(contract?.comments ?? "[]") as ContractCommentEntry[];
        } catch {
          return [];
        }
      })();

  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ comments: [...comments, comment], updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
}
