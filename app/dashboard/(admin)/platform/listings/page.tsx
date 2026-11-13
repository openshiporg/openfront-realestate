import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { ListingListPage } from "@/features/platform/listings/screens/ListingListPage";

export default async function Page(props: Parameters<typeof ListingListPage>[0]) {
  await requirePlatformAccess("/platform/listings");
  return ListingListPage(props);
}
