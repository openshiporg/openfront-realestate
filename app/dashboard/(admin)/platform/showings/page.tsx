import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { ShowingListPage } from "@/features/platform/showings/screens/ShowingListPage";

export default async function Page(props: Parameters<typeof ShowingListPage>[0]) {
  await requirePlatformAccess("/platform/showings");
  return ShowingListPage(props);
}
