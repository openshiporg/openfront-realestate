import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { ShowingDetailPage } from "@/features/platform/showings/screens/ShowingDetailPage";

export default async function Page(props: Parameters<typeof ShowingDetailPage>[0]) {
  await requirePlatformAccess("/platform/showings");
  return ShowingDetailPage(props);
}
