import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";

export const metadata = {
  title: "Luminexa Document Generator",
  description: "Quotation, proforma invoice and invoice generator.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          <Navbar />
          <main className="container">{children}</main>
        </AuthGuard>
      </body>
    </html>
  );
}