import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { ReportsPage } from "@/features/platform/reports/screens/ReportsPage";

export default async function Page() {
  await requirePlatformAccess("/platform/reports");
  return ReportsPage();
}
