import React from "react";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";

// Helper to estimate heights (in px, assuming 96DPI approx)
// A4 Height is ~1123px. We use a safe content area of ~1000px.
const PAGE_HEIGHT_PX = 1080;
const CONTENT_MARGIN_Y = 96; // 48px top + 48px bottom
const SAFE_HEIGHT = PAGE_HEIGHT_PX - CONTENT_MARGIN_Y;

const ESTIMATED_HEIGHTS = {
  HEADER: 150,
  SECTION_PADDING: 24,
  LINE_HEIGHT: 24,
  IMAGE_DEFAULT: 300,
  PRODUCT_HEADER: 80,
  PRODUCT_ROW: 250,
  TOTALS: 200,
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

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
}) => {
  // 1. Flatten all content into a measurable list
  const items: any[] = [];

  
  // 1. Check if there's an explicit "product-table" section
  const productSectionIndex = sections.findIndex(s => s.type === 'product-table');
  
  if (productSectionIndex !== -1) {
    // EXPLICIT MODE: Render sections, replacing the product-table section with actual products
    sections.forEach(section => {
        if (section.type === 'product-table') {
            // Render products here
             if (products.length > 0) {
                items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
                products.forEach((product, i) => {
                  let h = 150; 
                  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                     h += 200; 
                  }
                  if (product.productDescription && product.productDescription.length > 50) {
                    h += 20; 
                  }
                  items.push({
                    type: "product-row",
                    data: { ...product, index: i },
                    height: h,
                  });
                });
                items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
             }
        } else {
            // Render normal section
            let height = ESTIMATED_HEIGHTS.SECTION_PADDING;
            if (section.type === "text") {
              const lines = section.content.split("\n").length;
              height += lines * ESTIMATED_HEIGHTS.LINE_HEIGHT;
              // Add extra for margins
              if (section.styles.marginTop)
                height += parseInt(section.styles.marginTop as string) || 0;
              if (section.styles.marginBottom)
                height += parseInt(section.styles.marginBottom as string) || 0;
            } else if (section.type === "image") {
              height += ESTIMATED_HEIGHTS.IMAGE_DEFAULT;
            } else if (section.type === "divider") {
              height += 20;
            }
             items.push({
                type: "section",
                data: section,
                height: height
             });
        }
    });
  } else {
    // SMART FALLBACK MODE (Legacy behavior + Improvements)
    // Find a good spot for products: Before "Garantia", "Termos", "Obrigado" or "Considerações Finais"
    // OR if not found, after the Introduction (usually first text section)
    
    let insertIndex = -1;
    const footerKeywords = ["garantia", "termos", "condições", "considerações", "obrigado", "agradecemos", "validade"];
    
    // Check titles/content to find a footer section
    for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const text = (s.content || "").toLowerCase();
        if (footerKeywords.some(k => text.includes(k))) {
            insertIndex = i;
            break;
        }
    }
    
    // If no footer section found, put it after the first 2 sections (Header + Intro roughly)
    // Or if only 1 section, put it at end.
    if (insertIndex === -1) {
        insertIndex = sections.length > 1 ? 1 : sections.length;
    }

    // Iterate and insert
    for (let i = 0; i < sections.length; i++) {
        // If this is the insertion point, add products first
        if (i === insertIndex) {
             if (products.length > 0) {
                items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
                products.forEach((product, i) => {
                  let h = 150; 
                  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                     h += 200; 
                  }
                  if (product.productDescription && product.productDescription.length > 50) {
                    h += 20; 
                  }
                  items.push({
                    type: "product-row",
                    data: { ...product, index: i },
                    height: h,
                  });
                });
                items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
             }
        }
        
        // Add the section
        const section = sections[i];
        let height = ESTIMATED_HEIGHTS.SECTION_PADDING;
        if (section.type === "text") {
          const lines = section.content.split("\n").length;
          height += lines * ESTIMATED_HEIGHTS.LINE_HEIGHT;
          // Add extra for margins
          if (section.styles.marginTop)
            height += parseInt(section.styles.marginTop as string) || 0;
          if (section.styles.marginBottom)
            height += parseInt(section.styles.marginBottom as string) || 0;
        } else if (section.type === "image") {
          height += ESTIMATED_HEIGHTS.IMAGE_DEFAULT;
        } else if (section.type === "divider") {
          height += 20;
        }
         items.push({
            type: "section",
            data: section,
            height: height
         });
    }
    
    // If insertion point was at the very end
    if (insertIndex >= sections.length) {
         if (products.length > 0) {
            items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
            products.forEach((product, i) => {
                  let h = 150; 
                  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                     h += 200; 
                  }
                  if (product.productDescription && product.productDescription.length > 50) {
                    h += 20; 
                  }
              items.push({
                type: "product-row",
                data: { ...product, index: i },
                height: h,
              });
            });
            items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
         }
    }
  }

  // 2. Distribute into pages
  const pages: any[][] = [];
  let currentPage: any[] = [];
  let currentHeight = ESTIMATED_HEIGHTS.HEADER;

  items.forEach((item, index) => {
    let forceBreak = false;
    
    // Orphan Control: If we have a header/title, check if the NEXT item fits.
    // If not, break page now so header stays with content.
    if (item.type === "product-header" || (item.type === "section" && item.data.type === "title")) {
        const nextItem = items[index + 1];
        if (nextItem) {
            // Check if adding BOTH fits. If not, break.
            if (currentHeight + item.height + nextItem.height > SAFE_HEIGHT) {
                forceBreak = true;
            }
        }
    }

    if (forceBreak || currentHeight + item.height > SAFE_HEIGHT) {
      // Push current page
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 60; // Margin for next page top
    }
    currentPage.push(item);
    currentHeight += item.height;
  });

  // Push last page
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // Helper to render an item
  const renderItem = (item: any, pageIndex: number) => {
    switch (item.type) {
      case "section":
        return (
          <div
            key={item.data.id}
            style={{
              width: `${item.data.columnWidth || 100}%`,
              padding:
                item.data.columnWidth && item.data.columnWidth < 100
                  ? "0 8px"
                  : undefined,
              boxSizing: "border-box",
              // Inline styles from original
              marginTop: item.data.styles.marginTop,
              marginBottom: item.data.styles.marginBottom,
            }}
          >
            <div
              style={{
                fontSize: item.data.styles.fontSize,
                fontWeight: item.data.styles.fontWeight,
                fontStyle: item.data.styles.fontStyle,
                textAlign: item.data.styles.textAlign,
                color:
                  item.data.styles.color ||
                  (item.data.type === "title"
                    ? contentStyles.headerTitle?.color || primaryColor
                    : contentStyles.sectionText?.color),
                backgroundColor:
                  item.data.styles.backgroundColor === "transparent"
                    ? undefined
                    : item.data.styles.backgroundColor,
                padding:
                  item.data.styles.backgroundColor &&
                  item.data.styles.backgroundColor !== "transparent"
                    ? "12px"
                    : undefined,
                borderRadius:
                  item.data.styles.backgroundColor &&
                  item.data.styles.backgroundColor !== "transparent"
                    ? "8px"
                    : undefined,
              }}
            >
              {item.data.type === "divider" ? (
                <hr style={{ borderTop: `2px solid ${primaryColor}` }} />
              ) : item.data.type === "image" ? (
                <div
                  style={{ textAlign: item.data.styles.imageAlign || "center" }}
                >
                  {item.data.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.data.imageUrl}
                      alt=""
                      style={{
                        width: `${item.data.styles.imageWidth || 100}%`,
                        maxWidth: "100%",
                        borderRadius:
                          item.data.styles.imageBorderRadius || "8px",
                        border: item.data.styles.imageBorder
                          ? "2px solid #e5e7eb"
                          : "none",
                        display: "inline-block",
                      }}
                    />
                  )}
                  {item.data.content && (
                    <p className="text-sm text-gray-500 mt-2">
                      {item.data.content}
                    </p>
                  )}
                </div>
              ) : (
                item.data.content.split("\n").map((line: string, i: number) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < item.data.content.split("\n").length - 1 && <br />}
                  </React.Fragment>
                ))
              )}
            </div>
          </div>
        );
      case "product-header":
        return (
          <h2
            className="text-xl font-bold mb-4 pb-2 border-b-2 mt-4"
            style={contentStyles.productTitle}
          >
            Produtos e Serviços
          </h2>
        );
      case "product-row":
        const product = item.data;
        const i = product.index;
        return (
          <div
            className="flex flex-col gap-4 p-6 rounded-lg border mb-4 break-inside-avoid"
            style={
              i % 2 === 0
                ? contentStyles.productCardAlt
                : contentStyles.productCard
            }
          >
            {/* Image Row - Horizontal */}
            <div className="flex flex-row gap-4 overflow-hidden justify-center mb-4">
              {product.productImages && product.productImages.length > 0 ? (
                product.productImages.map((img: string, idx: number) => (
                  <div key={idx} className="w-48 h-48 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Product ${idx}`}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                ))
              ) : product.productImage ? (
                 <div className="w-48 h-48 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.productImage}
                      alt=""
                      className="w-full h-full object-contain p-2"
                    />
                   </div>
              ) : null}
            </div>

            {/* Content Column */}
            <div className="flex-1 flex flex-col gap-2">
              <div>
                <div className="mb-2">
                  <div className="flex justify-between items-start">
                    <span className="text-lg font-bold text-gray-900 leading-tight">
                      {product.productName}
                    </span>
                  </div>
                  
                  {/* Category/Manufacturer Badges - Moved here */}
                  {(product.category || product.manufacturer) && (
                    <div className="flex gap-2 mt-1">
                      {product.category && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                          {product.category}
                        </span>
                      )}
                      {product.manufacturer && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                          {product.manufacturer}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {product.productDescription && (
                  <div
                    className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed"
                    style={contentStyles.productSub}
                  >
                    {product.productDescription}
                  </div>
                )}
              </div>

              {/* Footer / Specs */}
              <div className="mt-4 pt-3 border-t flex justify-between items-end">
                 {/* Left side of footer (can be used for SKU or other info if needed) */}
                 <div className="text-sm text-gray-400">
                    {/* Placeholder for future SKU or code */}
                 </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">
                    {product.quantity} un. x {formatCurrency(product.unitPrice)}
                  </div>
                  <div className="text-lg font-bold whitespace-nowrap" style={contentStyles.total}>
                    {formatCurrency(product.total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "totals":
        const subtotal = products.reduce((sum, p) => sum + p.total, 0);
        const discountAmt = (subtotal * (proposal.discount || 0)) / 100;
        const total = subtotal - discountAmt;
        return (
          <div
            className="mt-4 pt-4 border-t-2 flex justify-end"
            style={contentStyles.headerBorder}
          >
            <div className="w-48 space-y-1 text-right">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {proposal.discount && proposal.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>-{formatCurrency(discountAmt)}</span>
                </div>
              )}
              <div
                className="flex justify-between text-xl font-bold pt-2 border-t"
                style={contentStyles.total}
              >
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
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
          className="pdf-page-container h-[297mm] w-[210mm] mx-auto relative bg-white shadow-sm mb-8 overflow-hidden"
          style={{ fontFamily, ...contentStyles.container }}
          data-page-index={pageIndex + 1}
        >
          {/* Theme Decorations */}
          <div className="absolute inset-0 pointer-events-none">
            {renderThemeDecorations()}
          </div>

          {/* Page Content Wrapper */}
          <div className="p-12 relative z-10 h-full flex flex-col">
            {/* Header */}
            {(pageIndex === 0 || repeatHeader) && (
              <div
                className="flex items-start justify-between border-b-2 pb-6 mb-4"
                style={contentStyles.headerBorder}
              >
                <div
                  className="text-2xl font-bold"
                  style={contentStyles.headerTitle}
                >
                  {tenant?.name}
                </div>
                <div
                  className="text-right text-sm"
                  style={contentStyles.headerSub}
                >
                  <div
                    className="font-semibold text-lg"
                    style={{ color: "inherit" }}
                  >
                    {coverTitle}
                  </div>
                  <div>{proposal.clientName}</div>
                </div>
              </div>
            )}

            {/* Items */}
            <div className="flex-1">
              {pageItems.map((item, idx) => (
                <React.Fragment key={idx}>
                  {renderItem(item, pageIndex)}
                </React.Fragment>
              ))}
            </div>

            {/* Page Number - Absolute Position */}
            <div className="absolute bottom-6 right-8 text-xs text-muted-foreground z-20">
              {pageIndex + 2}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
