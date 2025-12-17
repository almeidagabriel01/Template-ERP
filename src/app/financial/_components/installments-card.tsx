"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { Transaction } from "@/services/transaction-service";

interface InstallmentsCardProps {
  installments: Transaction[];
  currentTransactionId: string;
}

export function InstallmentsCard({
  installments,
  currentTransactionId,
}: InstallmentsCardProps) {
  if (installments.length <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Parcelas ({installments.length}x)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {installments.map((installment) => (
            <Link
              key={installment.id}
              href={`/financial/${installment.id}`}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                installment.id === currentTransactionId
                  ? "bg-primary/10 border-primary"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-medium ${
                    installment.id === currentTransactionId
                      ? "text-primary"
                      : ""
                  }`}
                >
                  Parcela {installment.installmentNumber}/
                  {installment.installmentCount}
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(installment.date).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    installment.status === "paid"
                      ? "success"
                      : installment.status === "overdue"
                        ? "destructive"
                        : "warning"
                  }
                  className="text-xs"
                >
                  {installment.status === "paid"
                    ? "Pago"
                    : installment.status === "overdue"
                      ? "Atrasado"
                      : "Pendente"}
                </Badge>
                {installment.id === currentTransactionId && (
                  <Badge variant="outline" className="text-xs">
                    Editando
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
