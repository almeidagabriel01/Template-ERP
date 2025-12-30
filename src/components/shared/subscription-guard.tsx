"use client";

import * as React from "react";
import { useAuth, SubscriptionStatus } from "@/providers/auth-provider";
import { AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StripeService } from "@/services/stripe-service";
import { useRouter } from "next/navigation";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  const shouldCheckSubscription = React.useMemo(() => {
    if (!user) return false;
    if (user.role === "free" || user.role === "superadmin") return false;
    if (user.masterId) return false;
    return true;
  }, [user]);

  const subscriptionStatus = user?.subscriptionStatus;

  React.useEffect(() => {
    if (!shouldCheckSubscription || isLoading) return;

    const blockedStatuses: SubscriptionStatus[] = [
      "CANCELED",
      "PAYMENT_FAILED",
      "INACTIVE",
    ];

    if (subscriptionStatus && blockedStatuses.includes(subscriptionStatus)) {
      router.push("/subscription-blocked");
    }
  }, [subscriptionStatus, shouldCheckSubscription, isLoading, router]);

  const showWarningBanner =
    shouldCheckSubscription && subscriptionStatus === "PAST_DUE";

  const handleManageBilling = async () => {
    if (!user) return;
    setIsRedirecting(true);
    try {
      const result = await StripeService.createPortalSession({
        userId: user.id,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Error opening billing portal:", error);
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return <>{children}</>;
  }

  return (
    <>
      {showWarningBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-yellow-50 dark:bg-yellow-950/90 border border-yellow-400 dark:border-yellow-600 rounded-xl shadow-lg p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="shrink-0 p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  Pagamento Pendente
                </h4>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Sua assinatura está com pagamento atrasado. Atualize para
                  evitar a perda de acesso.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={isRedirecting}
                  className="mt-3 h-8 text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
                >
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  {isRedirecting ? "Abrindo..." : "Atualizar Pagamento"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
