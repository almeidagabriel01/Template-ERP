"use client";

import React from "react";
import {
  useLandingPage,
  LandingNavbar,
  LandingHeroFrames,
  LandingShowcase,
  LandingModules,
  LandingFeatures,
  LandingPricing,
  LandingCTA,
  LandingFooter,
} from "@/components/landing";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

export default function LandingPage() {
  const {
    isCheckingAuth,
    isRedirecting,
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    isLoadingPlans,
    handleSignOut,
  } = useLandingPage();

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      const tId = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 500);
      return () => clearTimeout(tId);
    }
  }, [isCheckingAuth, isRedirecting]);

  if (isRedirecting || isCheckingAuth) {
    return (
      <FullPageLoading
        message={isRedirecting ? "Entrando..." : "Verificando sessão..."}
        description={
          isRedirecting
            ? "Redirecionando para sua conta"
            : "Conectando à sua conta"
        }
      />
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar currentUser={currentUser} onSignOut={handleSignOut} />

      <main>
        <LandingHeroFrames />
        <LandingShowcase />
        <LandingModules />
        <LandingFeatures />

        <div className="mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-black/15 to-transparent dark:via-white/15" />

        <LandingPricing
          plans={plans}
          currentUser={currentUser}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
          isLoading={isLoadingPlans}
        />

        <div className="mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-black/15 to-transparent dark:via-white/15" />

        <LandingCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
