import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { ListingDetailPage } from "@/features/platform/listings/screens/ListingDetailPage";

export default async function Page(props: Parameters<typeof ListingDetailPage>[0]) {
  await requirePlatformAccess("/platform/listings");
  return ListingDetailPage(props);
}
