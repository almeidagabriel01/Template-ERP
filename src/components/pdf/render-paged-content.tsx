import React from "react";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";
import {
  SAFE_HEIGHT,
  ESTIMATED_HEIGHTS,
  ContentItem,
  calculateSectionHeight,
  calculateProductHeight,
  calculateSistemaBlockHeight,
  calculatePaymentTermsHeight,
} from "@/utils/pdf-helpers";
import {
  PdfSistemaBlock,
  PdfSistemaHeader,
  PdfAmbienteHeader,
  PdfSistemaProduct,
  PdfSistemaFooter,
  PdfExtraProductsBlock,
  PdfProductRow,
  PdfTotals,
  PdfSectionRenderer,
  PdfPageHeader,
  PdfPaymentTerms,
} from "./components";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";

// Type definitions
interface Product {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isExtra?: boolean;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  systemInstanceId?: string;
}

interface Sistema {
  sistemaId: string;
  sistemaName: string;
  // Legacy fields (optional for backward compat)
  ambienteId?: string;
  ambienteName?: string;
  description?: string;
  productIds?: string[];
  // New multi-ambiente format
  ambientes?: {
    ambienteId: string;
    ambienteName: string;
    productIds?: string[];
  }[];
}

interface Proposal {
  sistemas?: Record<string, unknown>[];
  discount?: number;
  extraExpense?: number;
  clientName: string;
  title?: string;
  // Payment options
  downPaymentEnabled?: boolean;
  downPaymentValue?: number;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  downPaymentDueDate?: string;
  firstInstallmentDate?: string;
}

interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface ContentStyles {
  container: Record<string, string | number>;
  headerTitle: Record<string, string | number>;
  sectionText: Record<string, string | number>;
  productTitle: Record<string, string | number>;
  [key: string]: Record<string, string | number>;
}

interface RenderPagedContentProps {
  sections: PdfSection[];
  products: Product[];
  fontFamily: string;
  contentStyles: ContentStyles;
  primaryColor: string;
  renderThemeDecorations: () => React.ReactNode;
  tenant: Tenant | null;
  coverTitle: string;
  proposal: Proposal;
  repeatHeader?: boolean;
  pdfDisplaySettings?: PdfDisplaySettings;
}

/**
 * Builds the list of content items from sections and products
 */
