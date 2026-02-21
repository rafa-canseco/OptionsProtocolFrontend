import type { Metadata } from "next";

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://try.b1nary.xyz";

  return {
    title: `${shortAddr} — b1nary Weekly Result`,
    description: `See ${shortAddr}'s simulated options earnings on b1nary.`,
    openGraph: {
      title: `${shortAddr} — b1nary Weekly Result`,
      description: `See ${shortAddr}'s simulated options earnings on b1nary.`,
      images: [
        {
          url: `${siteUrl}/og/result/${address}`,
          width: 1200,
          height: 630,
          alt: `${shortAddr} b1nary result card`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${shortAddr} — b1nary Weekly Result`,
      description: `See ${shortAddr}'s simulated options earnings on b1nary.`,
      images: [`${siteUrl}/og/result/${address}`],
    },
  };
}

export default function PersonalResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
