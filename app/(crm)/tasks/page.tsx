import { TasksModule } from "@/components/tasks";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";
import { getContracts } from "@/src/modules/contracts/contract-service";
import { getLeads } from "@/src/modules/leads/lead-service";
import { getQuotations } from "@/src/modules/quotations/quotation-service";
import { getTasks } from "@/src/modules/tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, companies, contacts, leads, quotations, contracts] = await Promise.all([
    getTasks(),
    getCompanies(),
    getContacts(),
    getLeads(),
    getQuotations(),
    getContracts(),
  ]);

  return (
    <TasksModule
      initialTasks={tasks}
      companies={companies}
      contacts={contacts}
      leads={leads}
      quotations={quotations}
      contracts={contracts}
    />
  );
}
