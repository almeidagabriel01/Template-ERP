"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Edit, Eye, Check, ChevronDown, Banknote, CreditCard, FileText, Edit2, Split, DollarSign, Share2, RefreshCw } from "lucide-react";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { typeConfig, statusConfig } from "../_constants/config";
import { formatCurrency } from "@/utils/format";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TransactionInstallmentsList } from "./transaction-installments-list";
import { useTransactionCard } from "../_hooks/useTransactionCard";
import { EditBlockDialog } from "./edit-block-dialog";
import { PartialPaymentDialog } from "./partial-payment-dialog";
import { ExtraCostDialog } from "./extra-cost-dialog";
import { ShareLinkModal } from "./share-link-modal";
import { Wallet } from "@/types";
import { Loader } from "@/components/ui/loader";

interface TransactionCardProps {
  transaction: Transaction;
  relatedInstallments?: Transaction[];
  proposalGroupTransactions?: Transaction[]; // Down payment + installments from same proposal
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (transaction: Transaction) => void;
  onStatusChange?: (
    transaction: Transaction,
    newStatus: TransactionStatus,
    updateAll?: boolean,
  ) => Promise<boolean>;
  onUpdate?: (
    transaction: Transaction,
    data: Partial<Transaction>,
  ) => Promise<boolean>;
  onUpdateBatch?: (
    updates: { id: string; data: Partial<Transaction> }[],
  ) => Promise<boolean>;
  onRegisterPartialPayment?: (
    originalTransaction: Transaction,
    amount: number,
    date: string,
  ) => Promise<void>;
  onUpdateExtraCostStatus?: (
    parentTxId: string,
    ecId: string,
    newStatus: TransactionStatus,
  ) => Promise<boolean>;
  onReload?: () => Promise<void>;
  defaultExpanded?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onToggleGroupSelection?: (transaction: Transaction) => void;
  selectedIds?: Set<string>;
  // Controlled expansion props
  isExpanded?: boolean;
  onToggleExpand?: (collapsed: boolean) => void;
  wallets?: Wallet[];
}

type DisplayExtraCost = NonNullable<Transaction["extraCosts"]>[number] & {
  parentTransactionId: string;
};

