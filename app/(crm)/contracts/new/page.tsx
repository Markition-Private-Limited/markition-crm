import { ContractForm } from "@/components/contracts/ContractForm";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";
import { getQuotations } from "@/src/modules/quotations/quotation-service";

export default async function NewContractPage() {
  const [companies, contacts, quotations] = await Promise.all([
    getCompanies(),
    getContacts(),
    getQuotations({ status: "Accepted" }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contracts</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">Create contract</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Capture the signed agreement record, attach the legal terms, and track the contract through the renewal cycle.</p>
      </section>

      <ContractForm
        companies={companies}
        contacts={contacts}
        quotations={quotations}
        draftKey="contract-create-draft"
      />
    </div>
  );
}
