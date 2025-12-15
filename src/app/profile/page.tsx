"use client";

import * as React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    User as UserIcon,
    Mail,
    Building2,
    Shield,
    Crown,
    Zap,
    Building,
    Check,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { PlanService } from "@/services/plan-service";
import { UserPlan } from "@/types";
import { cn } from "@/lib/utils";

const tierIcons: Record<string, React.ElementType> = {
    starter: Zap,
    pro: Crown,
    enterprise: Building,
};

const tierColors: Record<string, string> = {
    starter: "from-blue-500 to-blue-600",
    pro: "from-emerald-500 to-teal-600",
    enterprise: "from-purple-500 to-purple-600",
};

export default function ProfilePage() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const [userPlan, setUserPlan] = React.useState<UserPlan | null>(null);
    const [allPlans, setAllPlans] = React.useState<UserPlan[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const loadPlans = async () => {
            try {
                const plans = await PlanService.getPlans();
                setAllPlans(plans);

                if (user?.planId) {
                    const plan = await PlanService.getPlanById(user.planId);
                    setUserPlan(plan);
                } else {
                    // Default to starter plan if no plan is set
                    const starterPlan = plans.find((p) => p.tier === "starter");
                    setUserPlan(starterPlan || plans[0] || null);
                }
            } catch (error) {
                console.error("Error loading plans:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPlans();
    }, [user?.planId]);

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "superadmin":
                return "Super Admin";
            case "admin":
                return "Administrador";
            case "user":
                return "Usuário";
            default:
                return role;
        }
    };

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case "superadmin":
                return "destructive";
            case "admin":
                return "default";
            default:
                return "outline";
        }
    };

    const formatPrice = (price: number) => {
        if (price === 0) return "Grátis";
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(price);
    };

    const formatLimit = (value: number) => {
        return value === -1 ? "Ilimitado" : value.toString();
    };

    const isCurrentPlan = (plan: UserPlan) => {
        return (
            userPlan?.id === plan.id ||
            (!userPlan && plan.tier === "starter") ||
            userPlan?.tier === plan.tier
        );
    };

    const upgradePlans = allPlans.filter(
        (p) => (userPlan ? p.order > userPlan.order : p.tier !== "starter")
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
                <p className="text-muted-foreground mt-1">
                    Visualize e gerencie suas informações pessoais
                </p>
            </div>

            {/* Profile Card */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center shrink-0">
                            <UserIcon className="w-10 h-10 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-2xl">
                                        {user?.name || "Usuário"}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-2 mt-1">
                                        <Mail className="w-4 h-4" />
                                        {user?.email || "email@exemplo.com"}
                                    </CardDescription>
                                </div>
                                {tenant && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                                        <Building2 className="w-4 h-4" />
                                        <span className="font-medium text-foreground">{tenant.name}</span>
                                        <span>•</span>
                                        <span className="capitalize">{tenant.niche?.replace(/_/g, " ")}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 mt-3">
                                <Badge
                                    variant={
                                        getRoleBadgeVariant(user?.role || "user") as
                                        | "default"
                                        | "outline"
                                        | "destructive"
                                    }
                                >
                                    <Shield className="w-3 h-3 mr-1" />
                                    {getRoleLabel(user?.role || "user")}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Plans Section - Current + Upgrades */}
            {!isLoading && allPlans.length > 0 && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-xl font-semibold">Meu Plano</h2>
                        <p className="text-muted-foreground text-sm">
                            Compare seu plano atual com as opções de upgrade
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        {allPlans.map((plan) => {
                            const Icon = tierIcons[plan.tier];
                            const isCurrent = isCurrentPlan(plan);
                            const canUpgrade = userPlan ? plan.order > userPlan.order : plan.tier !== "starter";

                            return (
                                <Card
                                    key={plan.id}
                                    className={cn(
                                        "relative overflow-hidden transition-all duration-300 flex flex-col",
                                        isCurrent && "ring-2 ring-primary shadow-lg",
                                        !isCurrent && "hover:shadow-lg hover:scale-[1.02]",
                                        plan.highlighted && !isCurrent && "ring-2 ring-emerald-500/50"
                                    )}
                                >
                                    {/* Current Plan Badge */}
                                    {isCurrent && (
                                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-center py-1 text-xs font-semibold">
                                            Plano Atual
                                        </div>
                                    )}

                                    {/* Popular Badge (only if not current) */}
                                    {plan.highlighted && !isCurrent && (
                                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-center py-1 text-xs font-semibold">
                                            Mais Popular
                                        </div>
                                    )}

                                    <CardHeader className={cn("text-center pb-2", (isCurrent || plan.highlighted) && "pt-8")}>
                                        <div
                                            className={cn(
                                                "h-12 w-12 mx-auto rounded-xl bg-gradient-to-br flex items-center justify-center mb-2",
                                                tierColors[plan.tier]
                                            )}
                                        >
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                                        <CardDescription className="text-xs min-h-[32px]">
                                            {plan.description}
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4 pt-0 flex-1">
                                        {/* Price */}
                                        <div className="text-center">
                                            <span className="text-2xl font-bold">
                                                {formatPrice(plan.price)}
                                            </span>
                                            {plan.price > 0 && (
                                                <span className="text-muted-foreground text-sm">/mês</span>
                                            )}
                                        </div>

                                        {/* Features */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Propostas</span>
                                                <span className="font-medium">
                                                    {formatLimit(plan.features.maxProposals)}
                                                    {plan.features.maxProposals > 0 && "/mês"}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Clientes</span>
                                                <span className="font-medium">
                                                    {formatLimit(plan.features.maxClients)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Usuários</span>
                                                <span className="font-medium">
                                                    {formatLimit(plan.features.maxUsers)}
                                                </span>
                                            </div>

                                            {/* Boolean features */}
                                            <div className="pt-2 border-t space-y-1">
                                                {plan.features.customBranding && (
                                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                        <Check className="w-3 h-3" />
                                                        <span>Branding</span>
                                                    </div>
                                                )}
                                                {plan.features.prioritySupport && (
                                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                        <Check className="w-3 h-3" />
                                                        <span>Suporte prioritário</span>
                                                    </div>
                                                )}
                                                {plan.features.apiAccess && (
                                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                        <Check className="w-3 h-3" />
                                                        <span>API</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>

                                    <div className="p-4 pt-0 mt-auto">
                                        {isCurrent ? (
                                            <Button className="w-full" size="sm" variant="secondary" disabled>
                                                Plano Atual
                                            </Button>
                                        ) : canUpgrade ? (
                                            <Button className="w-full" size="sm">
                                                Fazer Upgrade
                                            </Button>
                                        ) : (
                                            <Button className="w-full" size="sm" variant="outline" disabled>
                                                Plano Inferior
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
