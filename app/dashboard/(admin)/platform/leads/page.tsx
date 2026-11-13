import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { LeadListPage } from "@/features/platform/leads/screens/LeadListPage";

export default async function Page(props: Parameters<typeof LeadListPage>[0]) {
  await requirePlatformAccess("/platform/leads");
  return LeadListPage(props);
}
