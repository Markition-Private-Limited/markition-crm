import { notFound } from "next/navigation";
import { QuotationProfile } from "@/components/quotations/QuotationProfile";
import { getQuotationById } from "@/src/modules/quotations/quotation-service";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";

type QuotationDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotationDetailPage({ params }: QuotationDetailPageProps) {
  const { id } = await params;

  const [quotation, companies, contacts] = await Promise.all([
    getQuotationById(id),
    getCompanies(),
    getContacts(),
  ]);

  if (!quotation) {
    notFound();
  }

  return (
    <QuotationProfile
      quotation={quotation}
      companies={companies}
      contacts={contacts}
    />
  );
}
