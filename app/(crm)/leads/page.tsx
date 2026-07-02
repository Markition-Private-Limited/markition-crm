import { LeadsModule } from "@/components/leads/LeadsModule";
import { getLeads } from "@/src/modules/leads/lead-service";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";

type LeadsPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = searchParams ? await searchParams : {};
  const searchQuery = (params.q ?? "").trim();

  const [initialLeads, companies, contacts] = await Promise.all([
    getLeads(),
    getCompanies(),
    getContacts(),
  ]);

  return (
    <LeadsModule
      initialLeads={initialLeads}
      companies={companies}
      contacts={contacts}
      initialSearch={searchQuery}
    />
  );
}
