import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { OperationsPage } from "@/features/platform/operations/screens/OperationsPage";

export default async function Page(props: Parameters<typeof OperationsPage>[0]) {
  await requirePlatformAccess("/platform/operations");
  return OperationsPage(props);
}
