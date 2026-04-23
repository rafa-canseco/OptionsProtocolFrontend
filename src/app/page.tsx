import { headers } from "next/headers";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    undefined;
  return <LandingPage hostname={host} />;
}
