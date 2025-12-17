"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { Transaction } from "@/services/transaction-service";
import { Proposal } from "@/services/proposal-service";
import { formatCurrency, formatDateShort } from "@/utils/format";

interface RecentTransactionsListProps {
  transactions: Transaction[];
}

export function RecentTransactionsList({
  transactions,
}: RecentTransactionsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Últimas Transações</CardTitle>
          <CardDescription>5 lançamentos mais recentes</CardDescription>
        </div>
        <Link href="/financial">
          <Button variant="ghost" size="sm" className="gap-1">
            Ver todos <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhuma transação ainda
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-full ${t.type === "income" ? "bg-emerald-500/10" : "bg-rose-500/10"}`}
                  >
                    {t.type === "income" ? (
                      <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[150px]">
                      {t.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(t.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-medium ${t.type === "income" ? "text-emerald-500" : "text-rose-500"}`}
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RecentProposalsListProps {
  proposals: Proposal[];
}

export function RecentProposalsList({ proposals }: RecentProposalsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Últimas Propostas</CardTitle>
          <CardDescription>5 propostas mais recentes</CardDescription>
        </div>
        <Link href="/proposals">
          <Button variant="ghost" size="sm" className="gap-1">
            Ver todas <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {proposals.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhuma proposta ainda
          </p>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-full bg-primary/10">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[150px]">
                      {p.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(p.createdAt)}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    p.status === "approved"
                      ? "success"
                      : p.status === "rejected"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {p.status === "approved"
                    ? "Aprovada"
                    : p.status === "rejected"
                      ? "Recusada"
                      : "Pendente"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
