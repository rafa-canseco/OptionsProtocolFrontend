import type { Metadata } from "next";
import { VaultsPageLoader } from "@/components/vaults/VaultsPageLoader";

export const metadata: Metadata = {
  title: "Vaults",
  description: "Automated options strategies on Base.",
};

export default function VaultsRoute() {
  return <VaultsPageLoader />;
}
