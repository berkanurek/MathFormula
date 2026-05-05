"use client";

import { LegalLayoutClient } from "@/components/legal/LegalLayoutClient";
import { useTranslations } from "next-intl";

export function TermsPageClient() {
  const t = useTranslations("legal.terms");

  return (
    <LegalLayoutClient>
      <main className="mx-auto w-full max-w-[800px] flex-1 px-4 py-10 md:px-6 md:py-14">
        <p className="mb-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("lastUpdated")}
        </p>
        <article className="space-y-10 text-slate-700 dark:text-slate-300">
          <h1 className="font-h1 text-balance text-h1 text-slate-900 dark:text-slate-100">
            {t("title")}
          </h1>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("acceptanceTitle")}
            </h2>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("acceptanceBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("accuracyTitle")}
            </h2>
            <p className="font-body-md text-body-md font-medium leading-relaxed text-slate-800 dark:text-slate-200">
              {t("accuracyLead")}
            </p>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("accuracyBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("userConductTitle")}
            </h2>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("userConductIntro")}
            </p>
            <ul className="list-disc space-y-2 pl-5 font-body-md text-body-md leading-relaxed">
              <li>{t("userConductItem1")}</li>
              <li>{t("userConductItem2")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("liabilityTitle")}
            </h2>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("liabilityBody")}
            </p>
          </section>
        </article>
      </main>
    </LegalLayoutClient>
  );
}
