import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { NewListingPage } from "@/features/platform/listings/screens/NewListingPage";

export default async function Page() {
  await requirePlatformAccess("/platform/listings");
  return NewListingPage();
}
