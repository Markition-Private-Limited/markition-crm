import { notFound } from "next/navigation";
import { LeadProfile } from "@/components/leads/LeadProfile";
import { getLeadById } from "@/src/modules/leads/lead-service";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";

type LeadDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;

  const [lead, companies, contacts] = await Promise.all([
    getLeadById(id),
    getCompanies(),
    getContacts(),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <LeadProfile
      lead={lead}
      companies={companies}
      contacts={contacts}
    />
  );
}
