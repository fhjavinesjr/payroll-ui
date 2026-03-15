//Layout.tsx is the main parent file

import type { Metadata } from "next";
import './globals.css';
import PageAuthentication from "./PageAuthentication";
import LayoutClientWrapper from "./layoutClientWrapper";

export const metadata: Metadata = {
  title: "Payroll Management",
  description: "Powered by NextJS",
};

export default function RootLayout({children,}: Readonly<{children: React.ReactNode;}>) {
  return (
    <html lang="en">
      <body className="Payroll-Management">

        <PageAuthentication>
          <LayoutClientWrapper>
            {children}
          </LayoutClientWrapper>
        </PageAuthentication>

      </body>
    </html>
  );
}
