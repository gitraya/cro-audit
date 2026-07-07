import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRO Audit",
  description:
    "A CRO audit and homepage replication workspace for brand-grounded website improvements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#fafafa] text-zinc-950 selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
