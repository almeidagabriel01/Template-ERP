import React from "react";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";
import { formatCurrency } from "@/utils/format-utils";
import { cn } from "@/lib/utils";
import {
  ESTIMATED_HEIGHTS,
  ContentItem,
  calculateSectionHeight,
  calculateProductHeight,
  calculateSistemaBlockHeight
} from "@/utils/pdf-helpers";
import {
  PAGE_WIDTH_PX,
  PAGE_HEIGHT_PX,
  PADDING_X,
  PADDING_TOP,
  PADDING_BOTTOM,
  FOOTER_OFFSET,
  SAFE_HEIGHT_PX,
} from "@/utils/pdf-layout";
import {
  PdfSistemaBlock,
  PdfExtraProductsBlock,
  PdfProductRow,
  PdfTotals,
  PdfSectionRenderer,
  PdfPageHeader,
} from "./components";

interface RenderPagedContentProps {
  sections: PdfSection[];
  products: any[];
  fontFamily: string;
  contentStyles: any;
  primaryColor: string;
  renderThemeDecorations: () => React.ReactNode;
  tenant: any;
  coverTitle: string;
  proposal: any;
  repeatHeader?: boolean;
  pageNumberStart?: number;
  className?: string;
  noMargins?: boolean;
}

/**
 * Builds the list of content items from sections and products
 */
function buildContentItems(
  sections: PdfSection[],
  products: any[],
  proposal: any
): ContentItem[] {
  const items: ContentItem[] = [];
  const hasSistemas = proposal.sistemas && proposal.sistemas.length > 0;

  const addSistemaProducts = (sistema: any, productsForSistema: any[]) => {
    const sortedProducts = [...productsForSistema].sort((a: any, b: any) => {
      if (a.isExtra && !b.isExtra) return 1;
      if (!a.isExtra && b.isExtra) return -1;
      return 0;
    });

    const totalHeight = calculateSistemaBlockHeight(sortedProducts);

    items.push({
      type: "sistema-block",
      data: { sistema, products: sortedProducts },
      height: totalHeight,
    });
  };

  const addRegularProducts = (productsToAdd: any[]) => {
    if (productsToAdd.length > 0) {
      items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
      productsToAdd.forEach((product, i) => {
        const h = calculateProductHeight(product);
        items.push({
          type: "product-row",
          data: { ...product, index: i },
          height: h,
        });
      });
      items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
    }
  };

  const productSectionIndex = sections.findIndex(s => s.type === "product-table");

  if (productSectionIndex !== -1) {
    // Explicit mode: follow product-table placement
    sections.forEach(section => {
      if (section.type === "product-table") {
        if (hasSistemas) {
          proposal.sistemas.forEach((sistema: any) => {
            const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
            let productsForSistema = products.filter((p: any) => p.systemInstanceId === systemInstanceId);

            const isLegacy = !products.some((p: any) => p.systemInstanceId);
            if (productsForSistema.length === 0 && isLegacy) {
              productsForSistema = products.filter((p: any) => sistema.productIds?.includes(p.productId));
            }

            if (productsForSistema.length > 0) {
              addSistemaProducts(sistema, productsForSistema);
            }
          });

          const sistemaProductIds = new Set(
            proposal.sistemas.flatMap((s: any) => s.productIds || [])
          );
          const extraProducts = products.filter((p: any) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));

          if (extraProducts.length > 0) {
            let blockHeight = 140;
            extraProducts.forEach((product) => {
              let h = 80;
              if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                h += 100;
              }
              blockHeight += h;
            });
            blockHeight += 60;

            items.push({
              type: "extra-products-block",
              data: { products: extraProducts },
              height: blockHeight,
            });
          }
          items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
        } else {
          addRegularProducts(products);
        }
      } else {
        const height = calculateSectionHeight(section);
        items.push({ type: "section", data: section, height });
      }
    });
  } else {
    // Smart fallback: insert products near footer-like sections
    let insertIndex = -1;
    const footerKeywords = ["garantia", "termos", "condiÃ§Ãµes", "consideraÃ§Ãµes", "obrigado", "agradecemos", "validade"];

    for (let i = 0; i < sections.length; i++) {
      const text = (sections[i].content || "").toLowerCase();
      if (footerKeywords.some(k => text.includes(k))) {
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
          proposal.sistemas.forEach((sistema: any) => {
            const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
            let productsForSistema = products.filter((p: any) => p.systemInstanceId === systemInstanceId);

            const isLegacy = !products.some((p: any) => p.systemInstanceId);
            if (productsForSistema.length === 0 && isLegacy) {
              productsForSistema = products.filter((p: any) => sistema.productIds?.includes(p.productId));
            }

            if (productsForSistema.length > 0) {
              addSistemaProducts(sistema, productsForSistema);
            }
          });

          const sistemaProductIds = new Set(
            proposal.sistemas.flatMap((s: any) => s.productIds || [])
          );
          const extraProducts = products.filter((p: any) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));

          if (extraProducts.length > 0) {
            items.push({ type: "extra-products-header", height: 60 });
            extraProducts.forEach((product, idx) => {
              const h = calculateProductHeight(product);
              items.push({ type: "product-row", data: { ...product, index: idx }, height: h });
            });
          }
          items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
        } else if (products.length > 0) {
          addRegularProducts(products);
        }
      }

      const section = sections[i];
      const height = calculateSectionHeight(section);
      items.push({ type: "section", data: section, height });
    }

    if (insertIndex >= sections.length) {
      if (hasSistemas) {
        proposal.sistemas.forEach((sistema: any) => {
          const productsForSistema = products.filter((p: any) =>
            sistema.productIds?.includes(p.productId)
          );
          if (productsForSistema.length > 0) {
            addSistemaProducts(sistema, productsForSistema);
          }
        });
        items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
      } else if (products.length > 0) {
        addRegularProducts(products);
      }
    }
  }

  return items;
}

