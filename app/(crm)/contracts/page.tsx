import { ContractModule } from "@/components/contracts/ContractModule";
import { getContracts } from "@/src/modules/contracts/contract-service";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";

type ContractsPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const params = searchParams ? await searchParams : {};
  const initialSearch = (params.q ?? "").trim();

  const [initialContracts, companies, contacts] = await Promise.all([
    getContracts(),
    getCompanies(),
    getContacts(),
  ]);

  return (
    <ContractModule
      initialContracts={initialContracts}
      companies={companies}
      contacts={contacts}
      initialSearch={initialSearch}
    />
  );
}
