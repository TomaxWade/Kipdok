import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { TransferProvider } from "@/components/transfer-provider";
import { createTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";

const bodyFont = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
  preload: false,
});

const monoFont = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const productName = t("brand.name");

  return {
    title: {
      default: productName,
      template: `%s · ${productName}`,
    },
    description: t("brand.summary"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body className={`${bodyFont.variable} ${monoFont.variable} min-h-screen bg-slate-950 text-slate-100 antialiased`}>
        <I18nProvider initialLocale={locale}>
          <TransferProvider>{children}</TransferProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
