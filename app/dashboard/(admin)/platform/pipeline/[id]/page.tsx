import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { DealDetailPage } from "@/features/platform/pipeline/screens/DealDetailPage";

export default async function Page(props: Parameters<typeof DealDetailPage>[0]) {
  await requirePlatformAccess("/platform/pipeline");
  return DealDetailPage(props);
}
