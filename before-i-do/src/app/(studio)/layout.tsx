import { redirect } from "next/navigation";
import { getStudio } from "@/lib/auth/studio";
import { AppNav } from "@/components/shell/app-nav";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { workspace } = await getStudio();
  if (!workspace.onboarded_at) redirect("/welcome");

  return (
    <div className="min-h-dvh">
      <AppNav />
      <div className="pb-28 lg:ps-60 lg:pb-12">{children}</div>
    </div>
  );
}
