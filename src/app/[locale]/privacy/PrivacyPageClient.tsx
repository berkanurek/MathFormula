"use client";

import { LegalLayoutClient } from "@/components/legal/LegalLayoutClient";
import { useTranslations } from "next-intl";

export function PrivacyPageClient() {
  const t = useTranslations("legal.privacy");

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
              {t("introductionTitle")}
            </h2>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("introductionBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("dataCollectionTitle")}
            </h2>
            <ul className="list-disc space-y-2 pl-5 font-body-md text-body-md leading-relaxed">
              <li>{t("dataCollectionItem1")}</li>
              <li>{t("dataCollectionItem2")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("imageProcessingTitle")}
            </h2>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("imageProcessingLead")}{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {t("imageProcessingEmphasis")}
              </strong>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("dataSecurityTitle")}
            </h2>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("dataSecurityBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-h2 text-h2 text-slate-900 dark:text-slate-100">
              {t("thirdPartyTitle")}
            </h2>
            <p className="font-body-md text-body-md leading-relaxed">
              {t("thirdPartyBody")}
            </p>
          </section>
        </article>
      </main>
    </LegalLayoutClient>
  );
}
