"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { Ambiente, ProposalSistema, Sistema } from "@/types/automation";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import { SistemaSelectorProps } from "@/components/features/automation/sistema-selector";
import { SystemEnvironmentManagerDialog } from "@/components/features/automation/system-environment-manager-dialog";
import { useWindowFocus } from "@/hooks/use-window-focus";
import { getPrimaryAmbiente } from "@/lib/sistema-migration-utils";
import { compareDisplayText } from "@/lib/sort-text";
import {
  migrateDraftHideZeroQtyStateToProposal,
  readProposalHideZeroQtyState,
  writeProposalHideZeroQtyState,
} from "@/lib/proposal-hide-zero-qty-storage";
import {
  Box,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers3,
  Package,
  PencilLine,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  MobileEmptyState,
  MobileMetric,
  MobilePanel,
  formatCurrency,
} from "./mobile/shared";

interface ProposalSystemsMobileSectionProps {
  selectedSistemas: ProposalSistema[];
  selectedProducts: ProposalProduct[];
  products: Array<Product | Service>;
  primaryColor: string;
  selectorKey: number;
  onRemoveSystem: (index: number, systemInstanceId: string) => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProductToSystem: (
    product: Product | Service,
    sistemaIndex: number,
    systemInstanceId: string,
  ) => void;
  onAddNewSystem: (sistema: ProposalSistema) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  SistemaSelectorComponent: React.ComponentType<SistemaSelectorProps>;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  onDataUpdate?: () => void;
  ambientes?: Ambiente[];
  sistemas?: Sistema[];
  onAmbienteAction?: (action: MasterDataAction) => void;
  onSistemaAction?: (action: MasterDataAction) => void;
  onRemoveAmbiente: (sistemaIndex: number, ambienteId: string) => void;
  proposalStorageKey?: string;
}

type ProductKind = "product" | "service";

const MOBILE_DIALOG_SHEET_CLASSNAME =
  "dialog-scroll-fix left-[50%] top-[50%] z-50 flex box-border w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border-border/70 p-0 sm:w-full sm:max-h-[min(90vh,720px)] sm:max-w-lg";

