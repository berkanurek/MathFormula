import { TermsPageClient } from "./TermsPageClient";
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
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TermsPageClient />;
}
