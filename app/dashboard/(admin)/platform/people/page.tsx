import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { PeoplePage } from "@/features/platform/people/screens/PeoplePage";

export default async function Page(props: Parameters<typeof PeoplePage>[0]) {
  await requirePlatformAccess("/platform/people");
  return PeoplePage(props);
}
