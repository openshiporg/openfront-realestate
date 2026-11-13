import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { PaymentsPage } from "@/features/platform/payments/screens/PaymentsPage";

export default async function Page() {
  await requirePlatformAccess("/platform/payments");
  return PaymentsPage();
}