function AdaptiveSheetBody({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = React.useState(false);

  React.useEffect(() => {
    const viewportNode = viewportRef.current;
    const contentNode = contentRef.current;
    if (!viewportNode || !contentNode) return;

    const measure = () => {
      setHasOverflow(contentNode.scrollHeight > viewportNode.clientHeight + 10);
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    resizeObserver.observe(viewportNode);
    resizeObserver.observe(contentNode);
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  return (
    <div
      ref={viewportRef}
      className={`dialog-scroll-fix min-h-0 w-full flex-1 overscroll-y-contain px-4 py-2.5 ${
        hasOverflow ? "overflow-y-auto scrollbar-none" : "overflow-y-visible"
      }`}
    >
      <div ref={contentRef} className="w-full space-y-2.5">
        {children}
      </div>
    </div>
  );
}

export function ProposalSystemsMobileSection({
  selectedSistemas,
  selectedProducts,
  products,
  primaryColor,
  selectorKey,
  onRemoveSystem,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onAddExtraProductToSystem,
  onAddNewSystem,
  onRemoveProduct,
  SistemaSelectorComponent,
  onToggleStatus,
  onDataUpdate,
  ambientes,
  sistemas,
  onAmbienteAction,
  onSistemaAction,
  onRemoveAmbiente,
  proposalStorageKey,
}: ProposalSystemsMobileSectionProps) {
  const [openSystemKeys, setOpenSystemKeys] = React.useState<string[]>([]);
  const [openEnvironmentKeys, setOpenEnvironmentKeys] = React.useState<string[]>(
    [],
  );
  const [isManagerOpen, setIsManagerOpen] = React.useState(false);
  const [hideZeroQtyByEnvironment, setHideZeroQtyByEnvironment] =
    React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (proposalStorageKey) {
      migrateDraftHideZeroQtyStateToProposal(proposalStorageKey);
    }
  }, [proposalStorageKey]);

  React.useEffect(() => {
    setHideZeroQtyByEnvironment(readProposalHideZeroQtyState(proposalStorageKey));
  }, [proposalStorageKey]);

  React.useEffect(() => {
    const validSystemKeys = new Set(
      selectedSistemas.map((sistema, index) => getSystemKey(sistema, index)),
    );
    const validEnvironmentKeys = new Set(
      selectedSistemas.flatMap((sistema) =>
        getSystemAmbientes(sistema).map((ambiente) =>
          getEnvironmentInstanceId(sistema, ambiente.ambienteId),
        ),
      ),
    );

    setOpenSystemKeys((current) => {
      const next = current.filter((key) => validSystemKeys.has(key));
      if (next.length > 0) return next;
      const lastSistema = selectedSistemas[selectedSistemas.length - 1];
      return lastSistema ? [getSystemKey(lastSistema, selectedSistemas.length - 1)] : [];
    });

    setOpenEnvironmentKeys((current) => {
      const next = current.filter((key) => validEnvironmentKeys.has(key));
      if (next.length > 0) return next;
      const lastSistema = selectedSistemas[selectedSistemas.length - 1];
      const firstAmbiente = lastSistema ? getSystemAmbientes(lastSistema)[0] : undefined;
      return lastSistema && firstAmbiente
        ? [getEnvironmentInstanceId(lastSistema, firstAmbiente.ambienteId)]
        : [];
    });
  }, [selectedSistemas]);

  const handleToggleHideZeroQtyByEnvironment = React.useCallback(
    (environmentInstanceId: string, hideZeroQty: boolean) => {
      setHideZeroQtyByEnvironment((prev) => {
        const next = { ...prev };
        if (hideZeroQty) next[environmentInstanceId] = true;
        else delete next[environmentInstanceId];
        writeProposalHideZeroQtyState(next, proposalStorageKey);
        return next;
      });
    },
    [proposalStorageKey],
  );

  useWindowFocus(() => {
    onDataUpdate?.();
  });

  const validInstanceIds = React.useMemo(() => {
    const ids = new Set<string>();
    selectedSistemas.forEach((sistema) => {
      getSystemAmbientes(sistema).forEach((ambiente) => {
        ids.add(getEnvironmentInstanceId(sistema, ambiente.ambienteId));
      });
    });
    return ids;
  }, [selectedSistemas]);

  const visibleProducts = React.useMemo(
    () =>
      selectedProducts.filter(
        (product) =>
          product.systemInstanceId &&
          validInstanceIds.has(product.systemInstanceId),
      ),
    [selectedProducts, validInstanceIds],
  );

  const totalValue = visibleProducts.reduce((sum, product) => sum + product.total, 0);
  const totalProfit = visibleProducts.reduce((sum, product) => {
    if ((product.itemType || "product") === "service") return sum;
    return sum + product.unitPrice * product.quantity * ((product.markup || 0) / 100);
  }, 0);
  const totalItems = visibleProducts.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MobileMetric label="Solucoes" value={`${selectedSistemas.length}`} hint="sistemas configurados" accent="sky" />
        <MobileMetric label="Itens" value={`${totalItems}`} hint="somando todos os ambientes" accent="emerald" />
        <MobileMetric label="Valor" value={formatCurrency(totalValue)} hint={`${formatCurrency(totalProfit)} de lucro`} accent="amber" className="col-span-2" />
      </div>

      <MobilePanel
        eyebrow="Automacao no celular"
        title="Solucoes, ambientes e itens"
        description="A leitura fica enxuta no canvas principal. As acoes detalhadas entram em modais para manter tudo acessivel sem comprimir a tela."
        icon={Cpu}
        tone="accent"
      >
        <div className="rounded-[24px] border border-border/60 bg-background/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Resumo rapido</p>
              <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
                {selectedSistemas.length} sistema(s) / {visibleProducts.length} linha(s)
              </p>
            </div>
            <Button type="button" variant="outline" className="min-h-11 rounded-2xl" onClick={() => setIsManagerOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Gerenciar base
            </Button>
          </div>
        </div>

        {selectedSistemas.length === 0 ? (
          <MobileEmptyState
            title="Nenhuma solucao adicionada"
            description="Adicione sistemas com ambientes para montar a proposta de automacao."
          />
        ) : (
          <div className="space-y-3">
            {selectedSistemas.map((sistema, sistemaIndex) => {
              const systemKey = getSystemKey(sistema, sistemaIndex);
              const ambientesDoSistema = getSystemAmbientes(sistema);
              const environmentIds = ambientesDoSistema.map((ambiente) =>
                getEnvironmentInstanceId(sistema, ambiente.ambienteId),
              );
              const systemProducts = selectedProducts.filter(
                (product) =>
                  product.systemInstanceId &&
                  environmentIds.includes(product.systemInstanceId),
              );
              const fallbackInstanceId = `${sistema.sistemaId}-${getPrimaryAmbiente(sistema)?.ambienteId || ""}`;

              return (
                <SystemCard
                  key={systemKey}
                  sistema={sistema}
                  sistemaIndex={sistemaIndex}
                  primaryColor={primaryColor}
                  isOpen={openSystemKeys.includes(systemKey)}
                  selectedProducts={systemProducts}
                  productsCatalog={products}
                  openEnvironmentKeys={openEnvironmentKeys}
                  hideZeroQtyByEnvironment={hideZeroQtyByEnvironment}
                  onToggleSystem={() =>
                    setOpenSystemKeys((current) =>
                      current.includes(systemKey)
                        ? current.filter((value) => value !== systemKey)
                        : [...current, systemKey],
                    )
                  }
                  onToggleEnvironment={(environmentKey) =>
                    setOpenEnvironmentKeys((current) =>
                      current.includes(environmentKey)
                        ? current.filter((value) => value !== environmentKey)
                        : [...current, environmentKey],
                    )
                  }
                  onToggleHideZeroQty={handleToggleHideZeroQtyByEnvironment}
                  onRemoveSystem={() => onRemoveSystem(sistemaIndex, fallbackInstanceId)}
                  onUpdateProductQuantity={onUpdateProductQuantity}
                  onUpdateProductMarkup={onUpdateProductMarkup}
                  onUpdateProductPrice={onUpdateProductPrice}
                  onAddExtraProductToSystem={onAddExtraProductToSystem}
                  onRemoveProduct={onRemoveProduct}
                  onToggleStatus={onToggleStatus}
                  onRemoveAmbiente={onRemoveAmbiente}
                />
              );
            })}
          </div>
        )}
      </MobilePanel>

      <MobilePanel
        eyebrow="Expansao"
        title="Adicionar outra solucao"
        description="O seletor continua disponivel no mobile para inserir novos sistemas sem sair do fluxo."
        icon={Box}
      >
        <SistemaSelectorComponent
          key={selectorKey}
          onChange={(value) => value && onAddNewSystem(value)}
          onDataUpdate={onDataUpdate}
          resetAmbienteAfterSelect={true}
          onAmbienteAction={onAmbienteAction}
          onSistemaAction={onSistemaAction}
          sistemas={sistemas}
          ambientes={ambientes}
          selectedSistemas={selectedSistemas}
        />
      </MobilePanel>

      <SystemEnvironmentManagerDialog
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onDataChange={() => onDataUpdate?.()}
        sistemas={sistemas}
        ambientes={ambientes}
        onAction={async (action) => {
          if (action.entity === "ambiente" && onAmbienteAction) {
            onAmbienteAction(action);
            return;
          }
          if (onSistemaAction) onSistemaAction(action);
        }}
        allowDelete={false}
      />
    </div>
  );
}

interface SystemCardProps {
  sistema: ProposalSistema;
  sistemaIndex: number;
  primaryColor: string;
  isOpen: boolean;
  selectedProducts: ProposalProduct[];
  productsCatalog: Array<Product | Service>;
  openEnvironmentKeys: string[];
  hideZeroQtyByEnvironment: Record<string, boolean>;
  onToggleSystem: () => void;
  onToggleEnvironment: (environmentKey: string) => void;
  onToggleHideZeroQty: (environmentKey: string, checked: boolean) => void;
  onRemoveSystem: () => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProductToSystem: (
    product: Product | Service,
    sistemaIndex: number,
    systemInstanceId: string,
  ) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  onRemoveAmbiente: (sistemaIndex: number, ambienteId: string) => void;
}

function SystemCard({
  sistema,
  sistemaIndex,
  primaryColor,
  isOpen,
  selectedProducts,
  productsCatalog,
  openEnvironmentKeys,
  hideZeroQtyByEnvironment,
  onToggleSystem,
  onToggleEnvironment,
  onToggleHideZeroQty,
  onRemoveSystem,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onAddExtraProductToSystem,
  onRemoveProduct,
  onToggleStatus,
  onRemoveAmbiente,
}: SystemCardProps) {
  const ambientesDoSistema = getSystemAmbientes(sistema);
  const totalValue = selectedProducts.reduce((sum, product) => sum + product.total, 0);
  const totalItems = selectedProducts.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0,
  );
  const activeLines = selectedProducts.filter(
    (product) => product.status !== "inactive",
  ).length;

  return (
    <div
      className="overflow-hidden rounded-[28px] border bg-card shadow-[0_18px_60px_-42px_rgba(15,23,42,0.45)]"
      style={{ borderColor: `${primaryColor}33` }}
    >
      <div
        className="border-b px-4 py-4"
        style={{
          borderColor: `${primaryColor}22`,
          background: `linear-gradient(135deg, ${primaryColor}14, transparent 72%)`,
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${primaryColor}18` }}
          >
            <Cpu className="h-5 w-5" style={{ color: primaryColor }} />
          </div>

          <button
            type="button"
            onClick={onToggleSystem}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold leading-6 text-foreground [overflow-wrap:anywhere]">
                  {sistema.sistemaName}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                  {sistema.description || "Sem descricao cadastrada para este sistema."}
                </p>
              </div>

              {isOpen ? (
                <ChevronUp className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
            </div>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemoveSystem}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ambientesDoSistema.map((ambiente) => (
            <span
              key={`${sistema.sistemaId}-${ambiente.ambienteId}`}
              className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{
                borderColor: `${primaryColor}30`,
                color: primaryColor,
                backgroundColor: `${primaryColor}12`,
              }}
            >
              {ambiente.ambienteName}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
          <MetricChip label="Ambientes" value={`${ambientesDoSistema.length}`} />
          <MetricChip label="Linhas ativas" value={`${activeLines}`} />
          <MetricChip
            label="Valor final"
            value={formatCurrency(totalValue)}
            className="col-span-2"
          />
          <MetricChip
            label="Quantidade"
            value={`${totalItems} unidade(s)`}
            className="col-span-2"
          />
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-3 px-4 py-4">
          {ambientesDoSistema.map((ambiente) => {
            const environmentInstanceId = getEnvironmentInstanceId(
              sistema,
              ambiente.ambienteId,
            );
            const environmentProducts = selectedProducts
              .filter((product) => product.systemInstanceId === environmentInstanceId)
              .sort((a, b) => compareDisplayText(a.productName, b.productName));
            const hideZeroQty = !!hideZeroQtyByEnvironment[environmentInstanceId];
            const visibleEnvironmentProducts = hideZeroQty
              ? environmentProducts.filter(
                  (product) => Number(product.quantity || 0) !== 0,
                )
              : environmentProducts;

            return (
              <EnvironmentEditor
                key={environmentInstanceId}
                title={ambiente.ambienteName || "Ambiente"}
                description={ambiente.description}
                systemName={sistema.sistemaName}
                productsCatalog={productsCatalog}
                selectedProducts={environmentProducts}
                visibleProducts={visibleEnvironmentProducts}
                isOpen={openEnvironmentKeys.includes(environmentInstanceId)}
                hideZeroQty={hideZeroQty}
                hiddenProductsCount={
                  environmentProducts.length - visibleEnvironmentProducts.length
                }
                onToggleOpen={() => onToggleEnvironment(environmentInstanceId)}
                onToggleHideZeroQty={(checked) =>
                  onToggleHideZeroQty(environmentInstanceId, checked)
                }
                onDeleteEnvironment={() =>
                  onRemoveAmbiente(sistemaIndex, ambiente.ambienteId || "")
                }
                onUpdateProductQuantity={(productId, delta, itemType) =>
                  onUpdateProductQuantity(
                    productId,
                    delta,
                    environmentInstanceId,
                    itemType,
                  )
                }
                onUpdateProductMarkup={(productId, markup, itemType) =>
                  onUpdateProductMarkup(
                    productId,
                    markup,
                    environmentInstanceId,
                    itemType,
                  )
                }
                onUpdateProductPrice={(productId, newPrice, itemType) =>
                  onUpdateProductPrice(
                    productId,
                    newPrice,
                    environmentInstanceId,
                    itemType,
                  )
                }
                onRemoveProduct={(productId, itemType) =>
                  onRemoveProduct(productId, environmentInstanceId, itemType)
                }
                onAddExtraProduct={(product) =>
                  onAddExtraProductToSystem(
                    product,
                    sistemaIndex,
                    environmentInstanceId,
                  )
                }
                onToggleStatus={onToggleStatus}
                environmentInstanceId={environmentInstanceId}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MetricChip({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/60 bg-background/70 px-3 py-2 ${className ?? ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

interface EnvironmentEditorProps {
  title: string;
  description?: string;
  systemName: string;
  productsCatalog: Array<Product | Service>;
  selectedProducts: ProposalProduct[];
  visibleProducts: ProposalProduct[];
  isOpen: boolean;
  hideZeroQty: boolean;
  hiddenProductsCount: number;
  onToggleOpen: () => void;
  onToggleHideZeroQty: (checked: boolean) => void;
  onDeleteEnvironment: () => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    price: number,
    itemType?: "product" | "service",
  ) => void;
  onRemoveProduct: (
    productId: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProduct: (product: Product | Service) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  environmentInstanceId: string;
}

function EnvironmentEditor({
  title,
  description,
  systemName,
  productsCatalog,
  selectedProducts,
  visibleProducts,
  isOpen,
  hideZeroQty,
  hiddenProductsCount,
  onToggleOpen,
  onToggleHideZeroQty,
  onDeleteEnvironment,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onAddExtraProduct,
  onToggleStatus,
  environmentInstanceId,
}: EnvironmentEditorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const environmentTotal = selectedProducts.reduce(
    (sum, product) => sum + product.total,
    0,
  );
  const visibleQuantity = visibleProducts.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0,
  );

  return (
    <>
      <div className="rounded-[24px] border border-border/60 bg-background/80 p-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggleOpen}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ambiente
            </p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                  {title}
                </h4>
                <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                  {description || "Sem descricao especifica para este ambiente."}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDeleteEnvironment}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
          <MetricChip label="Linhas" value={`${selectedProducts.length}`} />
          <MetricChip label="Qtd visivel" value={`${visibleQuantity}`} />
          <MetricChip
            label="Valor do ambiente"
            value={formatCurrency(environmentTotal)}
            className="col-span-2"
          />
        </div>

        <div className="mt-3 rounded-2xl border border-border/60 bg-background/70 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Visibilidade
              </p>
              <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
                {hideZeroQty
                  ? hiddenProductsCount > 0
                    ? `${hiddenProductsCount} item(ns) com quantidade zero ocultos`
                    : "Sem itens com quantidade zero para ocultar"
                  : "Todos os itens deste ambiente estao visiveis"}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Ocultar qtd. 0
              </span>
              <Switch
                checked={hideZeroQty}
                onCheckedChange={onToggleHideZeroQty}
              />
            </div>
          </div>
        </div>

        {isOpen ? (
          <>
            <div className="mt-3 space-y-2">
              {visibleProducts.length === 0 ? (
                <MobileEmptyState
                  title={
                    selectedProducts.length > 0 && hideZeroQty
                      ? "Itens com quantidade zero ocultos"
                      : "Sem itens neste ambiente"
                  }
                  description={
                    selectedProducts.length > 0 && hideZeroQty
                      ? "Desative o filtro para revisar todos os itens deste ambiente."
                      : "Adicione produtos ou servicos extras para completar este ambiente."
                  }
                />
              ) : (
                visibleProducts.map((product, index) => (
                  <ProductActionRow
                    key={`${environmentInstanceId}-${product.productId}-${index}`}
                    product={product}
                    systemName={systemName}
                    environmentName={title}
                    environmentInstanceId={environmentInstanceId}
                    onUpdateProductQuantity={onUpdateProductQuantity}
                    onUpdateProductMarkup={onUpdateProductMarkup}
                    onUpdateProductPrice={onUpdateProductPrice}
                    onRemoveProduct={onRemoveProduct}
                    onToggleStatus={onToggleStatus}
                  />
                ))
              )}
            </div>

            <div className="mt-3 rounded-[22px] border border-dashed border-border/70 bg-background/70 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Item extra
                  </p>
                  <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
                    Abra o catalogo dedicado para inserir produtos ou servicos sem poluir o card do ambiente.
                  </p>
                </div>

                <Button
                  type="button"
                  className="min-h-11 rounded-2xl"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar item
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <AddExtraItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        productsCatalog={productsCatalog}
        selectedProducts={selectedProducts}
        onAddExtraProduct={onAddExtraProduct}
      />
    </>
  );
}

interface ProductActionRowProps {
  product: ProposalProduct;
  systemName: string;
  environmentName: string;
  environmentInstanceId: string;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    price: number,
    itemType?: "product" | "service",
  ) => void;
  onRemoveProduct: (
    productId: string,
    itemType?: "product" | "service",
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}

function ProductActionRow({
  product,
  systemName,
  environmentName,
  environmentInstanceId,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onToggleStatus,
}: ProductActionRowProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [priceValue, setPriceValue] = React.useState(String(product.unitPrice || 0));
  const [markupValue, setMarkupValue] = React.useState(String(product.markup || 0));

  const itemType = (product.itemType || "product") as ProductKind;
  const isService = itemType === "service";
  const isActive = product.status !== "inactive";
  const isExtra = !!product.isExtra;
  const finalUnitPrice = isService
    ? product.unitPrice || 0
    : (product.unitPrice || 0) * (1 + (product.markup || 0) / 100);

  React.useEffect(() => {
    if (!isDialogOpen) {
      setPriceValue(String(product.unitPrice || 0));
      setMarkupValue(String(product.markup || 0));
    }
  }, [isDialogOpen, product.markup, product.unitPrice]);

  const applyFinancialChanges = () => {
    const parsedPrice = parseNumberInput(priceValue, product.unitPrice || 0);
    const parsedMarkup = parseNumberInput(markupValue, product.markup || 0);

    if (parsedPrice !== product.unitPrice) {
      onUpdateProductPrice(product.productId, parsedPrice, itemType);
    }

    if (!isService && parsedMarkup !== (product.markup || 0)) {
      onUpdateProductMarkup(product.productId, parsedMarkup, itemType);
    }

    setIsDialogOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className={`w-full rounded-[24px] border p-3.5 text-left transition-all ${
          isExtra
            ? "border-sky-500/25 bg-sky-500/8"
            : "border-border/60 bg-card"
        } ${!isActive ? "opacity-75" : ""}`}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {product.productImage || product.productImages?.[0] ? (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[20px] border border-border/60 bg-background/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.productImages?.[0] || product.productImage}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border/60 bg-background/80">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                    isService
                      ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {isService ? "Servico" : "Produto"}
                </span>
                {isExtra ? (
                  <span className="rounded-full bg-sky-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-sky-700 dark:text-sky-300">
                    Extra
                  </span>
                ) : null}
                {!isActive ? (
                  <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-300">
                    Oculto no PDF
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="break-words text-[15px] font-semibold leading-5 text-foreground">
                  {product.productName}
                </p>
                {product.productDescription ? (
                  <p className="mt-1 text-sm leading-5 text-muted-foreground break-words">
                    {product.productDescription}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InlinePill label="Qtd" value={`${product.quantity}`} />
            <InlinePill
              label="Preco"
              value={formatCurrency(product.unitPrice || 0)}
            />
            {!isService ? (
              <InlinePill
                label="Markup"
                value={`${Number(product.markup || 0).toFixed(0)}%`}
              />
            ) : (
              <InlinePill label="Tipo" value="Servico" />
            )}
            <InlinePill label="Total" value={formatCurrency(product.total)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-background/60 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Ambiente
              </p>
              <p className="break-words text-sm font-medium text-foreground">
                {environmentName}
              </p>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <PencilLine className="h-3.5 w-3.5" />
              Editar item
            </span>
          </div>
        </div>
      </button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          variant="sheet"
          className={MOBILE_DIALOG_SHEET_CLASSNAME}
          hideCloseButton
        >
          <div className="flex w-full max-h-full min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-border/60 px-4 pb-2.5 pt-2">
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border/70 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <DialogHeader className="min-w-0 text-left">
                  <DialogTitle className="text-base [overflow-wrap:anywhere]">
                    {product.productName}
                  </DialogTitle>
                  <DialogDescription className="[overflow-wrap:anywhere]">
                    {systemName} / {environmentName}
                  </DialogDescription>
                </DialogHeader>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AdaptiveSheetBody>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
                  <MetricChip label="Preco base" value={formatCurrency(product.unitPrice)} />
                  <MetricChip label="Total atual" value={formatCurrency(product.total)} />
                  <MetricChip
                    label="Valor unitario final"
                    value={formatCurrency(finalUnitPrice)}
                    className="col-span-2"
                  />
                </div>

                <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Visibilidade no PDF
                      </p>
                      <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
                        {isActive
                          ? "Item ativo e visivel na proposta."
                          : "Item oculto no PDF, mas mantido para edicao."}
                      </p>
                    </div>
                    {onToggleStatus ? (
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                          onToggleStatus(
                            product.productId,
                            checked ? "active" : "inactive",
                            environmentInstanceId,
                            itemType,
                          )
                        }
                      />
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Quantidade
                  </p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-2xl"
                      onClick={() =>
                        onUpdateProductQuantity(product.productId, -1, itemType)
                      }
                    >
                      <span className="text-lg">-</span>
                    </Button>
                    <div className="min-w-0 flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 text-center text-base font-semibold">
                      {product.quantity}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-2xl"
                      onClick={() =>
                        onUpdateProductQuantity(product.productId, 1, itemType)
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Preco base
                    </p>
                    <Input
                      value={priceValue}
                      onChange={(event) => setPriceValue(event.target.value)}
                      className="mt-2.5 h-11 rounded-2xl"
                      inputMode="decimal"
                    />
                  </div>

                  <div className="rounded-[22px] border border-border/60 bg-background/70 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Markup
                    </p>
                    <Input
                      value={markupValue}
                      disabled={isService}
                      onChange={(event) => setMarkupValue(event.target.value)}
                      className="mt-2.5 h-11 rounded-2xl"
                      inputMode="decimal"
                      suffix={<span className="text-xs">%</span>}
                    />
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {isService
                        ? "Servicos usam somente o preco informado."
                        : "Markup define o lucro aplicado sobre o custo base."}
                    </p>
                  </div>
                </div>
            </AdaptiveSheetBody>

            <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 pb-3.5 pt-2.5 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 w-full rounded-2xl sm:w-auto"
                  onClick={() => {
                    onRemoveProduct(product.productId, itemType);
                    setIsDialogOpen(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover item
                </Button>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full rounded-2xl sm:w-auto"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11 w-full rounded-2xl sm:w-auto"
                    onClick={applyFinancialChanges}
                  >
                    Salvar ajustes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InlinePill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="rounded-[18px] border border-border/60 bg-background/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {label}: <span className="normal-case text-foreground">{value}</span>
    </span>
  );
}

function AddExtraItemDialog({
  open,
  onOpenChange,
  productsCatalog,
  selectedProducts,
  onAddExtraProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productsCatalog: Array<Product | Service>;
  selectedProducts: ProposalProduct[];
  onAddExtraProduct: (product: Product | Service) => void;
}) {
  const [filter, setFilter] = React.useState<"all" | ProductKind>("all");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);

  React.useEffect(() => {
    if (!open) {
      setFilter("all");
      setSearch("");
    }
  }, [open]);

  const availableItems = React.useMemo(() => {
    const selectedIds = new Set(
      selectedProducts.map(
        (product) => `${product.itemType || "product"}:${product.productId}`,
      ),
    );
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return productsCatalog
      .filter((product) => {
        const productKey = `${product.itemType || "product"}:${product.id}`;
        if (selectedIds.has(productKey)) return false;
        if (filter !== "all" && (product.itemType || "product") !== filter) {
          return false;
        }
        if (!normalizedSearch) return true;

        return (
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.category?.toLowerCase().includes(normalizedSearch) ||
          product.description?.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => compareDisplayText(a.name, b.name));
  }, [deferredSearch, filter, productsCatalog, selectedProducts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="sheet"
        className={MOBILE_DIALOG_SHEET_CLASSNAME}
        hideCloseButton
      >
        <div className="flex w-full max-h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border/60 px-4 pb-2.5 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border/70 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <DialogHeader className="min-w-0 text-left">
                <DialogTitle className="text-base">Adicionar item extra</DialogTitle>
                <DialogDescription>
                  O mobile abre um catalogo dedicado para voce inserir o item certo sem esmagar a interface do ambiente.
                </DialogDescription>
              </DialogHeader>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Fechar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <AdaptiveSheetBody>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Tudo" },
                  { value: "product", label: "Produtos" },
                  { value: "service", label: "Servicos" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value as "all" | ProductKind)}
                    className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-medium transition-all ${
                      filter === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background/75 text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, categoria ou descricao"
                icon={<Search className="h-4 w-4" />}
              />

              {availableItems.length === 0 ? (
                <MobileEmptyState
                  title="Nenhum item disponivel"
                  description="Todos os itens compativeis ja foram adicionados ou o filtro atual nao encontrou resultados."
                />
              ) : (
                <div className="space-y-2 pb-2">
                  {availableItems.map((product) => {
                    const itemType = (product.itemType || "product") as ProductKind;
                    return (
                      <button
                        key={`${itemType}-${product.id}`}
                        type="button"
                        onClick={() => {
                          onAddExtraProduct(product);
                          onOpenChange(false);
                        }}
                        className="w-full rounded-[22px] border border-border/60 bg-card p-3 text-left transition-all hover:border-primary/35 hover:bg-primary/5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/80">
                            <Layers3 className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
                                  {product.name}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                                  {itemType === "service" ? "Servico" : "Produto"}
                                  {product.category ? ` / ${product.category}` : ""}
                                </p>
                              </div>

                              <span className="shrink-0 text-sm font-semibold text-foreground">
                                {formatCurrency(Number(product.price))}
                              </span>
                            </div>

                            {product.description ? (
                              <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                                {product.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
          </AdaptiveSheetBody>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getSystemAmbientes(sistema: ProposalSistema) {
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema.ambientes;
  }

  return [
    {
      ambienteId: sistema.ambienteId || "",
      ambienteName: sistema.ambienteName || "Ambiente",
      description: undefined,
      products: sistema.products || [],
    },
  ];
}

function getEnvironmentInstanceId(sistema: ProposalSistema, ambienteId?: string) {
  return `${sistema.sistemaId}-${ambienteId || ""}`;
}

function getSystemKey(sistema: ProposalSistema, sistemaIndex: number) {
  return `${sistema.sistemaId || "sistema"}-${sistemaIndex}`;
}

function parseNumberInput(value: string, fallback: number) {
  const parsed = Number(value.replace(",", ".").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}
