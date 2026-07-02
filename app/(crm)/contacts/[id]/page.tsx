import { notFound } from "next/navigation";
import { ContactProfile } from "@/components/contacts/ContactProfile";
import { getContactById } from "@/src/modules/contacts/contact-service";
import { getCompanies } from "@/src/modules/companies/company-service";

interface ContactPageProps {
  params: {
    id: string;
  };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const [contact, companies] = await Promise.all([getContactById(params.id), getCompanies()]);

  if (!contact) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contact details</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{contact.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Review contact information, update relationship context, or remove this record.</p>
        </div>
      </div>

      <ContactProfile contact={contact} companies={companies} />
    </div>
  );
}
