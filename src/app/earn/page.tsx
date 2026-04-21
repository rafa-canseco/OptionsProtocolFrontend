import { redirect } from "next/navigation";
import { getDefaultAssetSlug } from "@/lib/assets";

export default function EarnPage() {
  redirect(`/earn/${getDefaultAssetSlug()}`);
}
