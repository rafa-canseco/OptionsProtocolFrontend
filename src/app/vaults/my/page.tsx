import type { Metadata } from "next";
import { VaultsPageLoader } from "@/components/vaults/VaultsPageLoader";

export const metadata: Metadata = {
  title: "My Vaults",
  description: "Your tokenized fund position on Base.",
};

export default function MyVaultsRoute() {
  return <VaultsPageLoader view="my" />;
}
