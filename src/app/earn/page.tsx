import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDefaultAssetSlug } from "@/lib/assets";

export default async function EarnPage() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? undefined;
  redirect(`/earn/${getDefaultAssetSlug(host)}`);
}
