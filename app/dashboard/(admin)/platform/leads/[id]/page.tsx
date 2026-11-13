import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { LeadDetailPage } from "@/features/platform/leads/screens/LeadDetailPage";

export default async function Page(props: Parameters<typeof LeadDetailPage>[0]) {
  await requirePlatformAccess("/platform/leads");
  return LeadDetailPage(props);
}
