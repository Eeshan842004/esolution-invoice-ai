import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "ESolution — Smart Invoice System",
  description:
    "ESolution: Fully automated invoice-to-payment system. Create invoices, track payments, send emails automatically, and let AI handle reminders and predictions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
