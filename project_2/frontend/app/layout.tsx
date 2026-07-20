import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UniGate — Academic AI Assistant",
  description:
    "Chat with the university academic database through a secure, OAuth-protected MCP server.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-full">{children}</body>
    </html>
  );
}