export function TransactionCard({
  transaction,
  relatedInstallments = [],
  proposalGroupTransactions = [],
  canEdit,
  canDelete,
  onDelete,
  onStatusChange,
  onUpdate,
  onUpdateBatch,
  onRegisterPartialPayment,
  onUpdateExtraCostStatus,
  onReload,
  defaultExpanded = false,
  isSelected = false,
  onToggleSelection,
  onToggleGroupSelection,
  selectedIds,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
  wallets = [],
}: TransactionCardProps) {
  const {
    isUpdating,
    updatingIds,
    extraCostToDelete,
    setExtraCostToDelete,
    showEditBlockDialog,
    setShowEditBlockDialog,
    isEditingAmount,
    setIsEditingAmount,
    editAmountValue,
    setEditAmountValue,
    isSavingAmount,
    showExtraCostDialog,
    setShowExtraCostDialog,
    editingExtraCost,
    setEditingExtraCost,
    showPartialPaymentDialog,
    setShowPartialPaymentDialog,
    partialPaymentTransaction,
    shareModalOpen,
    setShareModalOpen,
    typeInfo,
    TypeIcon,
    statusInfo,
    isProposalLinked,
    isProposalGroup,
    downPayment,
    installments,
    saldoTx,
    visibleExtraCosts,
    displayDescription,
    displayAmount,
    installmentStatusCounts,
    displayWallet,
    hasExpandableContent,
    isExpanded,
    extraCostLabel,
    extraCostToDeleteParentId,
    extraCostToDeleteId,
    statusOptions,
    handleToggleExpand,
    handleShare,
    handleStatusChange,
    handleIndividualStatusChange,
    handleAmountClick,
    handleAmountSave,
    handleAmountKeyDown,
    handlePartialPayment,
    handleUndoPartial,
    processPartialPayment,
    processExtraCost,
    handleExtraCostStatusChange,
    handleDeleteExtraCost,
    formatDate,
  } = useTransactionCard({
    transaction,
    relatedInstallments,
    proposalGroupTransactions,
    canEdit,
    wallets,
    onUpdate,
    onUpdateBatch,
    onStatusChange,
    onDelete,
    onRegisterPartialPayment,
    onUpdateExtraCostStatus,
    onReload,
    defaultExpanded,
    controlledIsExpanded,
    onToggleExpand,
  });

  return (
    <div
      className="group"
      data-testid="transaction-card"
      data-transaction-id={transaction.id}
    >
      <Card
        className={`transition-all duration-200 ${
          isExpanded ? "ring-2 ring-primary/20 shadow-md" : "hover:bg-muted/50"
        }`}
      >
        <CardContent className="p-0">
          <div
            className="flex items-center gap-4 py-4 px-4 cursor-pointer"
            onClick={(e) => {
              // Ignore click if it came from a button or interactable element
              const target = e.target as HTMLElement;
              if (
                target.closest("button") ||
                target.closest("a") ||
                target.closest('[role="checkbox"]') ||
                !hasExpandableContent
              ) {
                return;
              }
              handleToggleExpand();
            }}
          >
            {/* Selection Checkbox - use group selection for the main card */}
            {(onToggleGroupSelection || onToggleSelection) && (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => {
                    if (onToggleGroupSelection) {
                      onToggleGroupSelection(transaction);
                    } else if (onToggleSelection) {
                      onToggleSelection(transaction.id);
                    }
                  }}
                  className="cursor-pointer"
                />
              </div>
            )}

            <div className={`p-2 rounded-full bg-muted ${typeInfo.color}`}>
              <TypeIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {displayDescription}
                </span>
                {isProposalLinked && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileText className="w-3 h-3" />
                    Proposta
                  </Badge>
                )}
                {transaction.category && !isProposalGroup && (
                  <Badge variant="outline" className="text-xs">
                    {transaction.category}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>
                  {formatDate(transaction.date || transaction.dueDate || "")}
                </span>
                {displayWallet && (
                  <>
                    <span>•</span>
                    <span>{displayWallet}</span>
                  </>
                )}
                {/* Show proposal group summary */}
                {isProposalGroup && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      {downPayment && (
                        <span className="text-blue-500 font-medium flex items-center gap-1">
                          <Banknote className="w-3 h-3" />
                          Entrada
                        </span>
                      )}
                      {installments.length > 0 && (
                        <span className="text-primary font-medium flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {installmentStatusCounts ? (
                            <>
                              {installmentStatusCounts.paid}/
                              {installmentStatusCounts.total}x
                            </>
                          ) : (
                            <>{installments.length}x</>
                          )}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {/* Show installment info for standalone installments - UPDATED per user request */}
                {!isProposalGroup && transaction.isInstallment && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-medium">
                        {installmentStatusCounts ? (
                          <>
                            {installmentStatusCounts.paid}/
                            {installmentStatusCounts.total}x
                          </>
                        ) : (
                          <>
                            {transaction.installmentNumber}/
                            {transaction.installmentCount}x
                          </>
                        )}
                      </span>
                      {/* Mini Progress Bar */}
                      <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full ${typeInfo.color.replace("text-", "bg-")}`}
                          style={{
                            width: installmentStatusCounts
                              ? `${Math.min((installmentStatusCounts.paid / installmentStatusCounts.total) * 100, 100)}%`
                              : `${Math.min(((transaction.installmentNumber || 1) / (transaction.installmentCount || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Show recurring info for standalone recurring items */}
                {!isProposalGroup &&
                  transaction.isRecurring &&
                  relatedInstallments.length === 0 && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Recorrente (
                          {transaction.installmentInterval === 1
                            ? "Mensal"
                            : transaction.installmentInterval === 2
                              ? "Bimestral"
                              : transaction.installmentInterval === 3
                                ? "Trimestral"
                                : transaction.installmentInterval === 6
                                  ? "Semestral"
                                  : transaction.installmentInterval === 12
                                    ? "Anual"
                                    : `${transaction.installmentInterval || 1} Meses`}
                          )
                        </span>
                      </div>
                    </>
                  )}
                {/* Manual Installment Group Badges */}
                {!isProposalGroup &&
                  relatedInstallments.length > 0 &&
                  !transaction.isInstallment &&
                  !transaction.isRecurring && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-2">
                        {/* Show Down Payment Badge if present */}
                        {relatedInstallments.some((t) => t.isDownPayment) && (
                          <span className="text-blue-500 font-medium flex items-center gap-1">
                            <Banknote className="w-3 h-3" />
                            Entrada
                          </span>
                        )}

                        {/* Show Installment Count Badge only when there are real installments */}
                        {installmentStatusCounts && (
                          <span className="text-primary font-medium flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            {installmentStatusCounts.paid}/
                            {installmentStatusCounts.total}x
                          </span>
                        )}
                      </div>
                    </>
                  )}

                {/* Manual Recurring Group Badges */}
                {!isProposalGroup &&
                  relatedInstallments.length > 0 &&
                  transaction.isRecurring && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-2">
                        {/* Show Down Payment Badge if present */}
                        {relatedInstallments.some((t) => t.isDownPayment) && (
                          <span className="text-blue-500 font-medium flex items-center gap-1">
                            <Banknote className="w-3 h-3" />
                            Entrada
                          </span>
                        )}

                        {/* Show Recurring Badge */}
                        <span className="text-primary font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Recorrente (
                          {transaction.installmentInterval === 1
                            ? "Mensal"
                            : transaction.installmentInterval === 2
                              ? "Bimestral"
                              : transaction.installmentInterval === 3
                                ? "Trimestral"
                                : transaction.installmentInterval === 6
                                  ? "Semestral"
                                  : transaction.installmentInterval === 12
                                    ? "Anual"
                                    : `${transaction.installmentInterval || 1} Meses`}
                          )
                        </span>
                      </div>
                    </>
                  )}
                {/* Manual Installment Group Badges - Down Payment ONLY (if main is installment) */}
                {!isProposalGroup &&
                  relatedInstallments.length > 0 &&
                  transaction.isInstallment &&
                  relatedInstallments.some((t) => t.isDownPayment) && (
                    <>
                      <span>•</span>
                      <span className="text-blue-500 font-medium flex items-center gap-1">
                        <Banknote className="w-3 h-3" />
                        Entrada
                      </span>
                    </>
                  )}
                {transaction.clientName && (
                  <>
                    <span>•</span>
                    <span>{transaction.clientName}</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right flex items-center gap-4">
              <div>
                <div className={`font-bold ${typeInfo.color}`}>
                  {isEditingAmount ? (
                    <div
                      className="relative flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CurrencyInput
                        value={editAmountValue}
                        onChange={(e) =>
                          setEditAmountValue(Number(e.target.value))
                        }
                        onKeyDown={handleAmountKeyDown}
                        // Focus on mount logic would need a ref, but primitive autoFocus often works
                        autoFocus
                        disabled={isSavingAmount}
                        className="h-8 py-1 pr-2 pl-8 w-32 text-right font-bold text-sm bg-background border-primary"
                        onBlur={handleAmountSave}
                      />
                      {isSavingAmount && (
                        <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                          <Loader size="sm" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 transition-colors rounded px-2 py-1 -mr-2">
                      <span>{transaction.type === "expense" ? "-" : "+"}</span>
                      <span>{formatCurrency(displayAmount)}</span>
                      {canEdit &&
                        !isProposalGroup &&
                        !transaction.proposalId &&
                        onUpdate && (
                          <button
                            onClick={handleAmountClick}
                            className="p-1 hover:bg-muted rounded-full transition-colors group/edit flex items-center justify-center ml-1 cursor-pointer"
                            title="Clique para editar o valor"
                          >
                            <Edit2 className="w-3 h-3 opacity-50 group-hover/edit:opacity-100" />
                          </button>
                        )}
                    </div>
                  )}
                </div>

                {/* Status Badge with Dropdown */}
                {onStatusChange && canEdit ? (
                  <div className="flex items-center gap-2 mt-1 w-full sm:w-auto justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isUpdating}
                          className="h-8 gap-2 rounded-lg font-medium transition-colors border hover:bg-opacity-80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isUpdating ? (
                            <>
                              <Loader size="sm" />
                              <span className="text-xs">Atualizando...</span>
                            </>
                          ) : (
                            <>
                              {(() => {
                                const option = statusOptions.find(
                                  (o) => o.value === transaction.status,
                                );
                                const Icon = option?.icon || Check;
                                return <Icon className="h-3.5 w-3.5" />;
                              })()}
                              <span className="text-xs">
                                {statusInfo.label}
                              </span>
                              <ChevronDown className="h-3 w-3 opacity-50" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        {isProposalGroup && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Marcar Todos
                            </div>
                            {statusOptions.map((option) => (
                              <DropdownMenuItem
                                key={`all-${option.id}`}
                                onClick={() => {
                                  handleStatusChange(option.id);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <option.icon className="h-4 w-4" />
                                <span>{option.label}</span>
                                {transaction.status === option.id && (
                                  <Check className="h-3 w-3 ml-auto opacity-50" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        {!isProposalGroup &&
                          statusOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.id}
                              onClick={() => {
                                handleStatusChange(option.id);
                              }}
                              className="gap-2 cursor-pointer"
                            >
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                              {transaction.status === option.id && (
                                <Check className="h-3 w-3 ml-auto opacity-50" />
                              )}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <Badge variant={statusInfo.variant} className="text-xs mt-1">
                    {statusInfo.label}
                  </Badge>
                )}
              </div>

              {/* Expand chevron — only when there is real content to show */}
              {hasExpandableContent && (
                <div
                  className={`transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-1 pl-2 border-l ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={handleShare}
                title="Compartilhar Link"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {canEdit && !transaction.proposalId && onUpdate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  onClick={() => setShowExtraCostDialog(true)}
                  title={`Adicionar ${extraCostLabel}`}
                >
                  <DollarSign className="w-4 h-4" />
                </Button>
              )}
              <Link href={`/transactions/${transaction.id}/view`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Visualizar"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </Link>
              {canEdit &&
                (transaction.proposalId ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Editar (Gerenciado pela Proposta)"
                    onClick={() => setShowEditBlockDialog(true)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                ) : (
                  <Link href={`/transactions/${transaction.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                ))}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(transaction)}
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {/* Expanded section for proposal groups */}
          {isExpanded && isProposalGroup && (
            <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
              {/* Down Payment Section */}
              {downPayment && (
                <div
                  data-testid="down-payment-row"
                  className={`flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg border border-blue-500/20 ${selectedIds?.has(downPayment.id) ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    {onToggleSelection && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds?.has(downPayment.id) || false}
                          onCheckedChange={() =>
                            onToggleSelection(downPayment.id)
                          }
                          className="cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="p-1.5 rounded-full bg-blue-500/20">
                      <Banknote className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Entrada</div>
                      <div className="text-xs text-muted-foreground">
                        Venc:{" "}
                        {formatDate(downPayment.dueDate || downPayment.date)}
                        {downPayment.wallet && ` • ${wallets.find(w => w.id === downPayment.wallet || w.name === downPayment.wallet)?.name ?? downPayment.wallet}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-blue-500">
                      {formatCurrency(downPayment.amount)}
                    </div>
                    {onStatusChange && canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 rounded-md text-xs font-medium border"
                            onClick={(e) => e.stopPropagation()}
                            disabled={updatingIds.has(downPayment.id)}
                          >
                            {updatingIds.has(downPayment.id) ? (
                              <>
                                <Loader size="sm" />
                                <span>Atualizando...</span>
                              </>
                            ) : (
                              <>
                                {(() => {
                                  const option = statusOptions.find(
                                    (o) => o.value === downPayment.status,
                                  );
                                  const Icon = option?.icon || Check;
                                  return <Icon className="h-3 w-3" />;
                                })()}
                                <span>
                                  {statusConfig[downPayment.status].label}
                                </span>
                                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[130px]">
                          {statusOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.id}
                              onClick={() =>
                                handleIndividualStatusChange(
                                  downPayment,
                                  option.id,
                                )
                              }
                              className="gap-2 cursor-pointer text-xs"
                            >
                              <option.icon className="h-3.5 w-3.5" />
                              <span>{option.label}</span>
                              {downPayment.status === option.id && (
                                <Check className="h-3 w-3 ml-auto opacity-50" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge
                        variant={statusConfig[downPayment.status].variant}
                        className="text-xs"
                      >
                        {statusConfig[downPayment.status].label}
                      </Badge>
                    )}
                    {/* Down Payment Edit Button */}
                    {canEdit &&
                      (downPayment.proposalId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary ml-1"
                          title="Editar (Gerenciado pela Proposta)"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEditBlockDialog(true);
                          }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Link href={`/transactions/${downPayment.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ml-1"
                            title="Editar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      ))}
                  </div>
                </div>
              )}

              {/* Installments Section */}
              {installments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Parcelas ({installments.length}x de{" "}
                      {formatCurrency(installments[0]?.amount || 0)})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {installments.map((inst) => (
                      <div
                        key={inst.id}
                        className={`flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border ${selectedIds?.has(inst.id) ? "ring-2 ring-primary" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          {onToggleSelection && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds?.has(inst.id) || false}
                                onCheckedChange={() =>
                                  onToggleSelection(inst.id)
                                }
                                className="cursor-pointer"
                              />
                            </div>
                          )}
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                              {inst.installmentNumber}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              Parcela {inst.installmentNumber}/
                              {inst.installmentCount}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Venc: {formatDate(inst.dueDate || inst.date)}
                              {inst.wallet && ` • ${wallets.find(w => w.id === inst.wallet || w.name === inst.wallet)?.name ?? inst.wallet}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-primary">
                            {formatCurrency(inst.amount)}
                          </div>
                          {onStatusChange && canEdit ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 rounded-md text-xs font-medium border"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={updatingIds.has(inst.id)}
                                >
                                  {updatingIds.has(inst.id) ? (
                                    <>
                                      <Loader size="sm" />
                                      <span>Atualizando...</span>
                                    </>
                                  ) : (
                                    <>
                                      {(() => {
                                        const option = statusOptions.find(
                                          (o) => o.value === inst.status,
                                        );
                                        const Icon = option?.icon || Check;
                                        return <Icon className="h-3 w-3" />;
                                      })()}
                                      <span>
                                        {statusConfig[inst.status].label}
                                      </span>
                                      <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                    </>
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-[130px]"
                              >
                                {statusOptions.map((option) => (
                                  <DropdownMenuItem
                                    key={option.id}
                                    onClick={() =>
                                      handleIndividualStatusChange(
                                        inst,
                                        option.id,
                                      )
                                    }
                                    className="gap-2 cursor-pointer text-xs"
                                  >
                                    <option.icon className="h-3.5 w-3.5" />
                                    <span>{option.label}</span>
                                    {inst.status === option.id && (
                                      <Check className="h-3 w-3 ml-auto opacity-50" />
                                    )}
                                  </DropdownMenuItem>
                                ))}
                                {inst.status === "pending" && (
                                  <DropdownMenuItem
                                    onClick={() => handlePartialPayment(inst)}
                                    className="gap-2 cursor-pointer text-xs border-t mt-1 pt-2"
                                  >
                                    <Split className="h-3.5 w-3.5" />
                                    <span>Parcial</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Badge
                              variant={statusConfig[inst.status].variant}
                              className="text-xs"
                            >
                              {statusConfig[inst.status].label}
                            </Badge>
                          )}
                          {/* Individual Installment Edit Button */}
                          {canEdit &&
                            (inst.proposalId ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary ml-1"
                                title="Editar (Gerenciado pela Proposta)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditBlockDialog(true);
                                }}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <Link href={`/transactions/${inst.id}`}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 ml-1"
                                  title="Editar"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Saldo Restante Section */}
              {saldoTx && !installments.length && (
                <div
                  data-testid="saldo-row"
                  className={`flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border ${selectedIds?.has(saldoTx.id) ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    {onToggleSelection && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds?.has(saldoTx.id) || false}
                          onCheckedChange={() =>
                            onToggleSelection(saldoTx.id)
                          }
                          className="cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="p-1.5 rounded-full bg-primary/10">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Saldo restante</div>
                      <div className="text-xs text-muted-foreground">
                        Venc:{" "}
                        {formatDate(saldoTx.dueDate || saldoTx.date)}
                        {saldoTx.wallet && ` • ${wallets.find(w => w.id === saldoTx.wallet || w.name === saldoTx.wallet)?.name ?? saldoTx.wallet}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-primary">
                      {formatCurrency(saldoTx.amount)}
                    </div>
                    {onStatusChange && canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 rounded-md text-xs font-medium border"
                            onClick={(e) => e.stopPropagation()}
                            disabled={updatingIds.has(saldoTx.id)}
                          >
                            {updatingIds.has(saldoTx.id) ? (
                              <>
                                <Loader size="sm" />
                                <span>Atualizando...</span>
                              </>
                            ) : (
                              <>
                                {(() => {
                                  const option = statusOptions.find(
                                    (o) => o.value === saldoTx.status,
                                  );
                                  const Icon = option?.icon || Check;
                                  return <Icon className="h-3 w-3" />;
                                })()}
                                <span>
                                  {statusConfig[saldoTx.status].label}
                                </span>
                                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[130px]">
                          {statusOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.id}
                              onClick={() =>
                                handleIndividualStatusChange(
                                  saldoTx,
                                  option.id,
                                )
                              }
                              className="gap-2 cursor-pointer text-xs"
                            >
                              <option.icon className="h-3.5 w-3.5" />
                              <span>{option.label}</span>
                              {saldoTx.status === option.id && (
                                <Check className="h-3 w-3 ml-auto opacity-50" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge
                        variant={statusConfig[saldoTx.status].variant}
                        className="text-xs"
                      >
                        {statusConfig[saldoTx.status].label}
                      </Badge>
                    )}
                    {canEdit &&
                      (saldoTx.proposalId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary ml-1"
                          title="Editar (Gerenciado pela Proposta)"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEditBlockDialog(true);
                          }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Link href={`/transactions/${saldoTx.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ml-1"
                            title="Editar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      ))}
                  </div>
                </div>
              )}

              {/* Extra Costs Section */}
              {visibleExtraCosts.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 px-1">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-500/80">
                      {transaction.type === "income"
                        ? "Acréscimos Extras"
                        : "Custos Extras"}{" "}
                      ({visibleExtraCosts.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {visibleExtraCosts.map((ec) => (
                      <div
                        key={`${ec.parentTransactionId}-${ec.id}`}
                        className={`flex items-center justify-between py-2 px-3 bg-amber-500/5 rounded-lg border border-amber-500/20`}
                      >
                        <div className="flex items-center gap-3">
                          {onToggleSelection && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mr-1"
                            >
                              <Checkbox
                                checked={selectedIds?.has(ec.id) || false}
                                onCheckedChange={() => onToggleSelection(ec.id)}
                                className="cursor-pointer"
                              />
                            </div>
                          )}
                          <div className="p-1.5 rounded-full bg-amber-500/20">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-amber-600 dark:text-amber-500">
                              {ec.description}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <span>
                                Adicionado em: {formatDate(ec.createdAt)}
                              </span>
                              {ec.wallet && (
                                <>
                                  <span className="opacity-50">•</span>
                                  <span>
                                    {wallets.find((w) => w.id === ec.wallet || w.name === ec.wallet)
                                      ?.name || ec.wallet}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-amber-600 dark:text-amber-500">
                            {formatCurrency(ec.amount)}
                          </div>

                          {/* Status Dropdown */}
                          {canEdit ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={
                                    isUpdating || updatingIds.has(ec.id)
                                  }
                                >
                                  {updatingIds.has(ec.id) ? (
                                    <>
                                      <Loader size="sm" />
                                      <span>Atualizando...</span>
                                    </>
                                  ) : (
                                    <>
                                      {(() => {
                                        const option = statusOptions.find(
                                          (o) =>
                                            o.value ===
                                            (ec.status || "pending"),
                                        );
                                        const Icon = option?.icon || Check;
                                        return <Icon className="h-3 w-3" />;
                                      })()}
                                      <span>
                                        {
                                          statusConfig[ec.status || "pending"]
                                            .label
                                        }
                                      </span>
                                      <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                    </>
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-[130px]"
                              >
                                {statusOptions.map((option) => (
                                  <DropdownMenuItem
                                    key={option.id}
                                    onClick={() =>
                                      handleExtraCostStatusChange(
                                        ec.id,
                                        ec.parentTransactionId,
                                        option.id,
                                      )
                                    }
                                    className="gap-2 cursor-pointer text-xs"
                                  >
                                    <option.icon className="h-3.5 w-3.5" />
                                    <span>{option.label}</span>
                                    {(ec.status || "pending") === option.id && (
                                      <Check className="h-3 w-3 ml-auto opacity-50" />
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-500"
                            >
                              {statusConfig[ec.status || "pending"].label}
                            </Badge>
                          )}

                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-600 hover:bg-amber-500/10 ml-1"
                                onClick={() => {
                                  setEditingExtraCost({
                                    id: ec.id,
                                    amount: ec.amount,
                                    description: ec.description,
                                    wallet: ec.wallet,
                                    parentTransactionId:
                                      ec.parentTransactionId,
                                  });
                                  setShowExtraCostDialog(true);
                                }}
                                disabled={isUpdating || updatingIds.has(ec.id)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() =>
                                    setExtraCostToDelete(
                                      `${ec.parentTransactionId}::${ec.id}`,
                                    )
                                  }
                                  disabled={
                                    isUpdating || updatingIds.has(ec.id)
                                  }
                                >
                                  {updatingIds.has(ec.id) ? (
                                    <Loader size="sm" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expanded section for standalone installment groups and standalone extra costs */}
          {isExpanded &&
            !isProposalGroup &&
            (relatedInstallments.length > 0 ||
              visibleExtraCosts.length > 0) && (
              <div className="px-4 pb-4 pt-0">
                {relatedInstallments.length > 0 && (
                  <TransactionInstallmentsList
                    installments={relatedInstallments}
                    onStatusChange={onStatusChange!}
                    onUpdate={onUpdate}
                    canEdit={canEdit}
                    selectedIds={selectedIds}
                    onToggleSelection={onToggleSelection}
                    onPartialPayment={handlePartialPayment}
                    onUndoPartial={handleUndoPartial}
                    wallets={wallets}
                  />
                )}

                {/* Extra Costs Section (Standalone Groups) */}
                {visibleExtraCosts.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center gap-2 px-1">
                        <DollarSign className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-500/80">
                          {transaction.type === "income"
                            ? "Acréscimos Extras"
                            : "Custos Extras"}{" "}
                          ({visibleExtraCosts.length})
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {visibleExtraCosts.map((ec) => (
                          <div
                            key={`${ec.parentTransactionId}-${ec.id}`}
                            className={`flex items-center justify-between py-2 px-3 bg-amber-500/5 rounded-lg border border-amber-500/20`}
                          >
                            <div className="flex items-center gap-3">
                              {onToggleSelection && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="mr-1"
                                >
                                  <Checkbox
                                    checked={selectedIds?.has(ec.id) || false}
                                    onCheckedChange={() =>
                                      onToggleSelection(ec.id)
                                    }
                                    className="cursor-pointer"
                                  />
                                </div>
                              )}
                              <div className="p-1.5 rounded-full bg-amber-500/20">
                                <DollarSign className="w-4 h-4 text-amber-500" />
                              </div>
                              <div>
                                <div className="font-medium text-sm text-amber-600 dark:text-amber-500">
                                  {ec.description}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span>
                                    Adicionado em: {formatDate(ec.createdAt)}
                                  </span>
                                  {ec.wallet && (
                                    <>
                                      <span className="opacity-50">•</span>
                                      <span>
                                        {wallets.find((w) => w.id === ec.wallet || w.name === ec.wallet)
                                          ?.name || ec.wallet}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="font-bold text-amber-600 dark:text-amber-500">
                                {formatCurrency(ec.amount)}
                              </div>

                              {/* Status Dropdown */}
                              {canEdit ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10"
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={
                                        isUpdating || updatingIds.has(ec.id)
                                      }
                                    >
                                      {updatingIds.has(ec.id) ? (
                                        <>
                                          <Loader size="sm" />
                                          <span>Atualizando...</span>
                                        </>
                                      ) : (
                                        <>
                                          {(() => {
                                            const option = statusOptions.find(
                                              (o) =>
                                                o.value ===
                                                (ec.status || "pending"),
                                            );
                                            const Icon = option?.icon || Check;
                                            return <Icon className="h-3 w-3" />;
                                          })()}
                                          <span>
                                            {
                                              statusConfig[
                                                ec.status || "pending"
                                              ].label
                                            }
                                          </span>
                                          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                        </>
                                      )}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-[130px]"
                                  >
                                    {statusOptions.map((option) => (
                                      <DropdownMenuItem
                                        key={option.id}
                                        onClick={() =>
                                          handleExtraCostStatusChange(
                                            ec.id,
                                            ec.parentTransactionId,
                                            option.id,
                                          )
                                        }
                                        className="gap-2 cursor-pointer text-xs"
                                      >
                                        <option.icon className="h-3.5 w-3.5" />
                                        <span>{option.label}</span>
                                        {(ec.status || "pending") ===
                                          option.id && (
                                          <Check className="h-3 w-3 ml-auto opacity-50" />
                                        )}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-500"
                                >
                                  {statusConfig[ec.status || "pending"].label}
                                </Badge>
                              )}

                              {canEdit && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-amber-600 hover:bg-amber-500/10 ml-1"
                                    onClick={() => {
                                      setEditingExtraCost({
                                        id: ec.id,
                                        amount: ec.amount,
                                        description: ec.description,
                                        wallet: ec.wallet,
                                        parentTransactionId:
                                          ec.parentTransactionId,
                                      });
                                      setShowExtraCostDialog(true);
                                    }}
                                    disabled={
                                      isUpdating || updatingIds.has(ec.id)
                                    }
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                      onClick={() =>
                                        setExtraCostToDelete(
                                          `${ec.parentTransactionId}::${ec.id}`,
                                        )
                                      }
                                      disabled={
                                        isUpdating || updatingIds.has(ec.id)
                                      }
                                    >
                                      {updatingIds.has(ec.id) ? (
                                        <Loader size="sm" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
        </CardContent>
      </Card>
      <EditBlockDialog
        open={showEditBlockDialog}
        onOpenChange={setShowEditBlockDialog}
        proposalId={transaction.proposalId}
      />
      <ShareLinkModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        transactionId={transaction.id}
        transactionDescription={transaction.description || "Lançamento"}
      />
      {partialPaymentTransaction && (
        <PartialPaymentDialog
          open={showPartialPaymentDialog}
          onOpenChange={setShowPartialPaymentDialog}
          transaction={partialPaymentTransaction}
          onConfirm={processPartialPayment}
        />
      )}

      {showExtraCostDialog && (
        <ExtraCostDialog
          isOpen={showExtraCostDialog}
          onOpenChange={(v) => {
            setShowExtraCostDialog(v);
            if (!v) setEditingExtraCost(null);
          }}
          transaction={transaction}
          initialData={editingExtraCost || undefined}
          onConfirm={processExtraCost}
        />
      )}

      <AlertDialog
        open={!!extraCostToDelete}
        onOpenChange={(open) => !open && setExtraCostToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {extraCostLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este {extraCostLabel.toLowerCase()}
              ? Esta ação não pode ser desfeita e removerá o valor do lançamento
              principal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                isUpdating ||
                (extraCostToDeleteId
                  ? updatingIds.has(extraCostToDeleteId)
                  : false)
              }
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                isUpdating ||
                (extraCostToDeleteId
                  ? updatingIds.has(extraCostToDeleteId)
                  : false)
              }
              onClick={() => {
                if (extraCostToDeleteId) {
                  handleDeleteExtraCost(
                    extraCostToDeleteId,
                    extraCostToDeleteParentId || transaction.id,
                  );
                  setExtraCostToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
