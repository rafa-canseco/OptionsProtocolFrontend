import { NavBar } from "@/components/NavBar";

export default function EarnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
