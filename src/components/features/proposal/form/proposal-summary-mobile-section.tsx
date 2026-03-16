"use client";

import * as React from "react";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus } from "@/types/proposal";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaymentConditionsSummary } from "./summary/payment-conditions-summary";
import {
  KanbanService,
  KanbanStatusColumn,
  getDefaultProposalColumns,
} from "@/services/kanban-service";
import { useTenant } from "@/providers/tenant-provider";
import { CheckCircle2, FileText, Package, Receipt, Tag } from "lucide-react";

const statusOptions: { value: ProposalStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "in_progress", label: "Em Aberto" },
  { value: "sent", label: "Enviada" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
];

interface ProposalSummaryMobileSectionProps {
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  isAutomacaoNiche: boolean;
  products?: Array<Product | Service>;
  calculateSubtotal: () => number;
  calculateDiscount: () => number;
  calculateTotal: () => number;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ProposalSummaryMobileSection({
  formData,
  selectedProducts,
  selectedSistemas,
  isAutomacaoNiche,
  products = [],
  calculateSubtotal,
  calculateDiscount,
  calculateTotal,
  onFormChange,
}: ProposalSummaryMobileSectionProps) {
  const { tenant } = useTenant();
  const [dynamicStatusOptions, setDynamicStatusOptions] = React.useState<
    {
      value: string;
      label: string;
      mappedStatus?: string;
    }[]
  >([...statusOptions.filter((o) => o.value !== "draft")]);

  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;

    KanbanService.getStatuses(tenant.id)
      .then((columns) => {
        if (cancelled) return;

        let activeColumns = columns;
        if (activeColumns.length === 0) {
          activeColumns = getDefaultProposalColumns().map(
            (c, i) => ({ ...c, id: `default_${i}` }) as KanbanStatusColumn,
          );
        }

        const newOptions = activeColumns.map((c) => ({
          value:
            c.id.startsWith("default_") && c.mappedStatus
              ? c.mappedStatus
              : c.id,
          label: c.label,
          mappedStatus: c.mappedStatus,
        }));

        if (
          formData.status &&
          formData.status !== "draft" &&
          !newOptions.some((o) => o.value === formData.status)
        ) {
          const mappedColumn = activeColumns.find(
            (c) =>
              c.mappedStatus === formData.status || c.id === formData.status,
          );

          if (mappedColumn) {
            const actualValueToSave =
              mappedColumn.id.startsWith("default_") &&
              mappedColumn.mappedStatus
                ? mappedColumn.mappedStatus
                : mappedColumn.id;

            onFormChange({
              target: {
                name: "status",
                value: actualValueToSave,
              },
            } as React.ChangeEvent<HTMLSelectElement>);
          } else {
            const fallback = statusOptions.find(
              (o) => o.value === formData.status,
            );
            newOptions.push({
              value: formData.status,
              label: fallback
                ? `${fallback.label} (Antigo)`
                : "Desconhecido (Antigo)",
              mappedStatus: fallback?.value,
            });
          }
        }

        setDynamicStatusOptions(newOptions);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [tenant?.id, formData.status, onFormChange]);

  const displayProducts = React.useMemo(
    () => selectedProducts.filter((p) => (p.quantity || 0) > 0),
    [selectedProducts],
  );
  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const total = calculateTotal();
  const extraExpense = formData.extraExpense || 0;

  const itemCount = displayProducts.reduce(
    (sum, p) => sum + (p.quantity || 0),
    0,
  );

  const groupedBySystem = React.useMemo(() => {
    if (!isAutomacaoNiche)
      return [] as Array<{
        key: string;
        title: string;
        subtitle: string;
        products: ProposalProduct[];
        subtotal: number;
      }>;

    const groups: Array<{
      key: string;
      title: string;
      subtitle: string;
      products: ProposalProduct[];
      subtotal: number;
    }> = [];

    selectedSistemas.forEach((sistema, sistemaIdx) => {
      const ambientes =
        sistema.ambientes && sistema.ambientes.length > 0
          ? sistema.ambientes
          : sistema.ambienteId
            ? [
                {
                  ambienteId: sistema.ambienteId,
                  ambienteName: sistema.ambienteName || "Ambiente",
                },
              ]
            : [];

      ambientes.forEach((ambiente, ambienteIdx) => {
        const instanceId = `${sistema.sistemaId}-${ambiente.ambienteId}`;
        const envProducts = displayProducts.filter(
          (p) => p.systemInstanceId === instanceId,
        );

        if (envProducts.length === 0) return;

        const envSubtotal = envProducts.reduce((sum, p) => sum + p.total, 0);

        groups.push({
          key: `${sistemaIdx}-${ambienteIdx}-${instanceId}`,
          title: sistema.sistemaName,
          subtitle: ambiente.ambienteName,
          products: envProducts,
          subtotal: envSubtotal,
        });
      });
    });

    return groups;
  }, [displayProducts, isAutomacaoNiche, selectedSistemas]);

  const isProductInactive = React.useCallback(
    (product: ProposalProduct) => {
      const catalogProduct = products.find((p) => p.id === product.productId);
      return (
        catalogProduct?.status === "inactive" || product.status === "inactive"
      );
    },
    [products],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Totais da Proposta</h4>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground">Subtotal</p>
            <p className="font-semibold">{formatCurrency(subtotal)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground">Desconto</p>
            <p className="font-semibold text-purple-600">
              -{formatCurrency(discount)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground">Custos Extras</p>
            <p className="font-semibold">{formatCurrency(extraExpense)}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 border border-primary/20">
            <p className="text-[11px] text-muted-foreground">Total Final</p>
            <p className="font-bold text-primary">{formatCurrency(total)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{displayProducts.length} item(ns)</span>
          <span>{itemCount} unidade(s)</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Itens Selecionados</h4>
        </div>

        {displayProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item com quantidade maior que 0.
          </p>
        ) : isAutomacaoNiche ? (
          <div className="space-y-3">
            {groupedBySystem.map((group) => (
              <div
                key={group.key}
                className="rounded-xl border border-border/60 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {group.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {group.subtitle}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    {formatCurrency(group.subtotal)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.products.map((product, idx) => (
                    <div
                      key={`${group.key}-${product.productId}-${idx}`}
                      className="rounded-lg bg-muted/30 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium">
                          {product.productName}
                        </p>
                        <p className="text-xs font-semibold">
                          {formatCurrency(product.total)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{product.quantity}x</span>
                        <span>•</span>
                        <span>{formatCurrency(product.unitPrice)}</span>
                        {product.isExtra ? (
                          <>
                            <span>•</span>
                            <span className="text-sky-600 dark:text-sky-400 font-medium">
                              Extra
                            </span>
                          </>
                        ) : null}
                        {isProductInactive(product) ? (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Inativo
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayProducts.map((product, idx) => (
              <div
                key={`${product.productId}-${idx}`}
                className="rounded-lg bg-muted/30 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {product.productName}
                  </p>
                  <p className="text-xs font-semibold">
                    {formatCurrency(product.total)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{product.quantity}x</span>
                  <span>•</span>
                  <span>{formatCurrency(product.unitPrice)}</span>
                  {product.isExtra ? (
                    <>
                      <span>•</span>
                      <span className="text-sky-600 dark:text-sky-400 font-medium">
                        Extra
                      </span>
                    </>
                  ) : null}
                  {isProductInactive(product) ? (
                    <>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Inativo
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Finalização</h4>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="status" className="text-xs text-muted-foreground">
            Status da proposta
          </Label>
          <Select
            id="status"
            name="status"
            value={formData.status || "draft"}
            onChange={onFormChange}
          >
            {dynamicStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label
            htmlFor="customNotes"
            className="text-xs text-muted-foreground flex items-center gap-1.5"
          >
            <Tag className="h-3.5 w-3.5" />
            Observações
          </Label>
          <Textarea
            id="customNotes"
            name="customNotes"
            value={formData.customNotes || ""}
            onChange={onFormChange}
            placeholder="Condições comerciais, observações ou recados para o cliente"
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Condições de Pagamento</h4>
        </div>
        <PaymentConditionsSummary formData={formData} totalValue={total} />
      </div>
    </div>
  );
}
