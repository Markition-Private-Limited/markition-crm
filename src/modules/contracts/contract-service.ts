import { createServerSupabase } from "@/lib/serverSupabase";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Contract, ContractCommentEntry, ContractFormValues } from "./contract-types";

export async function getContracts(filters: { search?: string; status?: string; archived?: boolean } = {}) {
  const supabase = await createServerSupabase();

  let query = supabase.from("contracts").select("*").order("created_at", { ascending: false });

  const search = filters.search?.trim();
  if (search) {
    query = query.or(
      `contract_number.ilike.%${search}%,contract_name.ilike.%${search}%,sales_representative.ilike.%${search}%,currency.ilike.%${search}%`,
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
    const errorCode = (error as any).code;
    if (errorCode === "42501" || errorCode === "42P01" || errorCode === "PGRST205") {
      return [];
    }
    throw error;
  }

  return (data ?? []) as Contract[];
}

export async function getContractById(id: string): Promise<Contract | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    const errorCode = (error as any).code;
    if (errorCode === "42501" || errorCode === "42P01" || errorCode === "PGRST205") {
      return null;
    }
    if (error.details?.includes("No rows found")) {
      return null;
    }
    throw error;
  }

  return data as Contract;
}

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
  const contract = await getContractById(id);
  const comments = Array.isArray(contract?.comments)
    ? contract.comments
    : (() => {
        try {
          return JSON.parse(contract?.comments ?? "[]") as ContractCommentEntry[];
        } catch {
          return [];
        }
      })();

  const nextComments = [...comments, comment];
  const { data, error } = await supabaseBrowser
    .from("contracts")
    .update({ comments: nextComments, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  return { data, error };
}
