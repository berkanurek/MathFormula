import { HowItWorksClient } from "./HowItWorksClient";
import { routing } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return {};
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "howItWorks.meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function HowItWorksPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HowItWorksClient />;
}
