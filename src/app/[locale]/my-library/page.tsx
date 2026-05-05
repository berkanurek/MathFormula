import { MyLibraryDashboard } from "@/components/MyLibraryDashboard";
import { routing } from "@/i18n/routing";
import { fetchFolders, fetchSavedFormulas } from "@/lib/repositories/library";
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

  let mappedFolders: Array<{
    id: string;
    name: string;
    createdAt: string;
  }> = [];
  let mappedFormulas: Array<{
    id: string;
    content: string;
    folderId: string | null;
    isFavorite: boolean;
    createdAt: string;
  }> = [];
  let loadErrorMessage: string | null = null;

  try {
    const [folders, formulas] = await Promise.all([
      fetchFolders(userId),
      fetchSavedFormulas({ userId }),
    ]);
    mappedFolders = (Array.isArray(folders) ? folders : []).map((item) => ({
      id: String(item.id),
      name: String(item.name ?? "Untitled Folder"),
      createdAt: String(item.created_at ?? new Date(0).toISOString()),
    }));
    mappedFormulas = (Array.isArray(formulas) ? formulas : []).map((item) => ({
      id: String(item.id),
      content: String(item.content ?? tCommon("untitledFormula")),
      folderId: item.folder_id ? String(item.folder_id) : null,
      isFavorite: Boolean(item.is_favorite),
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
      initialFolders={mappedFolders}
      initialFormulas={mappedFormulas}
      loadErrorMessage={loadErrorMessage}
    />
  );
}
