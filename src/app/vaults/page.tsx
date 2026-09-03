import type { Metadata } from "next";
import { VaultsPage } from "@/components/vaults/VaultsPage";

export const metadata: Metadata = {
  title: "Vaults · Coming Soon",
  description: "Preview planned automated ETH and cbBTC option strategies on Base.",
};

export default function VaultsRoute() {
  return <VaultsPage />;
}
