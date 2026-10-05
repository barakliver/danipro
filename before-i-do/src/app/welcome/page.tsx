import { redirect } from "next/navigation";
import { getStudio } from "@/lib/auth/studio";
import { Welcome } from "./welcome";

export default async function WelcomePage() {
  const { workspace } = await getStudio();
  if (workspace.onboarded_at) redirect("/");
  return <Welcome />;
}
