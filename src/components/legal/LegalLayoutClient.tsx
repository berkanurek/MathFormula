"use client";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Toast } from "@/components/Toast";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export function LegalLayoutClient({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    toast,
    showToast,
    handleSignIn,
    handleSignUp,
    handleSignOut,
  } = useSupabaseSession();

  return (
    <div className="flex min-h-[100dvh] flex-col font-body-md text-body-md">
      <Header
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onSignOut={handleSignOut}
        onToast={showToast}
      />
      {children}
      <Toast open={toast.open} tone={toast.tone} message={toast.message} />
      <Footer />
    </div>
  );
}
