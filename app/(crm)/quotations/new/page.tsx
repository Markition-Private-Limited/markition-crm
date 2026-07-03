import { QuotationForm } from "@/components/quotations/QuotationForm";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";

export default async function NewQuotationPage() {
  const [companies, contacts] = await Promise.all([getCompanies(), getContacts()]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Quotations</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">Create quotation</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Build a client-ready quotation with line items, validity dates, and commercial notes.</p>
      </section>

      <QuotationForm
        companies={companies}
        contacts={contacts}
        draftKey="quotation-create-draft"
      />
    </div>
  );
}
