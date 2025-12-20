"use client";

import React from "react";

import {
  useLandingPage,
  LandingNavbar,
  LandingHero,
  LandingFeatures,
  LandingPricing,
  LandingCTA,
  LandingFooter,
  LandingFAQ,
} from "@/components/landing";

export default function LandingPage() {
  const {
    isCheckingAuth,
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    handleSignOut,
  } = useLandingPage();

  // Render page directly - navbar handles loading state for user profile
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar currentUser={currentUser} onSignOut={handleSignOut} />

      <LandingHero />

      <LandingFeatures />

      <LandingPricing
        plans={plans}
        billingInterval={billingInterval}
        setBillingInterval={setBillingInterval}
      />

      <LandingFAQ />

      <LandingCTA />

      <LandingFooter />
    </div>
  );
}
