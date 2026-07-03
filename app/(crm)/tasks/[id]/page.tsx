import { notFound } from "next/navigation";
import { TaskWorkspace } from "@/components/tasks";
import { getCompanies } from "@/src/modules/companies/company-service";
import { getContacts } from "@/src/modules/contacts/contact-service";
import { getContracts } from "@/src/modules/contracts/contract-service";
import { getLeads } from "@/src/modules/leads/lead-service";
import { getQuotations } from "@/src/modules/quotations/quotation-service";
import { getTaskById, getTasks } from "@/src/modules/tasks";

export const dynamic = "force-dynamic";

type TaskDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const resolved = await params;
  const taskId = resolved.id;

  const [task, taskOptions, companies, contacts, leads, quotations, contracts] = await Promise.all([
    getTaskById(taskId),
    getTasks(),
    getCompanies(),
    getContacts(),
    getLeads(),
    getQuotations(),
    getContracts(),
  ]);

  if (!task) {
    notFound();
  }

  const entityNames = {
    company: companies.find((company) => company.id === task.company_id)?.name,
    contact: contacts.find((contact) => contact.id === task.contact_id)?.name,
    lead: leads.find((lead) => lead.id === task.lead_id)?.title ?? leads.find((lead) => lead.id === task.lead_id)?.name,
    quotation: quotations.find((quotation) => quotation.id === task.quotation_id)?.quotation_number,
    contract: contracts.find((contract) => contract.id === task.contract_id)?.contract_number,
  };

  return <TaskWorkspace task={task} taskOptions={taskOptions} entityNames={entityNames} />;
}
