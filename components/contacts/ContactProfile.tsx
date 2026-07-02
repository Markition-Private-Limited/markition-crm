"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contacts/ContactForm";
import { deleteContact } from "@/src/modules/contacts/contact-client";
import type { Contact } from "@/src/modules/contacts/contact-types";
import type { Company } from "@/src/modules/companies/company-types";

interface ContactProfileProps {
  contact: Contact;
  companies: Company[];
}

export function ContactProfile({ contact, companies }: ContactProfileProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const router = useRouter();

  const assignedCompany = companies.find((company) => company.id === contact.company_id);

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this contact? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    const { error } = await deleteContact(contact.id);
    if (error) {
      setErrorMessage(error.message);
      setIsDeleting(false);
      return;
    }

    router.push("/contacts");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contact profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{contact.name}</h1>
          <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <p>{contact.email || "No email"}</p>
            <p>{contact.phone || "No phone"}</p>
            <p>{contact.position || "No position"}</p>
            <p>
              Company:{" "}
              {assignedCompany ? (
                <Link href={`/companies/${assignedCompany.id}`} className="text-sky-600 hover:underline dark:text-sky-400">
                  {assignedCompany.name}
                </Link>
              ) : (
                "Unassigned"
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? "Close editor" : "Edit contact"}
          </Button>
          <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete contact"}
          </Button>
        </div>
      </div>

      {contact.notes ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:shadow-none">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notes</p>
          <p className="whitespace-pre-wrap">{contact.notes}</p>
        </div>
      ) : null}

      {errorMessage ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{errorMessage}</div> : null}

      {isEditing ? (
        <ContactForm
          contact={contact}
          companies={companies}
          mode="edit"
          onSaved={() => {
            setIsEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
