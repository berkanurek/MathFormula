"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

type Props = {
  children: React.ReactNode;
};

export function PostHogProvider({ children }: Props) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key || !host) return;

    posthog.init(key, {
      api_host: host,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: "identified_only",
      session_recording: {
        maskAllInputs: true,
      },
    });
  }, []);

  return children;
}
