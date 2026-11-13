import { requirePlatformAccess } from "@/features/platform/lib/requireAccess";
import { TaskListPage } from "@/features/platform/tasks/screens/TaskListPage";

export default async function Page(props: Parameters<typeof TaskListPage>[0]) {
  await requirePlatformAccess("/platform/tasks");
  return TaskListPage(props);
}
