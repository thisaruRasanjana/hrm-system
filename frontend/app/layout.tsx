import "./globals.css";
import { Arimo } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { AuthProvider } from "@/context/auth-context";
import { Toaster } from "react-hot-toast";

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
    <html lang="en" suppressHydrationWarning>
      <body className={arimo.className} suppressHydrationWarning>
        <AuthProvider>
          <div className="flex min-h-screen bg-[#F8F9FA] font-sans">
            <main className="flex-1 flex flex-col min-w-0 w-full">
              {children}
            </main>
          </div>
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#333',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#059669',
                },
              },
              error: {
                style: {
                  background: '#DC2626',
                },
              }
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}