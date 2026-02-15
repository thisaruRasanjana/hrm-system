import "./globals.css";
import { Arimo } from "next/font/google";

const arimo = Arimo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "HRM System",
  description: "HRMS Authentication",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={arimo.className}>{children}</body>
    </html>
  );
}


