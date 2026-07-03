import { notFound } from "next/navigation";
import { ContractProfile } from "@/components/contracts/ContractProfile";
import { getContractById } from "@/src/modules/contracts/contract-service";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";
import { getQuotations } from "@/src/modules/quotations/quotation-service";

type ContractDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContractDetailPage({ params }: ContractDetailPageProps) {
  const { id } = await params;

  const [contract, companies, contacts, quotations] = await Promise.all([
    getContractById(id),
    getCompanies(),
    getContacts(),
    getQuotations(),
  ]);

  if (!contract) {
    notFound();
  }

  return (
    <ContractProfile
      contract={contract}
      companies={companies}
      contacts={contacts}
      quotations={quotations}
    />
  );
}
