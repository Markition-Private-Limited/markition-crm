import { ContactsModule } from "@/components/contacts/ContactsModule";
import { getContacts } from "@/src/modules/contacts/contact-service";
import { getCompanies } from "@/src/modules/companies/company-service";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    company?: string;
  }>;
}) {
  const params = await searchParams;
  const [contacts, companies] = await Promise.all([getContacts(), getCompanies()]);

  return <ContactsModule initialContacts={contacts} companies={companies} initialSearch={params.search ?? ""} />;
}
