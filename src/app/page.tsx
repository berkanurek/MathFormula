import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/** Fallback when locale middleware does not run (e.g. missing env during local dev). */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
