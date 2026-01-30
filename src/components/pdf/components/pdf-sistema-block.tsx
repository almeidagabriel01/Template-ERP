import React from "react";
import { formatCurrency } from "@/utils/format-utils";
import { getContrastTextColor } from "@/utils/color-utils";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";

interface PdfProduct {
  productId: string;
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isExtra?: boolean;
  systemInstanceId?: string;
}

interface PdfSistema {
  sistemaId: string;
  sistemaName: string;
  // Legacy fields (optional for backward compat)
  ambienteId?: string;
  ambienteName?: string;
  description?: string;
  ambientes?: {
    ambienteId: string;
    ambienteName: string;
  }[];
}

interface PdfSistemaBlockProps {
  sistema: PdfSistema;
  products: PdfProduct[];
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
}

/**
 * Renders a complete system block with header, products, and subtotal
 * Used for automation niche proposals
 */
export function PdfSistemaBlock({
  sistema,
  products,
  primaryColor,
  pdfDisplaySettings,
}: PdfSistemaBlockProps) {
  // Merge with defaults
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const sistemaSubtotal = products.reduce(
    (sum: number, p: PdfProduct) => sum + p.total,
    0,
  );

  return (
    <div className="mt-8 mb-6 break-inside-avoid">
      <div
        className="rounded-xl border-2 overflow-hidden"
        style={{ borderColor: primaryColor }}
      >
        {/* Header */}
        <div
          className="p-5"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)`,
            borderBottom: `2px solid ${primaryColor}30`,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              {/* Sistema Name - Primary Title */}
              <h3
                className="text-2xl font-bold mb-1"
                style={{ color: primaryColor }}
              >
                {sistema.sistemaName}
              </h3>
              {/* Ambiente Tags - Render all linked environments */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {(sistema.ambientes && sistema.ambientes.length > 0
                  ? sistema.ambientes
                  : [
                      {
                        ambienteName: sistema.ambienteName || "Ambiente",
                        ambienteId: sistema.ambienteId,
                      },
                    ]
                ).map((amb, i) => (
                  <span
                    key={`${amb.ambienteId}-${i}`}
                    className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}40`,
                    }}
                  >
                    📍 {amb.ambienteName}
                  </span>
                ))}
              </div>
              {sistema.description && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {sistema.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body: Ambientes & Products */}
        <div className="bg-white">
          {(sistema.ambientes && sistema.ambientes.length > 0
            ? sistema.ambientes
            : [
                {
                  ambienteName: sistema.ambienteName || "Ambiente",
                  ambienteId: sistema.ambienteId,
                },
              ]
          ).map((amb, index) => {
            const currentInstanceId = `${sistema.sistemaId}-${amb.ambienteId}`;

            // Filter products for this specific environment instance
            // If legacy (no instanceId on products), fallback to showing all products?
            // Actually, in legacy mode products don't have systemInstanceId.
            // But if we are in this block, we likely have new data.
            // Let's support both.
            let scopeProducts = products.filter(
              (p) => p.systemInstanceId === currentInstanceId,
            );

            // Fallback for legacy: if no products matches instanceId and this is the only environment, show all
            if (
              scopeProducts.length === 0 &&
              (!sistema.ambientes || sistema.ambientes.length === 0)
            ) {
              scopeProducts = products;
            }

            if (scopeProducts.length === 0) return null;

            return (
              <div key={currentInstanceId}>
                {/* Ambiente Header (Sub-container) - Only if we have multiple or specific design */}
                <PdfAmbienteHeader
                  ambienteName={amb.ambienteName || "Ambiente"}
                  primaryColor={primaryColor}
                  // Only show top border if not the first item
                  className={index > 0 ? "border-t border-dashed" : ""}
                />

                <div className="p-4 space-y-3">
                  {scopeProducts.map((product: PdfProduct, idx: number) => {
                    const allImages = product.productImages?.length
                      ? product.productImages
                      : product.productImage
                        ? [product.productImage]
                        : [];

                    return (
                      <div
                        key={`${product.productId}-${idx}`}
                        className="p-4 rounded-lg border"
                        style={{
                          backgroundColor: product.isExtra
                            ? "#eff6ff"
                            : idx % 2 === 0
                              ? "#f9fafb"
                              : "#ffffff",
                          borderColor: product.isExtra ? "#bfdbfe" : "#e5e7eb",
                        }}
                      >
                        {/* Product Images - conditionally rendered */}
                        {settings.showProductImages && allImages.length > 0 && (
                          <div className="flex gap-2 mb-3 justify-center flex-wrap">
                            {allImages.map((imgSrc: string, imgIdx: number) => (
                              <div
                                key={imgIdx}
                                className="w-20 h-20 bg-white rounded-lg border overflow-hidden shrink-0 shadow-sm"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imgSrc}
                                  alt=""
                                  className="w-full h-full object-contain p-1"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Product Info */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Product Name & Extra Tag - Unified SVG Strategy */
                            /* Uses canvas measurement to ensure consistent gap between Text and Badge */}
                            {product.isExtra ? (
                              (() => {
                                const text = product.productName;
                                // Use the exact font stack used in CSS: font-semibold (600) text-base (16px)
                                // We assume standard sans-serif fallback if 'Inter' isn't explicitly measuring similarly
                                const font =
                                  "600 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

                                // Helper inside scope or defined outside. Defining helper inline (or use the one we added if it was outside)
                                // Since I can't add function outside easily in this replace, I'll inline a safe check
                                const measure = (t: string, f: string) => {
                                  if (typeof document === "undefined")
                                    return t.length * 8;
                                  const c = document.createElement("canvas");
                                  const ctx = c.getContext("2d");
                                  if (!ctx) return t.length * 8;
                                  ctx.font = f;
                                  return ctx.measureText(t).width;
                                };

                                const textWidth = measure(text, font);
                                const badgeWidth = 60;
                                const gap = 16;
                                const totalWidth =
                                  textWidth + badgeWidth + gap + 4;

                                return (
                                  <svg
                                    width={totalWidth}
                                    height="24"
                                    style={{
                                      display: "block",
                                      overflow: "visible",
                                    }}
                                  >
                                    <text
                                      x="0"
                                      y="50%"
                                      dominantBaseline="central"
                                      fill="#111827"
                                      style={{
                                        fontSize: "16px",
                                        fontWeight: 600,
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      {text}
                                    </text>

                                    <g
                                      transform={`translate(${textWidth + gap}, 0)`}
                                    >
                                      <rect
                                        x="0"
                                        y="2"
                                        rx="4"
                                        ry="4"
                                        width={badgeWidth}
                                        height="20"
                                        fill="#dbeafe"
                                        stroke="#bfdbfe"
                                        strokeWidth="1"
                                      />
                                      <text
                                        x={badgeWidth / 2}
                                        y="50%" // Aligned same as title
                                        dominantBaseline="central"
                                        textAnchor="middle"
                                        fill="#1d4ed8"
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          textTransform: "uppercase",
                                          letterSpacing: "0.05em",
                                        }}
                                      >
                                        Extra
                                      </text>
                                    </g>
                                  </svg>
                                );
                              })()
                            ) : (
                              <h4 className="font-semibold text-gray-900 text-base leading-none m-0 p-0">
                                {product.productName}
                              </h4>
                            )}

                            {settings.showProductDescriptions &&
                              product.productDescription && (
                                <p className="text-xs text-gray-500">
                                  {product.productDescription}
                                </p>
                              )}
                          </div>

                          <div className="text-right shrink-0">
                            {settings.showProductPrices ? (
                              <div className="space-y-0.5">
                                <span className="text-xs text-gray-500 block">
                                  {product.quantity}x{" "}
                                  {formatCurrency(product.unitPrice)}
                                </span>
                                <span
                                  className="font-semibold text-sm"
                                  style={{ color: primaryColor }}
                                >
                                  {formatCurrency(product.total)}
                                </span>
                              </div>
                            ) : (
                              <span className="font-medium text-sm text-gray-600">
                                Qtd: {product.quantity}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Subtotal - conditionally rendered */}
          {settings.showSubtotals && (
            <div
              className="flex justify-between items-center pt-3 mt-2"
              style={{ borderTop: `2px dashed ${primaryColor}30` }}
            >
              <span className="font-semibold text-gray-700">
                Subtotal do Sistema:
              </span>
              <span
                className="text-xl font-bold"
                style={{ color: primaryColor }}
              >
                {formatCurrency(sistemaSubtotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders just the sistema header (for page-break splitting)
 */
export function PdfSistemaHeader({
  sistema,
  primaryColor,
  isFirstOnPage = false,
}: {
  sistema: PdfSistema;
  primaryColor: string;
  isFirstOnPage?: boolean;
}) {
  return (
    <div className="">
      <div
        className="rounded-t-xl border-2 border-b-0 overflow-hidden"
        style={{ borderColor: primaryColor }}
      >
        {/* Header */}
        <div
          className="p-5"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)`,
            borderBottom: `2px solid ${primaryColor}30`,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              {/* Sistema Name - Primary Title */}
              <h3
                className="text-2xl font-bold mb-1"
                style={{ color: primaryColor }}
              >
                {sistema.sistemaName}
              </h3>
              {/* Ambiente tag */}
              {(() => {
                const rawText = sistema.ambienteName || "Ambiente";
                const text = rawText.toUpperCase();
                const font = "600 10px ui-sans-serif, system-ui, sans-serif";

                const measure = (t: string, f: string) => {
                  if (typeof document === "undefined") return t.length * 7;
                  const c = document.createElement("canvas");
                  const ctx = c.getContext("2d");
                  if (!ctx) return t.length * 7;
                  ctx.font = f;
                  return ctx.measureText(t).width;
                };

                const measuredTextWidth = measure(text, font);
                const textWidth = measuredTextWidth * 1.05;
                const iconSize = 10;
                const iconGap = 3;
                const padding = 24;
                const contentWidth = iconSize + iconGap + textWidth;
                const svgWidth = Math.max(50, contentWidth + padding);
                const startX = (svgWidth - contentWidth) / 2 - 2;

                return (
                  <svg
                    className="ambiente-tag"
                    width={svgWidth}
                    height="18"
                    style={{
                      overflow: "visible",
                      display: "block",
                    }}
                  >
                    <rect
                      rx="9"
                      ry="9"
                      width={svgWidth}
                      height="18"
                      fill={`${primaryColor}20`}
                      stroke={`${primaryColor}40`}
                      strokeWidth="1"
                    />
                    <g transform={`translate(${startX}, 0)`}>
                      <g transform="translate(0, 4) scale(0.42)">
                        <path
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          fill={primaryColor}
                        />
                      </g>
                      <text
                        x={iconSize + iconGap}
                        y="50%"
                        dominantBaseline="central"
                        textAnchor="start"
                        fill={primaryColor}
                        style={{
                          fontSize: "0.625rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {text}
                      </text>
                    </g>
                  </svg>
                );
              })()}
              {sistema.description && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {sistema.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a single product within a sistema (for page-break splitting)
 */
export function PdfSistemaProduct({
  product,
  primaryColor,
  isFirst = false,

  pdfDisplaySettings,
}: {
  product: PdfProduct;
  primaryColor: string;
  isFirst?: boolean;
  isLast?: boolean;
  pdfDisplaySettings?: PdfDisplaySettings;
}) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const allImages = product.productImages?.length
    ? product.productImages
    : product.productImage
      ? [product.productImage]
      : [];

  return (
    <div
      className={`border-l-2 border-r-2 bg-white ${isFirst ? "pt-4" : ""}`}
      style={{ borderColor: primaryColor }}
    >
      <div className="px-4 pb-3">
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: product.isExtra ? "#eff6ff" : "#f9fafb",
            borderColor: product.isExtra ? "#bfdbfe" : "#e5e7eb",
          }}
        >
          {/* Product Images */}
          {settings.showProductImages && allImages.length > 0 && (
            <div className="flex gap-2 mb-3 justify-center flex-wrap">
              {allImages.map((imgSrc: string, imgIdx: number) => (
                <div
                  key={imgIdx}
                  className="w-20 h-20 bg-white rounded-lg border overflow-hidden flex-shrink-0 shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt=""
                    className="w-full h-full object-contain p-1"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Product Info */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              {product.isExtra ? (
                (() => {
                  const text = product.productName;
                  const font =
                    "600 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

                  const measure = (t: string, f: string) => {
                    if (typeof document === "undefined") return t.length * 8;
                    const c = document.createElement("canvas");
                    const ctx = c.getContext("2d");
                    if (!ctx) return t.length * 8;
                    ctx.font = f;
                    return ctx.measureText(t).width;
                  };

                  const textWidth = measure(text, font);
                  const badgeWidth = 60;
                  const gap = 16;
                  const totalWidth = textWidth + badgeWidth + gap + 4;

                  return (
                    <svg
                      width={totalWidth}
                      height="24"
                      style={{ display: "block", overflow: "visible" }}
                    >
                      <text
                        x="0"
                        y="50%"
                        dominantBaseline="central"
                        fill="#111827"
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          fontFamily: "inherit",
                        }}
                      >
                        {text}
                      </text>
                      <g transform={`translate(${textWidth + gap}, 0)`}>
                        <rect
                          x="0"
                          y="2"
                          rx="4"
                          ry="4"
                          width={badgeWidth}
                          height="20"
                          fill="#dbeafe"
                          stroke="#bfdbfe"
                          strokeWidth="1"
                        />
                        <text
                          x={badgeWidth / 2}
                          y="50%"
                          dominantBaseline="central"
                          textAnchor="middle"
                          fill="#1d4ed8"
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Extra
                        </text>
                      </g>
                    </svg>
                  );
                })()
              ) : (
                <h4 className="font-semibold text-gray-900 text-base leading-none m-0 p-0">
                  {product.productName}
                </h4>
              )}

              {settings.showProductDescriptions &&
                product.productDescription && (
                  <p className="text-xs text-gray-500">
                    {product.productDescription}
                  </p>
                )}
            </div>

            <div className="text-right flex-shrink-0">
              {settings.showProductPrices ? (
                <div className="space-y-0.5">
                  <span className="text-xs text-gray-500 block">
                    {product.quantity}x {formatCurrency(product.unitPrice)}
                  </span>
                  <span
                    className="font-semibold text-sm"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(product.total)}
                  </span>
                </div>
              ) : (
                <span className="font-medium text-sm text-gray-600">
                  Qtd: {product.quantity}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the sistema footer/subtotal (for page-break splitting)
 */
export function PdfSistemaFooter({
  sistemaSubtotal,
  primaryColor,
  pdfDisplaySettings,
}: {
  sistemaSubtotal: number;
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
}) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  return (
    <div
      className="rounded-b-xl border-2 border-t-0 overflow-hidden mb-4"
      style={{ borderColor: primaryColor }}
    >
      <div className="p-4 bg-white">
        {settings.showSubtotals && (
          <div
            className="flex justify-between items-center pt-3"
            style={{ borderTop: `2px dashed ${primaryColor}30` }}
          >
            <span className="font-semibold text-gray-700">
              Subtotal do Sistema:
            </span>
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              {formatCurrency(sistemaSubtotal)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
/**
 * Renders just the ambiente header (for page-break splitting)
 */
export function PdfAmbienteHeader({
  ambienteName,
  primaryColor,
  className = "",
  standalone = false,
}: {
  ambienteName: string;
  primaryColor: string;
  className?: string;
  standalone?: boolean;
}) {
  return (
    <div
      className={`px-5 pt-6 pb-2 bg-white ${className} ${
        standalone ? "border-l-2 border-r-2" : ""
      }`}
      style={{
        borderColor: primaryColor,
      }}
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className="h-px flex-1"
          style={{ backgroundColor: `${primaryColor}20` }}
        />
        <span
          className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border"
          style={{
            backgroundColor: `${primaryColor}05`,
            color: primaryColor,
            borderColor: `${primaryColor}30`,
          }}
        >
          📍 {ambienteName}
        </span>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: `${primaryColor}20` }}
        />
      </div>
    </div>
  );
}
