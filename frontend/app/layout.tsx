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
            {/* Sidebar — shared across all pages */}
            <Sidebar />

            {/* Main container: TopBar + page content */}
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <main className="flex-1 overflow-y-auto p-10">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}