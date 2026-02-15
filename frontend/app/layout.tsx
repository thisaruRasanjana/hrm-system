import "./globals.css";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <div className="flex h-screen">

          {/* Sidebar */}
          <Sidebar />

          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-7xl flex flex-col">


              {/* Top Navbar */}
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
