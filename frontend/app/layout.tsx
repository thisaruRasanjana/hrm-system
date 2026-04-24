import "./globals.css";
import { Arimo } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { AuthProvider } from "@/context/auth-context";

const arimo = Arimo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "HRMS - Employee Management",
  description: "Human Resource Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={arimo.className}>
        <AuthProvider>
          <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans">
            <main className="flex-1 flex flex-col min-w-0 h-full w-full">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}