import type { ContactsPageProps } from "../page";
import ContactsPage from "../page";

type ContactDetailRouteProps = Omit<ContactsPageProps, "initialSelectedId"> & {
  params: { id: string };
};

export default function ContactsPageWithId({
  searchParams,
  params
}: ContactDetailRouteProps) {
  return <ContactsPage searchParams={searchParams} initialSelectedId={params.id} />;
}
export const dynamic = "force-dynamic";
