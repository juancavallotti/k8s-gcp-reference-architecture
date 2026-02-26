import { listContactsAction } from "@/actions/contacts";
import { ContactForm } from "@/components/contacts/contact-form";
import { ContactList } from "@/components/contacts/contact-list";
import { resolveActiveDatabaseConfig } from "@/persistence/db/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const contacts = await listContactsAction();
  const activeDatabase = resolveActiveDatabaseConfig();

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold text-zinc-900">Contacts CRUD</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Next.js server actions, SQLite, and layered architecture.
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            DB ({activeDatabase.engine}): {activeDatabase.url}
          </p>
        </header>
        <ContactForm />
        <ContactList contacts={contacts} />
      </div>
    </main>
  );
}
