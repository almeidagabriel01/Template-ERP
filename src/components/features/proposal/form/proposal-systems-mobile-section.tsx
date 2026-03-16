"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { Ambiente, ProposalSistema, Sistema } from "@/types/automation";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import { SistemaSelectorProps } from "@/components/features/automation/sistema-selector";
import { SystemEnvironmentManagerDialog } from "@/components/features/automation/system-environment-manager-dialog";
import { getPrimaryAmbiente } from "@/lib/sistema-migration-utils";
import { compareDisplayText } from "@/lib/sort-text";
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Minus,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";

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
}: ProposalSystemsMobileSectionProps) {
  const [openSystemKey, setOpenSystemKey] = React.useState<string | null>(null);
  const [isManagerOpen, setIsManagerOpen] = React.useState(false);

  const validInstanceIds = React.useMemo(() => {
    const set = new Set<string>();
    selectedSistemas.forEach((s) => {
      if (s.ambientes && s.ambientes.length > 0) {
        s.ambientes.forEach((a) => {
          if (s.sistemaId && a.ambienteId) {
            set.add(`${s.sistemaId}-${a.ambienteId}`);
          }
        });
      } else {
        const primary = getPrimaryAmbiente(s);
        if (s.sistemaId && primary?.ambienteId) {
          set.add(`${s.sistemaId}-${primary.ambienteId}`);
        }
      }
    });
    return set;
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

  const proposalTotal = React.useMemo(
    () => visibleProducts.reduce((sum, p) => sum + p.total, 0),
    [visibleProducts],
  );

  const totalProfit = React.useMemo(
    () =>
      visibleProducts.reduce((sum, p) => {
        if ((p.itemType || "product") === "service") return sum;
        return sum + p.unitPrice * p.quantity * ((p.markup || 0) / 100);
      }, 0),
    [visibleProducts],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Resumo Rápido
            </p>
            <p className="text-sm font-semibold">
              {selectedSistemas.length} solução(ões)
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setIsManagerOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            Gerenciar
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">R$ {proposalTotal.toFixed(2)}</span>
          <span className="text-muted-foreground">Lucro:</span>
          <span className="font-semibold text-emerald-600">
            R$ {totalProfit.toFixed(2)}
          </span>
        </div>
      </div>

      {selectedSistemas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma solução adicionada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {selectedSistemas.map((sistema, sistemaIndex) => {
            const primaryAmbiente = getPrimaryAmbiente(sistema);
            const fallbackInstanceId = `${sistema.sistemaId}-${primaryAmbiente?.ambienteId || ""}`;
            const ambientesDoSistema =
              sistema.ambientes && sistema.ambientes.length > 0
                ? sistema.ambientes
                : [
                    {
                      ambienteId: sistema.ambienteId || "",
                      ambienteName: sistema.ambienteName || "Ambiente",
                      description: undefined,
                      products: sistema.products || [],
                    },
                  ];

            const systemProducts = selectedProducts.filter((p) => {
              const envIds = ambientesDoSistema.map(
                (ambiente) => `${sistema.sistemaId}-${ambiente.ambienteId}`,
              );
              return p.systemInstanceId && envIds.includes(p.systemInstanceId);
            });

            const systemTotal = systemProducts.reduce(
              (sum, p) => sum + p.total,
              0,
            );
            const openKey = `${sistema.sistemaId}-${sistemaIndex}`;
            const isOpen = openSystemKey === openKey;

            return (
              <div
                key={openKey}
                className="rounded-2xl border p-3"
                style={{
                  borderColor: `${primaryColor}66`,
                  backgroundColor: `${primaryColor}0D`,
                }}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() =>
                      setOpenSystemKey((prev) =>
                        prev === openKey ? null : openKey,
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}22` }}
                      >
                        <Cpu
                          className="h-4 w-4"
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {sistema.sistemaName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ambientesDoSistema.length} ambiente(s) • R${" "}
                          {systemTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      onRemoveSystem(sistemaIndex, fallbackInstanceId)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setOpenSystemKey((prev) =>
                        prev === openKey ? null : openKey,
                      )
                    }
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                    {ambientesDoSistema.map((ambiente) => {
                      const environmentInstanceId = `${sistema.sistemaId}-${ambiente.ambienteId}`;
                      const envProducts = selectedProducts
                        .filter(
                          (p) => p.systemInstanceId === environmentInstanceId,
                        )
                        .sort((a, b) =>
                          compareDisplayText(a.productName, b.productName),
                        );

                      return (
                        <EnvironmentEditor
                          key={environmentInstanceId}
                          title={ambiente.ambienteName || "Ambiente"}
                          description={ambiente.description}
                          productsCatalog={products}
                          selectedProducts={envProducts}
                          onDeleteEnvironment={() =>
                            onRemoveAmbiente(
                              sistemaIndex,
                              ambiente.ambienteId || "",
                            )
                          }
                          onUpdateProductQuantity={(
                            productId,
                            delta,
                            itemType,
                          ) =>
                            onUpdateProductQuantity(
                              productId,
                              delta,
                              environmentInstanceId,
                              itemType,
                            )
                          }
                          onUpdateProductMarkup={(
                            productId,
                            markup,
                            itemType,
                          ) =>
                            onUpdateProductMarkup(
                              productId,
                              markup,
                              environmentInstanceId,
                              itemType,
                            )
                          }
                          onUpdateProductPrice={(productId, price, itemType) =>
                            onUpdateProductPrice(
                              productId,
                              price,
                              environmentInstanceId,
                              itemType,
                            )
                          }
                          onRemoveProduct={(productId, itemType) =>
                            onRemoveProduct(
                              productId,
                              environmentInstanceId,
                              itemType,
                            )
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
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-3">
        <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
          Adicionar Solução
        </p>
        <SistemaSelectorComponent
          key={selectorKey}
          onChange={(value) => {
            if (value) onAddNewSystem(value);
          }}
          onDataUpdate={onDataUpdate}
          resetAmbienteAfterSelect={true}
          onAmbienteAction={onAmbienteAction}
          onSistemaAction={onSistemaAction}
          sistemas={sistemas}
          ambientes={ambientes}
          selectedSistemas={selectedSistemas}
        />
      </div>

      <SystemEnvironmentManagerDialog
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onDataChange={() => onDataUpdate?.()}
        sistemas={sistemas}
        ambientes={ambientes}
        onAction={async (action) => {
          if (action.entity === "ambiente" && onAmbienteAction) {
            onAmbienteAction(action);
          } else if (onSistemaAction) {
            onSistemaAction(action);
          }
        }}
        allowDelete={false}
      />
    </div>
  );
}

interface EnvironmentEditorProps {
  title: string;
  description?: string;
  productsCatalog: Array<Product | Service>;
  selectedProducts: ProposalProduct[];
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
  productsCatalog,
  selectedProducts,
  onDeleteEnvironment,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onAddExtraProduct,
  onToggleStatus,
  environmentInstanceId,
}: EnvironmentEditorProps) {
  const [extraProductValue, setExtraProductValue] = React.useState("");

  const options = React.useMemo<SearchableSelectOption[]>(() => {
    const selectedIds = new Set(
      selectedProducts.map((p) => `${p.itemType || "product"}:${p.productId}`),
    );

    return productsCatalog
      .filter((product) => {
        const key = `${product.itemType || "product"}:${product.id}`;
        return !selectedIds.has(key);
      })
      .sort((a, b) => compareDisplayText(a.name, b.name))
      .map((product) => ({
        value: `${product.itemType || "product"}:${product.id}`,
        label: product.name,
        description:
          (product.itemType || "product") === "service" ? "Serviço" : "Produto",
      }));
  }, [productsCatalog, selectedProducts]);

  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            {title}
          </p>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDeleteEnvironment}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {selectedProducts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem produtos neste ambiente.
        </p>
      ) : (
        <div className="space-y-2">
          {selectedProducts.map((product, index) => (
            <ProductMobileRow
              key={`${product.productId}-${index}`}
              product={product}
              environmentInstanceId={environmentInstanceId}
              onUpdateProductQuantity={onUpdateProductQuantity}
              onUpdateProductMarkup={onUpdateProductMarkup}
              onUpdateProductPrice={onUpdateProductPrice}
              onRemoveProduct={onRemoveProduct}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-border/60 space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          Adicionar item extra
        </p>
        <SearchableSelect
          options={options}
          value={extraProductValue}
          onValueChange={setExtraProductValue}
          searchPlaceholder="Buscar produto/serviço"
          placeholder="Selecionar item"
          emptyMessage="Todos os itens já estão neste ambiente"
        />
        <Button
          type="button"
          className="w-full"
          disabled={!extraProductValue}
          onClick={() => {
            const [itemType, productId] = extraProductValue.split(":");
            const selected = productsCatalog.find(
              (product) =>
                product.id === productId &&
                (product.itemType || "product") === itemType,
            );
            if (!selected) return;
            onAddExtraProduct(selected);
            setExtraProductValue("");
          }}
        >
          Adicionar ao ambiente
        </Button>
      </div>
    </div>
  );
}

interface ProductMobileRowProps {
  product: ProposalProduct;
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

function ProductMobileRow({
  product,
  environmentInstanceId,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onToggleStatus,
}: ProductMobileRowProps) {
  const isService = (product.itemType || "product") === "service";
  const isActive = product.status !== "inactive";
  const isExtra = !!product.isExtra;

  const [priceValue, setPriceValue] = React.useState(
    String(product.unitPrice || 0),
  );
  const [markupValue, setMarkupValue] = React.useState(
    String(product.markup || 0),
  );

  React.useEffect(() => {
    setPriceValue(String(product.unitPrice || 0));
  }, [product.unitPrice]);

  React.useEffect(() => {
    setMarkupValue(String(product.markup || 0));
  }, [product.markup]);

  return (
    <div
      className={`rounded-lg border p-2.5 space-y-2 ${
        isExtra ? "border-sky-500/50 bg-sky-500/10" : "border-border/60 bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{product.productName}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {isService ? "Serviço" : "Produto"} • R${" "}
              {product.total.toFixed(2)}
            </span>
            {isExtra ? (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-sky-500/20 text-sky-700 dark:text-sky-300">
                Extra
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleStatus && (
            <Switch
              checked={isActive}
              onCheckedChange={(checked) =>
                onToggleStatus(
                  product.productId,
                  checked ? "active" : "inactive",
                  environmentInstanceId,
                  product.itemType || "product",
                )
              }
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            title={isExtra ? "Remover item extra" : "Remover item"}
            onClick={() =>
              onRemoveProduct(product.productId, product.itemType || "product")
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Qtd
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                onUpdateProductQuantity(
                  product.productId,
                  -1,
                  product.itemType || "product",
                )
              }
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="min-w-6 text-center text-sm font-semibold">
              {product.quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                onUpdateProductQuantity(
                  product.productId,
                  1,
                  product.itemType || "product",
                )
              }
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="col-span-1">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Preco
          </p>
          <Input
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            onBlur={() => {
              const parsed = Number(priceValue.replace(",", "."));
              if (Number.isFinite(parsed) && parsed >= 0) {
                onUpdateProductPrice(
                  product.productId,
                  parsed,
                  product.itemType || "product",
                );
              } else {
                setPriceValue(String(product.unitPrice || 0));
              }
            }}
            className="h-8"
          />
        </div>

        <div className="col-span-1">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Markup
          </p>
          <Input
            value={markupValue}
            disabled={isService}
            onChange={(e) => setMarkupValue(e.target.value)}
            onBlur={() => {
              const parsed = Number(markupValue.replace(",", "."));
              if (Number.isFinite(parsed) && parsed >= 0) {
                onUpdateProductMarkup(
                  product.productId,
                  parsed,
                  product.itemType || "product",
                );
              } else {
                setMarkupValue(String(product.markup || 0));
              }
            }}
            className="h-8"
          />
        </div>
      </div>
    </div>
  );
}
