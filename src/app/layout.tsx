import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Provana KMS Chat",
  description: "Your Knowledge Management Solution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          id="check-auth"
          dangerouslySetInnerHTML={{
            __html: `
              if (window.location.pathname !== '/login') {
                const isLoggedIn = document.cookie.includes('isLoggedIn=true');
                if (!isLoggedIn && window.location.pathname !== '/login') {
                  window.location.href = '/login';
                }
              }
            `,
          }}
        />
      </head>
      <body className={inter.variable + " antialiased"}>{children}</body>
    </html>
  );
}
