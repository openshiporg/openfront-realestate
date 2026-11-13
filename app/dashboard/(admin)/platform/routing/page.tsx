import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { RoutingPage } from "@/features/platform/routing/screens/RoutingPage";

export default async function Page() {
  await requirePlatformAccess("/platform/routing");
  return RoutingPage();
}
