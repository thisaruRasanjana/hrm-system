"use client";

import "./globals.css";
import { usePathname } from "next/navigation";

import SidebarEmployee from "./components/SidebarEmployee";
import SidebarHR from "./components/SidebarHR";
import Navbar from "./components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();

  // HR pages
  const isHRPage = pathname.startsWith("/documents/approval");

  return (
    <html lang="en">
      <body className="bg-gray-100">

        <div className="flex h-screen">

          {/* Sidebar */}
          {isHRPage ? <SidebarHR /> : <SidebarEmployee />}

          <div className="flex-1 flex justify-center">

            <div className="w-full max-w-7xl flex flex-col">

              {/* Navbar */}
              <Navbar />

              {/* Page Content */}
              <main className="flex-1 overflow-y-auto px-12 py-8">
                {children}
              </main>

            </div>

          </div>

        </div>

      </body>
    </html>
  );
}