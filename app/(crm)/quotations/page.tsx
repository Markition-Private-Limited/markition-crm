import { QuotationModule } from "@/components/quotations/QuotationModule";
import { getQuotations } from "@/src/modules/quotations/quotation-service";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";

type QuotationsPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function QuotationsPage({ searchParams }: QuotationsPageProps) {
  const params = searchParams ? await searchParams : {};
  const initialSearch = (params.q ?? "").trim();

  const [initialQuotations, companies, contacts] = await Promise.all([
    getQuotations(),
    getCompanies(),
    getContacts(),
  ]);

  return (
    <QuotationModule
      initialQuotations={initialQuotations}
      companies={companies}
      contacts={contacts}
      initialSearch={initialSearch}
    />
  );
}
