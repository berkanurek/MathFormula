import { MyLibraryDashboard } from "@/components/MyLibraryDashboard";
import { routing } from "@/i18n/routing";
import { listUserFormulas } from "@/lib/repositories/userFormulas";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
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
  const t = await getTranslations({ locale, namespace: "myLibraryPage.meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function MyLibraryPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/", locale });
    throw new Error("Unauthenticated");
  }
  const userId = user.id;

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tLoad = await getTranslations({
    locale,
    namespace: "myLibraryPage",
  });

  let mappedFormulas: Array<{
    id: string;
    title: string;
    latexCode: string;
    createdAt: string;
  }> = [];
  let loadErrorMessage: string | null = null;

  try {
    const formulas = await listUserFormulas(userId);
    const safeFormulas = Array.isArray(formulas) ? formulas : [];
    mappedFormulas = safeFormulas.map((item) => ({
      id: String(item.id),
      title: String(item.title ?? tCommon("untitledFormula")),
      latexCode: String(item.latex_code ?? ""),
      createdAt: String(item.created_at ?? new Date(0).toISOString()),
    }));
  } catch (error) {
    console.error("Failed to load My Library formulas:", error);
    loadErrorMessage =
      error instanceof Error ? error.message : tLoad("loadErrorFallback");
  }

  return (
    <MyLibraryDashboard
      currentUserId={userId}
      initialFormulas={mappedFormulas}
      loadErrorMessage={loadErrorMessage}
    />
  );
}
