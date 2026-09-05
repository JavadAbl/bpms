import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/common/theme-provider";
import { MUIRTLProvider } from "@/components/common/mui-rtl-provider";
import { AppProviders } from "@/components/common/app-providers";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "سامانه مدیریت فرآیندها | BPMS",
  description: "سیستم مدیریت فرآیندهای کسب‌وکار - BPMS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <MUIRTLProvider>
            <AppProviders>
              {children}
              <Toaster />
            </AppProviders>
          </MUIRTLProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
