import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { PaymentProvidersPage } from "@/features/platform/payments/screens/PaymentProvidersPage";

export default async function Page() {
  await requirePlatformAccess("/platform/payment-providers");
  return PaymentProvidersPage();
}
