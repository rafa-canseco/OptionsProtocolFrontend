import { NavBar } from "@/components/NavBar";

export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