/**
 * Distributes content items across pages respecting height limits
 */
function distributeIntoPages(items: ContentItem[], repeatHeader: boolean = false): ContentItem[][] {
  const filtered = items.filter(item => item.type !== "extra-products-header");

  const pages: ContentItem[][] = [];
  let currentPage: ContentItem[] = [];
  // First page always has header
  let currentHeight = ESTIMATED_HEIGHTS.HEADER;

  filtered.forEach((item, index) => {
    let forceBreak = false;

    // Orphan Control
    if (item.type === "product-header" || (item.type === "section" && item.data?.type === "title")) {
      const nextItem = items[index + 1];
      if (nextItem && currentHeight + item.height + nextItem.height > SAFE_HEIGHT_PX) {
        forceBreak = true;
      }
    }

    // Keep blocks together
    if (item.type === "sistema-block" || item.type === "extra-products-block") {
      // Only break if it really doesn't fit, but try to respect the header space if applicable
      const startHeight = pages.length === 0 ? ESTIMATED_HEIGHTS.HEADER : (repeatHeader ? ESTIMATED_HEIGHTS.HEADER : 0);
      if (currentHeight + item.height > SAFE_HEIGHT_PX && currentHeight > startHeight) {
        forceBreak = true;
      }
    }

    if (forceBreak || currentHeight + item.height > SAFE_HEIGHT_PX) {
      if (currentPage.length > 0) {
        pages.push(currentPage);
      }
      currentPage = [];
      // Subsequent pages: only reserve header space if repeatHeader is true
      currentHeight = repeatHeader ? ESTIMATED_HEIGHTS.HEADER : 0;
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
  className,
  noMargins,
  pageNumberStart = 1,
}) => {
  const measureRef = React.useRef<HTMLDivElement | null>(null);

  // Build raw items (without relying on estimates for layout)
  const items = React.useMemo(() => buildContentItems(sections, products, proposal), [sections, products, proposal]);

  const [pages, setPages] = React.useState<ContentItem[][]>(() => distributeIntoPages(items, repeatHeader));

  React.useLayoutEffect(() => {
    if (!measureRef.current) return;

    const measureContainer = measureRef.current;
    let resizeObserver: ResizeObserver | null = null;

    const updateLayout = () => {
      if (!measureContainer) return;
      const nodes = Array.from(measureContainer.children) as HTMLElement[];
      const measuredHeights = nodes.map(n => n.getBoundingClientRect().height);

      // Check if heights are valid (non-zero) to avoid premature layout
      const hasValidHeights = measuredHeights.some(h => h > 0);
      if (!hasValidHeights && items.length > 0) return;

      const hydrated = items.map((item, idx) => ({
        ...item,
        height: measuredHeights[idx] > 0 ? measuredHeights[idx] : (item.height ?? 0)
      }));

      setPages(distributeIntoPages(hydrated, repeatHeader));
    };

    // Initial measure
    updateLayout();

    // Observe size changes (images loading, fonts, etc)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        // Debounce slightly or just update
        window.requestAnimationFrame(() => {
          updateLayout();
        });
      });

      Array.from(measureContainer.children).forEach(child => {
        resizeObserver?.observe(child);
      });
    }

    // Also listen for font loading
    document.fonts.ready.then(updateLayout);

    return () => {
      resizeObserver?.disconnect();
    };
  }, [items]);

  // Render a single item
  const renderItem = (item: ContentItem) => {
    switch (item.type) {
      case "section":
        return (
          <PdfSectionRenderer
            key={item.data.id}
            section={item.data}
            primaryColor={primaryColor}
            contentStyles={contentStyles}
          />
        );

      case "sistema-block":
        return (
          <PdfSistemaBlock
            key={`sistema-${item.data.sistema.sistemaId}-${item.data.sistema.ambienteId}`}
            sistema={item.data.sistema}
            products={item.data.products}
            primaryColor={primaryColor}
          />
        );

      case "extra-products-block":
        return (
          <PdfExtraProductsBlock
            key="extra-products"
            products={item.data.products}
            primaryColor={primaryColor}
          />
        );

      case "product-header":
        return (
          <h2
            key="product-header"
            className="text-xl font-bold mb-4 pb-2 border-b-2 mt-4"
            style={contentStyles.productTitle}
          >
            Produtos e ServiÃ§os
          </h2>
        );

      case "product-row":
        return (
          <PdfProductRow
            key={`product-${item.data.productId}-${item.data.index}`}
            product={item.data}
            index={item.data.index}
            contentStyles={contentStyles}
          />
        );

      case "totals":
        return (
          <PdfTotals
            key="totals"
            products={products}
            discount={proposal.discount || 0}
            contentStyles={contentStyles}
          />
        );

      case "extra-products-header":
        return null;

      default:
        return null;
    }
  };

  // Hidden measurement column (single flow) to derive real heights
  const contentInnerWidth = PAGE_WIDTH_PX - PADDING_X * 2;

  const contentTypes = new Set([
    "section",
    "product-header",
    "product-row",
    "totals",
    "sistema-block",
    "extra-products-block",
  ]);

  const visiblePages = pages.filter(pageItems =>
    pageItems.some(item => contentTypes.has(item.type))
  );

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          width: contentInnerWidth,
          padding: `${PADDING_TOP}px ${PADDING_X}px ${PADDING_BOTTOM}px`,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {items.map((item, idx) => (
          <div key={`measure-${idx}`}>
            {renderItem(item)}
          </div>
        ))}
      </div>

      {visiblePages.map((pageItems, pageIndex) => (
        <div
          key={pageIndex}
          className={cn(
            "pdf-page-container mx-auto relative bg-white shadow-sm mb-8 overflow-hidden box-border",
            className
          )}
          style={{
            fontFamily,
            ...contentStyles.container,
            width: `${PAGE_WIDTH_PX}px`,
            height: `${PAGE_HEIGHT_PX}px`,
            marginBottom: noMargins ? 0 : undefined,
            boxShadow: noMargins ? "none" : undefined,
            position: "relative", // Ensure absolute children are relative to this
          }}
          data-page-index={pageIndex + 1}
        >
          {/* Theme Decorations - Constrained to this page */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: "hidden",
              zIndex: 1,
            }}
          >
            {renderThemeDecorations()}
          </div>

          {/* Page Content */}
          <div
            className="relative z-10"
            style={{
              padding: `${PADDING_TOP}px ${PADDING_X}px 48px`,
              height: `${PAGE_HEIGHT_PX}px`,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            {(pageIndex === 0 || repeatHeader) && (
              <PdfPageHeader
                tenantName={tenant?.name}
                coverTitle={coverTitle}
                clientName={proposal.clientName}
                contentStyles={contentStyles}
              />
            )}

            {/* Items - Flex grow to fill available space */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {pageItems.map((item, idx) => (
                <React.Fragment key={idx}>
                  {renderItem(item)}
                </React.Fragment>
              ))}
            </div>

            {/* Page Number Footer - In normal flow */}
            <div
              className="text-xs text-muted-foreground"
              style={{ 
                display: "flex", 
                justifyContent: "flex-end",
                alignItems: "center",
                height: "24px",
                paddingTop: "8px",
                flexShrink: 0,
              }}
            >
              {pageNumberStart + pageIndex}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

