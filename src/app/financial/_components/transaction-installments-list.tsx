"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { formatCurrency } from "@/utils/format";
import { statusConfig } from "../_constants/config";
import {
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Edit2,
} from "lucide-react";
import { toast } from "react-toastify";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";

interface TransactionInstallmentsListProps {
  installments: Transaction[];
  onStatusChange: (
    transaction: Transaction,
    newStatus: TransactionStatus,
    updateAll?: boolean
  ) => Promise<boolean>;
  onUpdate?: (
    transaction: Transaction,
    data: Partial<Transaction>
  ) => Promise<boolean>;
  canEdit: boolean;
}

const statusOptions: {
  value: TransactionStatus;
  label: string;
  icon: typeof Check;
}[] = [
  { value: "paid", label: "Pago", icon: Check },
  { value: "pending", label: "Pendente", icon: Clock },
  { value: "overdue", label: "Atrasado", icon: AlertTriangle },
];

export function TransactionInstallmentsList({
  installments,
  onStatusChange,
  onUpdate,
  canEdit,
}: TransactionInstallmentsListProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<number>(0);
  const [isSaving, setIsSaving] = React.useState(false);

  // Sort installments by number just in case
  const sortedInstallments = React.useMemo(() => {
    return [...installments].sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0)
    );
  }, [installments]);

  const handleStatusChange = async (
    transaction: Transaction,
    newStatus: TransactionStatus
  ) => {
    if (transaction.status === newStatus) return;

    // Validation Logic
    if (newStatus === "paid") {
      // Check if previous installment is paid
      const currentNumber = transaction.installmentNumber || 1;
      if (currentNumber > 1) {
        const prevInstallment = sortedInstallments.find(
          (t) => t.installmentNumber === currentNumber - 1
        );
        if (prevInstallment && prevInstallment.status !== "paid") {
          toast.warning(
            `A parcela ${currentNumber - 1} precisa estar paga antes de pagar a parcela ${currentNumber}.`
          );
          return;
        }
      }
    }

    setUpdatingId(transaction.id);
    await onStatusChange(transaction, newStatus, false); // Single update
    setUpdatingId(null);
  };

  const handleEditClick = (installment: Transaction, e: React.MouseEvent) => {
    if (!canEdit || !onUpdate) return;
    e.stopPropagation();
    setEditingId(installment.id);
    setEditValue(installment.amount);
  };

  const handleEditSave = async (installment: Transaction) => {
    if (!onUpdate) return;

    if (Math.abs(editValue - installment.amount) < 0.01) {
      setEditingId(null);
      return;
    }

    if (editValue <= 0) {
      toast.warning("O valor deve ser maior que zero");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(installment, { amount: editValue });
      setEditingId(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, installment: Transaction) => {
    if (e.key === "Enter") {
      handleEditSave(installment);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";

    // Extract date part if ISO format
    const datePart = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    // Parse date parts manually to avoid timezone issues
    const parts = datePart.split("-").map(Number);
    if (parts.length !== 3) return dateString;

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="border-t bg-muted/30 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        Parcelas do Lançamento
      </h4>
      <div className="grid gap-2">
        {sortedInstallments.map((installment) => {
          const statusInfo = statusConfig[installment.status];
          const isUpdating = updatingId === installment.id;

          return (
            <div
              key={installment.id}
              className="flex items-center justify-between p-3 rounded-md bg-background border text-sm hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 font-medium text-muted-foreground">
                  {installment.installmentNumber}ª Parcela
                </div>
                <div className="text-muted-foreground">
                  {formatDate(installment.dueDate || installment.date)}
                </div>

                <div className="font-semibold w-32 text-right">
                  {editingId === installment.id ? (
                    <div className="relative">
                      <CurrencyInput
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        onKeyDown={(e) => handleKeyDown(e, installment)}
                        autoFocus
                        disabled={isSaving}
                        className="h-8 py-1 pr-2 pl-2 w-full text-right font-semibold text-sm bg-background border-primary"
                        onBlur={() => handleEditSave(installment)}
                      />
                      {isSaving && (
                        <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="transition-colors rounded px-2 py-1 -mr-2 flex items-center justify-end">
                      {formatCurrency(installment.amount)}
                      {canEdit && onUpdate && (
                        <button
                          onClick={(e) => handleEditClick(installment, e)}
                          className="ml-1 p-1 hover:bg-muted rounded-full transition-colors group/edit flex items-center justify-center cursor-pointer"
                          title="Clique para editar o valor"
                        >
                          <Edit2 className="w-3 h-3 opacity-50 group-hover/edit:opacity-100" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="focus:outline-none cursor-pointer"
                        disabled={isUpdating}
                      >
                        <Badge
                          variant={statusInfo.variant}
                          className="text-xs cursor-pointer hover:brightness-110 transition-all gap-1 pr-1.5 min-w-[90px] justify-center"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          {statusInfo.label}
                          <ChevronDown className="w-3 h-3 opacity-60 ml-1" />
                        </Badge>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      {statusOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = installment.status === option.value;
                        return (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() =>
                              handleStatusChange(installment, option.value)
                            }
                            className={isActive ? "bg-muted" : ""}
                          >
                            <Icon className="w-4 h-4 mr-2" />
                            {option.label}
                            {isActive && <Check className="w-4 h-4 ml-auto" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Badge variant={statusInfo.variant} className="text-xs">
                    {statusInfo.label}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
