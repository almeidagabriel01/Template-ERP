"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/utils/format";

interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  pendingIncome: number;
  pendingExpense: number;
}

interface FinancialMetricCardsProps {
  financialSummary: FinancialSummary;
  balance: number;
}

export function FinancialMetricCards({
  financialSummary,
  balance,
}: FinancialMetricCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        className={
          balance >= 0 ? "border-emerald-500/30" : "border-rose-500/30"
        }
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
          <Wallet
            className={`h-4 w-4 ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
          >
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground">
            Receitas - Despesas pagas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receitas</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">
            {formatCurrency(financialSummary.totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground">Total recebido</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Despesas</CardTitle>
          <TrendingDown className="h-4 w-4 text-rose-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-500">
            {formatCurrency(financialSummary.totalExpense)}
          </div>
          <p className="text-xs text-muted-foreground">Total pago</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendências</CardTitle>
          <Clock className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-500">
            {formatCurrency(
              financialSummary.pendingIncome + financialSummary.pendingExpense
            )}
          </div>
          <p className="text-xs text-muted-foreground">A receber + A pagar</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface AlertsCardProps {
  overdueCount: number;
  upcomingDueCount: number;
}

export function AlertsCard({
  overdueCount,
  upcomingDueCount,
}: AlertsCardProps) {
  if (overdueCount === 0 && upcomingDueCount === 0) return null;

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-500">
          <AlertCircle className="w-4 h-4" />
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {overdueCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" />
            {overdueCount} pagamento(s) atrasado(s)
          </Badge>
        )}
        {upcomingDueCount > 0 && (
          <Badge variant="warning" className="gap-1">
            <Clock className="w-3 h-3" />
            {upcomingDueCount} vencendo em 7 dias
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
