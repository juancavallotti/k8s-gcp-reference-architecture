import { createContactAction } from "@/actions/contacts";

export function ContactForm() {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">Add Contact</h2>
      <form action={createContactAction} className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Name
          <input
            name="name"
            required
            maxLength={120}
            className="rounded-md border border-zinc-300 px-3 py-2 outline-none ring-zinc-900/20 focus:ring"
            placeholder="Jane Doe"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={255}
            className="rounded-md border border-zinc-300 px-3 py-2 outline-none ring-zinc-900/20 focus:ring"
            placeholder="jane@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Phone
          <input
            name="phone"
            required
            maxLength={50}
            className="rounded-md border border-zinc-300 px-3 py-2 outline-none ring-zinc-900/20 focus:ring"
            placeholder="+1 555 1234"
          />
        </label>
        <div className="md:col-span-3">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create contact
          </button>
        </div>
      </form>
    </section>
  );
}
