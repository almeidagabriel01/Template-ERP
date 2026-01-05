/**
 * Constants for PDF page layout and height estimation
 */

// A4 dimensions at 96 DPI
export const PAGE_HEIGHT_PX = 1080;
export const CONTENT_MARGIN_Y = 140; // Increased margin for safety (70px top + 70px bottom)
export const SAFE_HEIGHT = PAGE_HEIGHT_PX - CONTENT_MARGIN_Y;

// Estimated heights for different content types
export const ESTIMATED_HEIGHTS = {
  HEADER: 150,
  SECTION_PADDING: 24,
  LINE_HEIGHT: 28, // Increased line height estimation
  IMAGE_DEFAULT: 300,
  PRODUCT_HEADER: 80,
  PRODUCT_ROW: 250,
  TOTALS: 200,
};

/**
 * Content item types for rendering
 */
export type ContentItemType =
  | "section"
  | "sistema-block"
  | "extra-products-block"
  | "product-header"
  | "product-row"
  | "totals"
  | "sistema-header"
  | "extra-products-header"
  | "sistema-container-header"
  | "sistema-container-product"
  | "sistema-container-footer"
  | "sistema-extras-block";

export interface ContentItem {
  type: ContentItemType;
  data?: any;
  height: number;
}

/**
 * Calculate text section height based on content
 */
export function calculateSectionHeight(section: any): number {
  let height = ESTIMATED_HEIGHTS.SECTION_PADDING;
  
  if (section.type === "text") {
    // Improved estimation considering word wrapping
    const charCount = section.content?.length || 0;
    const charsPerLine = 90; // Conservative estimate for A4 width
    const estimatedWrapLines = Math.ceil(charCount / charsPerLine);
    const explicitLines = (section.content || "").split("\n").length;
    const totalLines = Math.max(estimatedWrapLines, explicitLines);

    height += totalLines * ESTIMATED_HEIGHTS.LINE_HEIGHT;
    
    if (section.styles?.marginTop) {
      height += parseInt(section.styles.marginTop as string) || 0;
    }
    if (section.styles?.marginBottom) {
      height += parseInt(section.styles.marginBottom as string) || 0;
    }
  } else if (section.type === "image") {
    height += ESTIMATED_HEIGHTS.IMAGE_DEFAULT;
  } else if (section.type === "divider") {
    height += 20;
  }
  
  return height;
}

/**
 * Calculate product row height based on images and description
 */
export function calculateProductHeight(product: any, baseHeight: number = 150): number {
  let height = baseHeight;
  
  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
    height += 200;
  }
  
  if (product.productDescription && product.productDescription.length > 50) {
    height += 20;
  }
  
  return height;
}

/**
 * Calculate sistema block height
 */
export function calculateSistemaBlockHeight(products: any[]): number {
  let totalHeight = 120; // Header height
  
  products.forEach((product) => {
    let h = 100;
    const imageCount = product.productImages?.length || (product.productImage ? 1 : 0);
    if (imageCount > 0) {
      h += 80;
    }
    totalHeight += h;
  });
  
  totalHeight += 80; // Footer height
  return totalHeight;
}
