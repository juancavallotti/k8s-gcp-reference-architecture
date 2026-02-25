import { deleteContactAction, updateContactAction } from "@/actions/contacts";
import type { Contact } from "@/domain/contact";

interface ContactListProps {
  contacts: Contact[];
}

export function ContactList({ contacts }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
        No contacts yet. Add your first one above.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">Saved Contacts</h2>
      <div className="space-y-4">
        {contacts.map((contact) => (
          <div key={contact.id} className="rounded-md border border-zinc-200 p-4">
            <form action={updateContactAction} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="id" value={contact.id} />

              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Name
                <input
                  name="name"
                  defaultValue={contact.name}
                  required
                  maxLength={120}
                  className="rounded-md border border-zinc-300 px-3 py-2 outline-none ring-zinc-900/20 focus:ring"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={contact.email}
                  required
                  maxLength={255}
                  className="rounded-md border border-zinc-300 px-3 py-2 outline-none ring-zinc-900/20 focus:ring"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Phone
                <input
                  name="phone"
                  defaultValue={contact.phone}
                  required
                  maxLength={50}
                  className="rounded-md border border-zinc-300 px-3 py-2 outline-none ring-zinc-900/20 focus:ring"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Update
                </button>
              </div>
            </form>

            <form action={deleteContactAction} className="mt-3">
              <input type="hidden" name="id" value={contact.id} />
              <button
                type="submit"
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
              >
                Delete
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