function buildContentItems(
  sections: PdfSection[],
  products: Product[],
  proposal: Proposal,
  primaryColor: string,
  pdfDisplaySettings?: PdfDisplaySettings,
): ContentItem[] {
  const settings = {
    ...defaultPdfDisplaySettings,
    ...pdfDisplaySettings,
    primaryColor,
  };
  const items: ContentItem[] = [];
  const hasSistemas = proposal.sistemas && proposal.sistemas.length > 0;
  let hasAddedPaymentTerms = false;

  // Check if proposal has dynamic payment options configured
  const hasDynamicPaymentOptions =
    (proposal.installmentsEnabled &&
      proposal.installmentsCount &&
      proposal.installmentsCount >= 1) ||
    (proposal.downPaymentEnabled &&
      proposal.downPaymentValue &&
      proposal.downPaymentValue > 0);

  // Helper to add payment terms block
  const addPaymentTermsBlock = () => {
    if (hasDynamicPaymentOptions && !hasAddedPaymentTerms) {
      items.push({
        type: "payment-terms",
        height: calculatePaymentTermsHeight(
          !!(
            proposal.downPaymentEnabled &&
            proposal.downPaymentValue &&
            proposal.downPaymentValue > 0
          ),
          proposal.installmentsEnabled ? proposal.installmentsCount || 0 : 0,
        ),
      });
      hasAddedPaymentTerms = true;
    }
  };

  // Helper to check if a section is about payment terms and should be skipped
  const shouldSkipPaymentSection = (section: PdfSection): boolean => {
    if (!hasDynamicPaymentOptions) return false;
    const content = (section.content || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return (
      content.includes("condies de pagamento") ||
      content.includes("condicoes de pagamento") ||
      content.includes("formas de pagamento") ||
      content.includes("entrada:") ||
      content.includes("saldo:")
    );
  };

  const renderAllSistemas = () => {
    proposal.sistemas!.forEach((rawSistema: Record<string, unknown>) => {
      const sistema = rawSistema as unknown as Sistema;

      // Gather all products for this system across all environments
      let productsForSistema: Product[] = [];

      // Modern format: products have systemInstanceId
      productsForSistema = products.filter((p) =>
        p.systemInstanceId?.startsWith(`${sistema.sistemaId}-`),
      );

      // Fallback for legacy (no instanceId)
      if (productsForSistema.length === 0) {
        const legacyProductIds = sistema.productIds || [];
        const ambientProductIds =
          sistema.ambientes?.flatMap((a) => a.productIds || []) || [];
        const allIds = [
          ...new Set([...legacyProductIds, ...ambientProductIds]),
        ];

        productsForSistema = products.filter((p) =>
          allIds.includes(p.productId),
        );
      }

      if (productsForSistema.length > 0) {
        addSistemaProducts(sistema, productsForSistema);
      }
    });

    const sistemaProductIds = new Set(
      proposal.sistemas!.flatMap((s: Record<string, unknown>) => {
        const sistema = s as unknown as Sistema;
        if (sistema.ambientes && sistema.ambientes.length > 0) {
          return sistema.ambientes.flatMap((a) => a.productIds || []);
        }
        return (sistema.productIds as string[]) || [];
      }),
    );
    const extraProducts = products.filter(
      (p: Product) =>
        !p.systemInstanceId && !sistemaProductIds.has(p.productId),
    );

    if (extraProducts.length > 0) {
      // Logic for extra products block or header
      // For now, mirroring previous logic which used extra-products-block or flat list
      // The previous logic used extra-products-block in Loop 1 and extra-products-header in Loop 2.
      // We should unify. Let's use extra-products-block if possible, or header if split.
      // Actually, let's use the granular approach (header + rows) to align with page breaking.

      items.push({ type: "extra-products-header", height: 60 });
      extraProducts.forEach((product, idx) => {
        const h = calculateProductHeight(product, 80, settings);
        items.push({
          type: "product-row",
          data: { ...product, index: idx },
          height: h,
        });
      });
    }
    items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
    addPaymentTermsBlock();
  };

  // Helper to check if section is "Garantia"
  const isGarantiaSection = (section: PdfSection): boolean => {
    const content = (section.content || "").toLowerCase();
    return content.includes("garantia") && section.type === "title";
  };

  const addSistemaProducts = (
    sistema: Sistema,
    productsForSistema: Product[],
  ) => {
    // We need to organize products by environment for granular rendering
    const environments =
      sistema.ambientes && sistema.ambientes.length > 0
        ? sistema.ambientes
        : [
            {
              ambienteId: sistema.ambienteId || "",
              ambienteName: sistema.ambienteName || "",
            },
          ];

    // Calculate total height including all environments
    let totalHeight = 100; // Header
    totalHeight += 60; // Footer

    const envsWithProducts = environments
      .map((env) => {
        const currentInstanceId = `${sistema.sistemaId}-${env.ambienteId}`;
        let envProducts = productsForSistema.filter(
          (p) => p.systemInstanceId === currentInstanceId,
        );

        // Legacy fallback
        if (
          envProducts.length === 0 &&
          (!sistema.ambientes || sistema.ambientes.length === 0)
        ) {
          envProducts = productsForSistema;
        }

        const sortedProducts = [...envProducts].sort(
          (a: Product, b: Product) => {
            if (a.isExtra && !b.isExtra) return 1;
            if (!a.isExtra && b.isExtra) return -1;
            return 0;
          },
        );

        // Calculate height for this environment
        let envHeight = 0;
        if (sortedProducts.length > 0) {
          // Ambiente header height (approx 40px)
          envHeight += 40;
          // Products height
          envHeight +=
            calculateSistemaBlockHeight(sortedProducts, settings) - 60 - 100; // Subtract footer/header base from helper
        }

        return {
          env,
          products: sortedProducts,
          height: envHeight,
        };
      })
      .filter((group) => group.products.length > 0);

    totalHeight += envsWithProducts.reduce((sum, grp) => sum + grp.height, 0);

    // Threshold: if block would take more than 70% of page, split it
    const SPLIT_THRESHOLD = SAFE_HEIGHT * 0.7;

    if (totalHeight > SPLIT_THRESHOLD) {
      // Add sistema header
      items.push({
        type: "sistema-header",
        data: { sistema },
        height: 100,
      });

      // Add environments and their products
      envsWithProducts.forEach((group, index) => {
        // Add ambiente header
        items.push({
          type: "ambiente-header",
          data: {
            ambienteName: group.env.ambienteName,
            ambienteId: group.env.ambienteId,
            primaryColor: primaryColor,
            isFirst: index === 0,
          },
          height: 40,
        });

        // Add products
        group.products.forEach((product, idx) => {
          const productHeight = calculateProductHeight(product, 80, settings);
          items.push({
            type: "sistema-product",
            data: {
              product,
              sistema, // Parent sistema reference
              isFirst: idx === 0, // Visual separation if needed
              isLast: idx === group.products.length - 1,
              pdfDisplaySettings: settings,
            },
            height: productHeight,
          });
        });
      });

      // Add sistema footer
      const sistemaSubtotal = productsForSistema.reduce(
        (sum: number, p: Product) => sum + p.total,
        0,
      );
      items.push({
        type: "sistema-footer",
        data: { sistema, sistemaSubtotal, pdfDisplaySettings: settings },
        height: 60,
      });
    } else {
      // Small block - render as single nested unit
      // We pass ALL products; the component handles environment filtering internally
      items.push({
        type: "sistema-block",
        data: {
          sistema,
          products: productsForSistema,
          pdfDisplaySettings: settings,
        },
        height: totalHeight,
      });
    } // close else
  };

  const addRegularProducts = (productsToAdd: Product[]) => {
    if (productsToAdd.length > 0) {
      items.push({
        type: "product-header",
        height: ESTIMATED_HEIGHTS.PRODUCT_HEADER,
      });
      productsToAdd.forEach((product, i) => {
        const h = calculateProductHeight(product, 80, settings);
        items.push({
          type: "product-row",
          data: { ...product, index: i },
          height: h,
        });
      });
      items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
      addPaymentTermsBlock();
    }
  };

  const productSectionIndex = sections.findIndex(
    (s) => s.type === "product-table",
  );

  if (productSectionIndex !== -1) {
    sections.forEach((section) => {
      if (section.type === "product-table") {
        if (hasSistemas) {
          renderAllSistemas();
        } else {
          addRegularProducts(products);
        }
      } else {
        // Skip static payment sections if dynamic payment options are configured
        if (shouldSkipPaymentSection(section)) return;

        // Insert payment terms before "Garantia" if not already added
        if (isGarantiaSection(section)) {
          if (!hasAddedPaymentTerms) {
            addPaymentTermsBlock();
          }
        }

        const height = calculateSectionHeight(section);
        items.push({ type: "section", data: section, height });
      }
    });
  } else {
    let insertIndex = -1;
    const footerKeywords = [
      "garantia",
      "termos",
      "condies",
      "consideraes",
      "obrigado",
      "agradecemos",
      "validade",
    ];

    for (let i = 0; i < sections.length; i++) {
      const text = (sections[i].content || "").toLowerCase();
      if (footerKeywords.some((k) => text.includes(k))) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex === -1) {
      insertIndex = sections.length > 1 ? 1 : sections.length;
    }

    for (let i = 0; i < sections.length; i++) {
      if (i === insertIndex) {
        if (hasSistemas) {
          renderAllSistemas();
        } else if (products.length > 0) {
          addRegularProducts(products);
        }
      }

      const section = sections[i];

      // Skip static payment sections if dynamic payment options are configured
      // If this section is the payment terms placeholder, just skip it (since we added it after systems)
      if (shouldSkipPaymentSection(section)) {
        continue;
      }

      // Insert payment terms before "Garantia" ONLY if not already added
      // This is a safety fallback
      if (isGarantiaSection(section)) {
        if (!hasAddedPaymentTerms) {
          addPaymentTermsBlock();
        }
      }

      const height = calculateSectionHeight(section);
      items.push({ type: "section", data: section, height });
    }

    if (insertIndex >= sections.length) {
      if (hasSistemas) {
        renderAllSistemas();
        // items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS }); // handled in renderAllSistemas
      } else if (products.length > 0) {
        addRegularProducts(products);
      }
    }
  }

  return items;
}

/**
 * Distributes content items across pages
 */
function distributeIntoPages(items: ContentItem[]): ContentItem[][] {
  const pages: ContentItem[][] = [];
  let currentPage: ContentItem[] = [];
  let currentHeight = ESTIMATED_HEIGHTS.HEADER;

  items.forEach((item, index) => {
    let forceBreak = false;

    if (
      item.type === "product-header" ||
      (item.type === "section" && item.data?.type === "title")
    ) {
      const nextItem = items[index + 1];
      if (
        nextItem &&
        currentHeight + item.height + nextItem.height > SAFE_HEIGHT
      ) {
        forceBreak = true;
      }
    }

    if (item.type === "sistema-block" || item.type === "extra-products-block") {
      if (
        currentHeight + item.height > SAFE_HEIGHT &&
        currentHeight > ESTIMATED_HEIGHTS.HEADER
      ) {
        forceBreak = true;
      }
    }

    if (item.type === "payment-terms") {
      if (currentHeight + item.height > SAFE_HEIGHT) {
        forceBreak = true;
      }
    }

    if (forceBreak || currentHeight + item.height > SAFE_HEIGHT) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 60;
    }

    currentPage.push(item);
    currentHeight += item.height;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export const RenderPagedContent: React.FC<RenderPagedContentProps> = ({
  sections,
  products,
  fontFamily,
  contentStyles,
  primaryColor,
  renderThemeDecorations,
  tenant,
  coverTitle,
  proposal,
  repeatHeader,
  pdfDisplaySettings = defaultPdfDisplaySettings,
}) => {
  // Merge with defaults to ensure all settings have values
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };

  const items = buildContentItems(
    sections,
    products,
    proposal,
    primaryColor,
    settings,
  );
  const pages = distributeIntoPages(items);

  const renderItem = (item: ContentItem) => {
    switch (item.type) {
      case "section":
        return (
          <PdfSectionRenderer
            key={item.data.id}
            section={item.data}
            primaryColor={primaryColor}
            contentStyles={
              contentStyles as unknown as Record<string, React.CSSProperties>
            }
          />
        );

      case "sistema-block":
        return (
          <div
            key={`sistema-${item.data.sistema.sistemaId}-${item.data.sistema.ambienteId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaBlock
              sistema={item.data.sistema}
              products={item.data.products}
              primaryColor={primaryColor}
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "extra-products-block":
        return (
          <div key="extra-products" style={{ width: "100%" }}>
            <PdfExtraProductsBlock
              products={item.data.products}
              primaryColor={primaryColor}
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "product-header":
        return (
          <h2
            key="product-header"
            className="text-xl font-bold mb-4 pb-2 border-b-2 mt-4"
            style={{ ...contentStyles.productTitle, width: "100%" }}
          >
            Produtos e Servios
          </h2>
        );

      case "product-row":
        return (
          <div
            key={`product-${item.data.productId}-${item.data.index}`}
            style={{ width: "100%" }}
          >
            <PdfProductRow
              product={item.data}
              index={item.data.index}
              contentStyles={
                contentStyles as unknown as Record<string, React.CSSProperties>
              }
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "totals":
        return (
          <div key="totals" style={{ width: "100%" }}>
            <PdfTotals
              products={products}
              discount={proposal.discount || 0}
              extraExpense={proposal.extraExpense || 0}
              contentStyles={
                contentStyles as unknown as Record<string, React.CSSProperties>
              }
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "extra-products-header":
        return null;

      case "payment-terms":
        return (
          <div key="payment-terms" style={{ width: "100%" }}>
            <PdfPaymentTerms
              contentStyles={
                contentStyles as unknown as Record<string, React.CSSProperties>
              }
              downPaymentEnabled={proposal.downPaymentEnabled}
              downPaymentValue={proposal.downPaymentValue}
              installmentsEnabled={proposal.installmentsEnabled}
              installmentsCount={proposal.installmentsCount}
              installmentValue={proposal.installmentValue}
              downPaymentDueDate={proposal.downPaymentDueDate}
              firstInstallmentDate={proposal.firstInstallmentDate}
            />
          </div>
        );

      case "sistema-header":
        return (
          <div
            key={`sistema-header-${item.data.sistema.sistemaId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaHeader
              sistema={item.data.sistema}
              primaryColor={primaryColor}
            />
          </div>
        );

      case "ambiente-header":
        return (
          <div
            key={`ambiente-header-${item.data.ambienteId}`}
            style={{ width: "100%" }}
          >
            <PdfAmbienteHeader
              ambienteName={item.data.ambienteName}
              primaryColor={primaryColor}
              standalone={true}
            />
          </div>
        );

      case "sistema-product":
        const sistemaProductData = item.data as {
          product: Product;
          sistema: Sistema;
          isFirst: boolean;
          isLast: boolean;
        };
        return (
          <div
            key={`sistema-product-${sistemaProductData.sistema.sistemaId}-${sistemaProductData.product.productId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaProduct
              product={sistemaProductData.product}
              primaryColor={primaryColor}
              isFirst={sistemaProductData.isFirst}
              isLast={sistemaProductData.isLast}
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "sistema-footer":
        return (
          <div
            key={`sistema-footer-${item.data.sistema.sistemaId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaFooter
              sistemaSubtotal={item.data.sistemaSubtotal}
              primaryColor={primaryColor}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {pages.map((pageItems, pageIndex) => (
        <div
          key={pageIndex}
          className="mx-auto bg-white shadow-sm mb-8 pdf-page-container"
          style={{
            fontFamily,
            width: "210mm",
            height: "297mm",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          data-page-index={pageIndex + 1}
        >
          {/* Theme Decorations - Fixed to page */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            {renderThemeDecorations()}
          </div>

          {/* Content Area */}
          <div
            style={{
              position: "relative",
              zIndex: 10,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "48px",
              minHeight: 0,
            }}
          >
            {/* Header */}
            {(pageIndex === 0 || repeatHeader) && (
              <PdfPageHeader
                tenantName={tenant?.name || ""}
                coverTitle={coverTitle}
                clientName={proposal.clientName}
                contentStyles={
                  contentStyles as unknown as Record<
                    string,
                    React.CSSProperties
                  >
                }
              />
            )}

            {/* Main Content - Grows to fill space */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-start",
              }}
            >
              {pageItems.map((item, idx) => (
                <React.Fragment key={idx}>{renderItem(item)}</React.Fragment>
              ))}
            </div>

            {/* Footer - Always at bottom */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                paddingTop: "16px",
                fontSize: "12px",
                color: "#6b7280",
                flexShrink: 0,
              }}
            >
              {pageIndex + 2}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
