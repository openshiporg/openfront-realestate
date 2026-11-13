import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { PipelinePage } from "@/features/platform/pipeline/screens/PipelinePage";

export default async function Page(props: Parameters<typeof PipelinePage>[0]) {
  await requirePlatformAccess("/platform/pipeline");
  return PipelinePage(props);
}
