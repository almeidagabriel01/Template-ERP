import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from "@/utils/pdf-layout";
import {
  extractConcreteFontFamilies,
  normalizePdfFontFamily,
} from "@/services/pdf/pdf-fonts";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const DEFAULT_SCALE = 2;
const FORCED_HTML2CANVAS_SCALE = 2;
const FONT_READY_TIMEOUT_MS = 8000;
const IMAGE_DECODE_TIMEOUT_MS = 10000;

type PdfSourceLabel = "download" | "view" | "edit-preview" | "shared";

interface CaptureDomPreparation {
  root: HTMLElement;
  cleanup: () => void;
}

interface FontRequirement {
  family: string;
  weight: number;
  style: "normal" | "italic";
}

interface ImageDebugEntry {
  index: number;
  src: string;
  currentSrc: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  loading: string;
  decodeStatus?: "ok" | "error" | "timeout";
  isDataUrl: boolean;
  isBlobUrl: boolean;
  isProxyUrl: boolean;
  captureSource?: string;
}

interface ImageLoadResult {
  totalImages: number;
  decodedImages: number;
  failedImages: number;
  proxiedImagesCount: number;
  proxiedBackgroundImagesCount: number;
  directRemoteImageRequestsCount: number;
  waitMs: number;
  before: ImageDebugEntry[];
  after: ImageDebugEntry[];
  cleanup: () => void;
}

interface ColorNormalizationResult {
  normalizedColorsCount: number;
  remainingUnsupportedColorCount: number;
  cleanup: () => void;
}

interface CloneCapturePreparationStats {
  captureTargetSelector: string;
  captureTargetSnippet: string;
  captureTargetRect: ElementRectSnapshot | null;
  captureTargetPages: Array<{ pageIndex: string; rect: ElementRectSnapshot | null; scrollWidth: number; scrollHeight: number }>;
  visibleNodeCount: number;
  totalImages: number;
  decodedImages: number;
  failedImages: number;
  proxiedImagesCount: number;
  proxiedBackgroundImagesCount: number;
  directRemoteImageRequestsCount: number;
  unsupportedColorHitsByProperty: Record<string, number>;
  unsupportedColorElementsCount: number;
  bgModernFlaggedCount: number;
  globalOverridesApplied: boolean;
  normalizedColorsCount: number;
  remainingUnsupportedColorCount: number;
  imageWaitMs: number;
}

interface OriginalImageSnapshot {
  index: number;
  src: string;
  srcset: string;
  sizes: string;
  loading: string;
  decoding: string;
  crossOrigin: string | null;
}

interface TextLayoutSample {
  index: number;
  tag: string;
  className: string;
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface LayoutSnapshot {
  scrollHeight: number;
  scrollWidth: number;
  samples: TextLayoutSample[];
}

interface TextDebugComputedStyle {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  fontStretch: string;
  fontKerning: string;
  fontFeatureSettings: string;
  fontVariantLigatures: string;
  letterSpacing: string;
  wordSpacing: string;
  textRendering: string;
  whiteSpace: string;
  wordBreak: string;
}

interface TextDebugAncestorTransform {
  depth: number;
  tag: string;
  className: string;
  transform: string;
  zoom: string;
}

interface TextDebugSample {
  key: string;
  text: string;
  textShort: string;
  tag: string;
  className: string;
  transform: string;
  zoom: string;
  computed: TextDebugComputedStyle;
  ancestors: TextDebugAncestorTransform[];
}

interface ElementRectSnapshot {
  width: number;
  height: number;
  x: number;
  y: number;
  offsetTop: number;
  offsetLeft: number;
  offsetWidth: number;
  offsetHeight: number;
}

interface ElementStyleSnapshot {
  [key: string]: string;
}

interface ProductRowDiagnostic {
  key: string;
  found: boolean;
  titleWrapperText: string;
  titleText: string;
  qtyText: string;
  extraTagText: string;
  rowRect: ElementRectSnapshot | null;
  titleWrapperRect: ElementRectSnapshot | null;
  titleTextRect: ElementRectSnapshot | null;
  qtyRect: ElementRectSnapshot | null;
  extraTagRect: ElementRectSnapshot | null;
  rowComputed: ElementStyleSnapshot | null;
  titleWrapperComputed: ElementStyleSnapshot | null;
  titleTextComputed: ElementStyleSnapshot | null;
  qtyComputed: ElementStyleSnapshot | null;
  extraTagComputed: ElementStyleSnapshot | null;
}

export interface RenderToPdfOptions {
  rootElement: HTMLElement;
  rootHint?: string;
  proposalTitle?: string;
  tenantId?: string;
  sourceLabel?: PdfSourceLabel;
  apiBaseUrl?: string;
  scale?: number;
}

export interface RenderToPdfResult {
  blob: Blob;
  arrayBuffer: ArrayBuffer;
  filename: string;
  pageCount: number;
  canvasSizes: Array<{ width: number; height: number }>;
  blobSize: number;
  hashHex: string;
  metrics: {
    sourceLabel: PdfSourceLabel;
    rootHint: string;
    rootDescriptor: string;
    pageElementsCount: number;
    rootImagesCount: number;
    fontsReadyMs: number;
    fontsTimeout: boolean;
    fontRequirements: FontRequirement[];
    totalImages: number;
    decodedImages: number;
    failedImages: number;
    proxiedImagesCount: number;
    proxiedBackgroundImagesCount: number;
    directRemoteImageRequestsCount: number;
    unsupportedColorHitsByProperty: Record<string, number>;
    unsupportedColorElementsCount: number;
    bgModernFlaggedCount: number;
    globalOverridesApplied: boolean;
    normalizedColorsCount: number;
    remainingUnsupportedColorCount: number;
    blankCanvasPages: number;
    imageWaitMs: number;
    durationMs: number;
  };
}

type DebugLogger = (message: string, payload?: unknown) => void;

const CAPTURE_MODE_CLASS = "pdf-capture-mode";
const CAPTURE_TARGET_ATTR = "data-pdf-capture-target";
const TRANSPARENT_PIXEL_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";
const CAPTURE_FONT_VARIABLES = [
  "--font-pdf-inter",
  "--font-pdf-roboto",
  "--font-pdf-lato",
  "--font-pdf-montserrat",
  "--font-pdf-playfair",
] as const;
const MODERN_COLOR_FUNCTION_RE = /\b(?:lab|oklab|lch|oklch|color-mix)\(/i;
const MODERN_BG_ATTRIBUTE = "data-pdf-bg-modern";
const MODERN_BG_STYLE_ATTRIBUTE = "data-pdf-modern-bg-style";
const COLOR_SANITIZE_PROPERTIES = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "filter",
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
] as const;
const COLOR_STYLE_FIELDS = [
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
] as const;

const PRODUCT_LAYOUT_DEBUG_MAX_ITEMS = 10;

const ROW_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "flex",
  "alignItems",
  "justifyContent",
  "gap",
  "fontSize",
  "lineHeight",
  "boxSizing",
  "whiteSpace",
  "minWidth",
  "maxWidth",
  "textAlign",
  "position",
  "flexBasis",
  "flexShrink",
  "overflow",
  "top",
  "right",
  "marginTop",
  "paddingTop",
] as const;

const TITLE_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "flex",
  "flexBasis",
  "flexShrink",
  "alignItems",
  "justifyContent",
  "gap",
  "fontSize",
  "lineHeight",
  "verticalAlign",
  "position",
  "top",
  "right",
  "marginTop",
  "paddingTop",
  "transform",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "hyphens",
] as const;

const TITLE_TEXT_DEBUG_STYLE_FIELDS = [
  "display",
  "fontSize",
  "lineHeight",
  "fontWeight",
  "fontStyle",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "verticalAlign",
  "marginTop",
  "paddingTop",
  "paddingBottom",
] as const;

const QTY_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "fontSize",
  "alignItems",
  "justifyContent",
  "gap",
  "lineHeight",
  "verticalAlign",
  "whiteSpace",
  "maxWidth",
  "textAlign",
  "position",
  "top",
  "right",
  "marginTop",
  "paddingTop",
  "flex",
  "flexBasis",
  "flexShrink",
  "minWidth",
] as const;

const EXTRA_TAG_DEBUG_STYLE_FIELDS = [
  "display",
  "flexDirection",
  "flex",
  "flexBasis",
  "flexShrink",
  "alignItems",
  "justifyContent",
  "gap",
  "fontSize",
  "height",
  "verticalAlign",
  "lineHeight",
  "position",
  "top",
  "right",
  "whiteSpace",
  "marginTop",
  "paddingTop",
  "paddingBottom",
  "transform",
] as const;

function getApiBaseUrl(rawApiBaseUrl?: string): string {
  const apiUrl = rawApiBaseUrl || process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not defined.");
  }
  return apiUrl;
}

function getPdfDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.search.includes("pdfDebug=1");
}

function createDebugLogger(): DebugLogger {
  const enabled = getPdfDebugEnabled() && process.env.NODE_ENV === "development";
  return (message, payload) => {
    if (!enabled) return;
    if (payload === undefined) {
      console.debug(`[pdf-debug] ${message}`);
    } else {
      console.debug(`[pdf-debug] ${message}`, payload);
    }
  };
}

function slugify(value?: string): string {
  return (value || "comercial")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildProposalPdfFilename(title?: string): string {
  return `proposta-${slugify(title)}.pdf`;
}

function containsModernColor(value: string): boolean {
  return /(lab|oklch|oklab|lch|color)\(/i.test(value);
}

function safeCssColor(
  input: string,
  canvasCtx: CanvasRenderingContext2D | null,
  propertyName: string,
): string {
  if (!input || input === "none") return input;
  if (input === "transparent") return "transparent";
  if (input.startsWith("#") || input.startsWith("rgb")) return input;
  if (!canvasCtx) return propertyName === "color" ? "#000000" : "transparent";

  try {
    canvasCtx.clearRect(0, 0, 1, 1);
    canvasCtx.fillStyle = input;
    canvasCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data;
    if (a === 0 && propertyName === "color") return "#000000";
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  } catch {
    return propertyName === "color" ? "#000000" : "transparent";
  }
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function normalizeWeight(value: string): number {
  const lowered = value.trim().toLowerCase();
  if (lowered === "normal") return 400;
  if (lowered === "bold") return 700;
  const parsed = Number.parseInt(lowered, 10);
  if (Number.isFinite(parsed)) return parsed;
  return 400;
}

function normalizeStyle(value: string): "normal" | "italic" {
  return value.trim().toLowerCase() === "italic" ? "italic" : "normal";
}

function hasUnsupportedColorFunction(value: string): boolean {
  return MODERN_COLOR_FUNCTION_RE.test((value || "").toLowerCase());
}

function isHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isCrossOriginHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isHttp && parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function buildProxyImageUrl(
  rawUrl: string,
  options: { apiBaseUrl: string; tenantId?: string; disableCache: boolean; index?: number },
): string {
  if (rawUrl.includes("/v1/aux/proxy-image")) {
    return rawUrl;
  }

  const params = new URLSearchParams({
    tenantId: options.tenantId || "",
    url: rawUrl,
    capture: "1",
  });

  if (options.disableCache) {
    params.set("noStore", "1");
    params.set("cb", `${Date.now()}-${options.index || 0}`);
  }

  return `${options.apiBaseUrl}/v1/aux/proxy-image?${params.toString()}`;
}

function replaceBackgroundUrlsWithProxy(
  backgroundValue: string,
  options: { apiBaseUrl: string; tenantId?: string; disableCache: boolean },
): { value: string; replacedCount: number } {
  if (!backgroundValue || !backgroundValue.includes("url(")) {
    return { value: backgroundValue, replacedCount: 0 };
  }

  const backgroundUrlRegex = /url\((['"]?)(.*?)\1\)/gi;
  let replacedCount = 0;
  const value = backgroundValue.replace(
    backgroundUrlRegex,
    (_fullMatch, quote: string, urlValue: string) => {
      const rawUrl = (urlValue || "").trim();
      if (
        !rawUrl ||
        rawUrl.startsWith("data:") ||
        rawUrl.startsWith("blob:") ||
        rawUrl.startsWith("about:")
      ) {
        return `url(${quote || ""}${rawUrl}${quote || ""})`;
      }

      if (!isCrossOriginHttpUrl(rawUrl)) {
        return `url(${quote || ""}${rawUrl}${quote || ""})`;
      }

      replacedCount += 1;
      const proxied = buildProxyImageUrl(rawUrl, {
        ...options,
        index: replacedCount,
      });
      return `url("${proxied}")`;
    },
  );

  return { value, replacedCount };
}

function hasUnsupportedColorFunctionInValue(value: string): boolean {
  return hasUnsupportedColorFunction(value || "");
}

function buildUnsupportedColorFunctionFlags(value: string): {
  hasAny: boolean;
  hasLab: boolean;
  hasOklab: boolean;
  hasLch: boolean;
  hasOklch: boolean;
  hasColorMix: boolean;
} {
  const safeValue = value || "";
  return {
    hasAny: hasUnsupportedColorFunctionInValue(safeValue),
    hasLab: /\blab\(/i.test(safeValue),
    hasOklab: /\boklab\(/i.test(safeValue),
    hasLch: /\blch\(/i.test(safeValue),
    hasOklch: /\boklch\(/i.test(safeValue),
    hasColorMix: /\bcolor-mix\(/i.test(safeValue),
  };
}

function incrementHitCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] || 0) + 1;
}

function resolveCssPropertyInClone(
  resolver: HTMLElement,
  view: Window,
  propertyName: string,
  rawValue: string,
): string | null {
  if (!rawValue) return null;
  resolver.style.setProperty(propertyName, "");
  resolver.style.setProperty(propertyName, rawValue);
  const resolved = view.getComputedStyle(resolver).getPropertyValue(propertyName);
  if (!resolved) return null;
  if (hasUnsupportedColorFunctionInValue(resolved)) return null;
  return resolved.trim();
}

function getCloneElementNodes(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll("*"))];
}

function getInlineStyleDeclaration(node: Element): CSSStyleDeclaration | null {
  const maybeStyle = node as Element & { style?: CSSStyleDeclaration };
  return maybeStyle.style || null;
}

function getElementClassNameForDiagnostics(node: Element): string {
  const className = (node as Element & { className?: unknown }).className;
  if (typeof className === "string") return className;
  if (className && typeof className === "object" && "baseVal" in className) {
    const baseVal = (className as { baseVal?: unknown }).baseVal;
    return typeof baseVal === "string" ? baseVal : "";
  }
  return "";
}

function getSafeColorFallback(propertyName: string): string {
  if (propertyName === "color" || propertyName === "fill" || propertyName === "stroke") {
    return "rgb(0, 0, 0)";
  }
  return "transparent";
}

function sanitizeInlineStylePropertiesInClone(
  inlineStyle: CSSStyleDeclaration,
  resolver: HTMLElement,
  view: Window,
): number {
  let normalizedCount = 0;
  const propertyNames: string[] = [];
  for (let index = 0; index < inlineStyle.length; index += 1) {
    const propertyName = inlineStyle.item(index);
    if (propertyName) propertyNames.push(propertyName);
  }

  propertyNames.forEach((propertyName) => {
    const value = inlineStyle.getPropertyValue(propertyName);
    if (!hasUnsupportedColorFunctionInValue(value)) return;

    if (propertyName.startsWith("--")) {
      inlineStyle.removeProperty(propertyName);
      normalizedCount += 1;
      return;
    }

    const resolved = resolveCssPropertyInClone(resolver, view, propertyName, value);
    if (resolved) {
      inlineStyle.setProperty(propertyName, resolved, "important");
      normalizedCount += 1;
      return;
    }

    if (propertyName.includes("background")) {
      inlineStyle.setProperty("background", "none", "important");
      inlineStyle.setProperty("background-color", "rgb(255, 255, 255)", "important");
      normalizedCount += 1;
      return;
    }
    if (propertyName.includes("border")) {
      inlineStyle.setProperty("border-color", "rgb(0, 0, 0)", "important");
      normalizedCount += 1;
      return;
    }
    if (propertyName === "box-shadow" || propertyName === "filter") {
      inlineStyle.setProperty(propertyName, "none", "important");
      normalizedCount += 1;
      return;
    }

    inlineStyle.setProperty(propertyName, getSafeColorFallback(propertyName), "important");
    normalizedCount += 1;
  });

  return normalizedCount;
}

function sanitizeUnsupportedColorAttributesInClone(
  node: Element,
  resolver: HTMLElement,
  view: Window,
): number {
  let normalizedCount = 0;
  const inlineStyle = getInlineStyleDeclaration(node);
  const colorAttributeFallbacks: Record<string, string> = {
    color: "rgb(0, 0, 0)",
    fill: "rgb(0, 0, 0)",
    stroke: "rgb(0, 0, 0)",
    "stop-color": "rgb(0, 0, 0)",
    "flood-color": "rgb(0, 0, 0)",
    "lighting-color": "rgb(0, 0, 0)",
  };

  Object.entries(colorAttributeFallbacks).forEach(([attributeName, fallbackValue]) => {
    const rawValue = node.getAttribute(attributeName) || "";
    if (!hasUnsupportedColorFunctionInValue(rawValue)) return;
    node.setAttribute(attributeName, fallbackValue);
    inlineStyle?.setProperty(attributeName, fallbackValue, "important");
    normalizedCount += 1;
  });

  if (inlineStyle) {
    normalizedCount += sanitizeInlineStylePropertiesInClone(inlineStyle, resolver, view);
  }

  return normalizedCount;
}

function countUnsupportedColorValuesInClone(root: HTMLElement, view: Window): number {
  const nodes = getCloneElementNodes(root);
  let count = 0;
  nodes.forEach((node) => {
    const computed = view.getComputedStyle(node);
    COLOR_SANITIZE_PROPERTIES.forEach((propertyName) => {
      const value = computed.getPropertyValue(propertyName);
      if (hasUnsupportedColorFunctionInValue(value)) {
        count += 1;
      }
    });

    const computedBackground = computed.getPropertyValue("background");
    if (hasUnsupportedColorFunctionInValue(computedBackground)) {
      count += 1;
    }

    const computedBackgroundImage = computed.getPropertyValue("background-image");
    if (hasUnsupportedColorFunctionInValue(computedBackgroundImage)) {
      count += 1;
    }

    const computedBorder = computed.getPropertyValue("border");
    if (hasUnsupportedColorFunctionInValue(computedBorder)) {
      count += 1;
    }

    const inlineStyle = getInlineStyleDeclaration(node);
    const inlineBackground = inlineStyle?.getPropertyValue("background") || "";
    if (hasUnsupportedColorFunctionInValue(inlineBackground)) {
      count += 1;
    }

    const inlineBorder = inlineStyle?.getPropertyValue("border") || "";
    if (hasUnsupportedColorFunctionInValue(inlineBorder)) {
      count += 1;
    }

    const styleAttribute = node.getAttribute("style") || "";
    if (hasUnsupportedColorFunctionInValue(styleAttribute)) {
      count += 1;
    }

    ["color", "fill", "stroke", "stop-color", "flood-color", "lighting-color"].forEach(
      (attributeName) => {
        const attributeValue = node.getAttribute(attributeName) || "";
        if (hasUnsupportedColorFunctionInValue(attributeValue)) {
          count += 1;
        }
      },
    );
  });
  return count;
}

function collectUnsupportedColorEntriesInClone(
  root: HTMLElement,
  view: Window,
  limit = 10,
): { totalCount: number; samples: Array<{ tag: string; className: string; property: string; value: string }> } {
  const nodes = getCloneElementNodes(root);
  const propertiesToCheck = [
    ...COLOR_SANITIZE_PROPERTIES,
    "background",
    "background-image",
    "border",
  ];
  let totalCount = 0;
  const samples: Array<{ tag: string; className: string; property: string; value: string }> = [];

  nodes.forEach((node) => {
    const computed = view.getComputedStyle(node);
    propertiesToCheck.forEach((propertyName) => {
      const value = computed.getPropertyValue(propertyName);
      if (!hasUnsupportedColorFunctionInValue(value)) return;
      totalCount += 1;
      if (samples.length < limit) {
        samples.push({
          tag: node.tagName.toLowerCase(),
          className: getElementClassNameForDiagnostics(node),
          property: propertyName,
          value,
        });
      }
    });
  });

  return { totalCount, samples };
}

function sanitizeUnsupportedColorsInClone(
  clonedDoc: Document,
  root: HTMLElement,
): {
  unsupportedColorHitsByProperty: Record<string, number>;
  unsupportedColorElementsCount: number;
  bgModernFlaggedCount: number;
  globalOverridesApplied: boolean;
  normalizedColorsCount: number;
  remainingUnsupportedColorCount: number;
} {
  const view = clonedDoc.defaultView;
  if (!view) {
    return {
      unsupportedColorHitsByProperty: {},
      unsupportedColorElementsCount: 0,
      bgModernFlaggedCount: 0,
      globalOverridesApplied: false,
      normalizedColorsCount: 0,
      remainingUnsupportedColorCount: 0,
    };
  }

  const resolver = clonedDoc.createElement("span");
  resolver.style.position = "fixed";
  resolver.style.left = "-99999px";
  resolver.style.top = "-99999px";
  resolver.style.visibility = "hidden";
  resolver.style.pointerEvents = "none";
  resolver.style.width = "0";
  resolver.style.height = "0";
  clonedDoc.body.appendChild(resolver);

  const unsupportedColorHitsByProperty: Record<string, number> = {};
  const affectedElements = new Set<Element>();
  let bgModernFlaggedCount = 0;
  const globalOverridesApplied = false;
  let normalizedColorsCount = 0;

  const nodes = getCloneElementNodes(root);
  nodes.forEach((node) => {
    const computed = view.getComputedStyle(node);
    const inlineStyle = getInlineStyleDeclaration(node);
    normalizedColorsCount += sanitizeUnsupportedColorAttributesInClone(node, resolver, view);
    COLOR_SANITIZE_PROPERTIES.forEach((propertyName) => {
      const value = computed.getPropertyValue(propertyName);
      if (!hasUnsupportedColorFunctionInValue(value)) return;

      incrementHitCounter(unsupportedColorHitsByProperty, propertyName);
      affectedElements.add(node);
      const resolved = resolveCssPropertyInClone(resolver, view, propertyName, value);

      if (resolved) {
        inlineStyle?.setProperty(propertyName, resolved, "important");
      } else if (propertyName === "box-shadow" || propertyName === "filter") {
        inlineStyle?.setProperty(propertyName, "none", "important");
      } else if (propertyName === "color") {
        inlineStyle?.setProperty(propertyName, "rgb(0, 0, 0)", "important");
      } else {
        inlineStyle?.setProperty(propertyName, "transparent", "important");
      }
      normalizedColorsCount += 1;
    });

    const computedBackground = computed.getPropertyValue("background");
    if (hasUnsupportedColorFunctionInValue(computedBackground)) {
      incrementHitCounter(unsupportedColorHitsByProperty, "background");
      affectedElements.add(node);
      inlineStyle?.setProperty("background", "none", "important");
      const fallbackBg = resolveCssPropertyInClone(
        resolver,
        view,
        "background-color",
        computed.getPropertyValue("background-color"),
      );
      inlineStyle?.setProperty("background-color", fallbackBg || "rgb(255, 255, 255)", "important");
      normalizedColorsCount += 1;
    }

    const inlineBackground = inlineStyle?.getPropertyValue("background") || "";
    if (hasUnsupportedColorFunctionInValue(inlineBackground)) {
      incrementHitCounter(unsupportedColorHitsByProperty, "background");
      affectedElements.add(node);
      inlineStyle?.setProperty("background", "none", "important");
      const fallbackBg = resolveCssPropertyInClone(
        resolver,
        view,
        "background-color",
        computed.getPropertyValue("background-color"),
      );
      inlineStyle?.setProperty("background-color", fallbackBg || "rgb(255, 255, 255)", "important");
      normalizedColorsCount += 1;
    }

    const backgroundImage = computed.getPropertyValue("background-image");
    if (hasUnsupportedColorFunctionInValue(backgroundImage)) {
      incrementHitCounter(unsupportedColorHitsByProperty, "background-image");
      affectedElements.add(node);
      if (node !== root && node !== clonedDoc.body && node !== clonedDoc.documentElement) {
        node.setAttribute(MODERN_BG_ATTRIBUTE, "1");
        bgModernFlaggedCount += 1;
      }
      inlineStyle?.setProperty("background-image", "none", "important");
      const fallbackBg = resolveCssPropertyInClone(
        resolver,
        view,
        "background-color",
        computed.getPropertyValue("background-color"),
      );
      if (fallbackBg) {
        inlineStyle?.setProperty("background-color", fallbackBg, "important");
      } else {
        inlineStyle?.setProperty("background-color", "rgb(255, 255, 255)", "important");
      }
      normalizedColorsCount += 1;
    }

    const computedBorder = computed.getPropertyValue("border");
    const inlineBorder = inlineStyle?.getPropertyValue("border") || "";
    if (
      hasUnsupportedColorFunctionInValue(computedBorder) ||
      hasUnsupportedColorFunctionInValue(inlineBorder)
    ) {
      incrementHitCounter(unsupportedColorHitsByProperty, "border");
      affectedElements.add(node);
      const topColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-top-color",
          computed.getPropertyValue("border-top-color"),
        ) || "rgb(0, 0, 0)";
      const rightColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-right-color",
          computed.getPropertyValue("border-right-color"),
        ) || topColor;
      const bottomColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-bottom-color",
          computed.getPropertyValue("border-bottom-color"),
        ) || topColor;
      const leftColor =
        resolveCssPropertyInClone(
          resolver,
          view,
          "border-left-color",
          computed.getPropertyValue("border-left-color"),
        ) || rightColor;
      inlineStyle?.setProperty("border-top-color", topColor, "important");
      inlineStyle?.setProperty("border-right-color", rightColor, "important");
      inlineStyle?.setProperty("border-bottom-color", bottomColor, "important");
      inlineStyle?.setProperty("border-left-color", leftColor, "important");
      normalizedColorsCount += 1;
    }
  });

  if (!clonedDoc.head.querySelector(`style[${MODERN_BG_STYLE_ATTRIBUTE}]`)) {
    const fallbackStyle = clonedDoc.createElement("style");
    fallbackStyle.setAttribute(MODERN_BG_STYLE_ATTRIBUTE, "1");
    fallbackStyle.textContent = `[${MODERN_BG_ATTRIBUTE}="1"] { background-image: none !important; }`;
    clonedDoc.head.appendChild(fallbackStyle);
  }

  const remainingUnsupportedColorCount = countUnsupportedColorValuesInClone(root, view);
  resolver.remove();

  return {
    unsupportedColorHitsByProperty,
    unsupportedColorElementsCount: affectedElements.size,
    bgModernFlaggedCount,
    globalOverridesApplied,
    normalizedColorsCount,
    remainingUnsupportedColorCount,
  };
}

function isCrossOriginHttpUrlForDocument(doc: Document, rawUrl: string): boolean {
  const view = doc.defaultView;
  if (!view) return false;
  try {
    const parsed = new URL(rawUrl, view.location.href);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isHttp && parsed.origin !== view.location.origin;
  } catch {
    return false;
  }
}

function countDirectRemoteImageRequestsInClone(root: HTMLElement, clonedDoc: Document): number {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  const imageCount = images.filter((image) => {
    const effective = getImageEffectiveSrc(image);
    if (!isCrossOriginHttpUrlForDocument(clonedDoc, effective)) return false;
    return !effective.includes("/v1/aux/proxy-image");
  }).length;

  const srcsetCount = images.filter((image) => {
    const srcset = image.getAttribute("srcset") || "";
    return srcset.includes("http://") || srcset.includes("https://");
  }).length;

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  let backgroundCount = 0;
  let inlineStyleCount = 0;
  nodes.forEach((node) => {
    const computedBackgroundImage = (clonedDoc.defaultView?.getComputedStyle(node).backgroundImage || "").trim();
    if (computedBackgroundImage.includes("url(")) {
      const matches = computedBackgroundImage.matchAll(/url\((['"]?)(.*?)\1\)/gi);
      for (const match of matches) {
        const rawUrl = (match[2] || "").trim();
        if (
          isCrossOriginHttpUrlForDocument(clonedDoc, rawUrl) &&
          !rawUrl.includes("/v1/aux/proxy-image")
        ) {
          backgroundCount += 1;
        }
      }
    }

    const inlineStyle = node.getAttribute("style") || "";
    if (inlineStyle.includes("url(")) {
      const matches = inlineStyle.matchAll(/url\((['"]?)(.*?)\1\)/gi);
      for (const match of matches) {
        const rawUrl = (match[2] || "").trim();
        if (
          isCrossOriginHttpUrlForDocument(clonedDoc, rawUrl) &&
          !rawUrl.includes("/v1/aux/proxy-image")
        ) {
          inlineStyleCount += 1;
        }
      }
    }
  });

  return imageCount + srcsetCount + backgroundCount + inlineStyleCount;
}

async function waitForCloneImageReady(image: HTMLImageElement): Promise<boolean> {
  if (isImageLoaded(image)) return true;
  try {
    if (typeof image.decode === "function") {
      await waitWithTimeout(image.decode(), IMAGE_DECODE_TIMEOUT_MS);
    } else {
      await waitWithTimeout(
        new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }),
        IMAGE_DECODE_TIMEOUT_MS,
      );
    }
  } catch {
    // no-op
  }
  return isImageLoaded(image);
}

async function prepareCloneForCapture(
  clonedDoc: Document,
  options: { apiBaseUrl: string; tenantId?: string; disableCache: boolean },
  captureTargetSelector: string,
  log?: DebugLogger,
): Promise<CloneCapturePreparationStats> {
  const root = clonedDoc.querySelector<HTMLElement>(captureTargetSelector) || clonedDoc.body;
  if (!root) {
    return {
      captureTargetSelector,
      captureTargetSnippet: "",
      captureTargetRect: null,
      captureTargetPages: [],
      visibleNodeCount: 0,
      totalImages: 0,
      decodedImages: 0,
      failedImages: 0,
      proxiedImagesCount: 0,
      proxiedBackgroundImagesCount: 0,
      directRemoteImageRequestsCount: 0,
      unsupportedColorHitsByProperty: {},
      unsupportedColorElementsCount: 0,
      bgModernFlaggedCount: 0,
      globalOverridesApplied: false,
      normalizedColorsCount: 0,
      remainingUnsupportedColorCount: 0,
      imageWaitMs: 0,
    };
  }

  const cloneView = clonedDoc.defaultView;
  const cloneHtml = clonedDoc.documentElement;
  const cloneBody = clonedDoc.body;
  let globalOverridesApplied = false;

  const snapshotBackground = (element: HTMLElement | null) => {
    if (!element || !cloneView) {
      return {
        background: "",
        backgroundImage: "",
        flags: buildUnsupportedColorFunctionFlags(""),
      };
    }
    const computed = cloneView.getComputedStyle(element);
    const background = computed.getPropertyValue("background");
    const backgroundImage = computed.getPropertyValue("background-image");
    return {
      background,
      backgroundImage,
      flags: {
        ...buildUnsupportedColorFunctionFlags(background),
        imageHasUnsupported: hasUnsupportedColorFunctionInValue(backgroundImage),
      },
    };
  };

  const preSanitizeHtml = snapshotBackground(cloneHtml);
  const preSanitizeBody = snapshotBackground(cloneBody);
  const preSanitizeRoot = snapshotBackground(root);
  log?.("clone background diagnostics before sanitize", {
    html: preSanitizeHtml,
    body: preSanitizeBody,
    captureRoot: preSanitizeRoot,
    explicitRequiredFields: {
      cloneBodyBackground: preSanitizeBody.background,
      cloneBodyBackgroundImage: preSanitizeBody.backgroundImage,
      cloneHtmlBackground: preSanitizeHtml.background,
      captureRootBackground: preSanitizeRoot.background,
    },
  });

  const applyRootBackgroundFailsafe = (element: HTMLElement | null) => {
    if (!element) return;
    element.style.setProperty("background", "none", "important");
    element.style.setProperty("background-color", "#ffffff", "important");
    globalOverridesApplied = true;
  };
  applyRootBackgroundFailsafe(cloneHtml);
  applyRootBackgroundFailsafe(cloneBody);
  applyRootBackgroundFailsafe(root);

  const colorStats = sanitizeUnsupportedColorsInClone(clonedDoc, root);
  const captureTargetRect = getElementRectSnapshot(root);
  const captureTargetPages = getPageRectDiagnostics(root);
  const visibleNodeCount = cloneView ? countVisibleNodes(root, cloneView) : 0;
  const captureTargetSnippet = (root.outerHTML || "").slice(0, 200);

  let remainingUnsupportedColorCount = colorStats.remainingUnsupportedColorCount;
  if (cloneView) {
    const postSanitizeHtml = snapshotBackground(cloneHtml);
    const postSanitizeBody = snapshotBackground(cloneBody);
    const postSanitizeRoot = snapshotBackground(root);
    const unsupportedEntries = collectUnsupportedColorEntriesInClone(root, cloneView, 10);
    remainingUnsupportedColorCount = unsupportedEntries.totalCount;

    log?.("clone background diagnostics after sanitize", {
      html: postSanitizeHtml,
      body: postSanitizeBody,
      captureRoot: postSanitizeRoot,
      remainingUnsupportedColorCount: unsupportedEntries.totalCount,
    });

    if (unsupportedEntries.totalCount > 0) {
      log?.("clone unsupported color survivors", {
        remainingUnsupportedColorCount: unsupportedEntries.totalCount,
        first10: unsupportedEntries.samples,
      });
    }
  }

  const preloadLinks = Array.from(
    clonedDoc.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"][href]'),
  );
  preloadLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (isCrossOriginHttpUrlForDocument(clonedDoc, href)) {
      link.remove();
    }
  });

  const pictureSources = Array.from(clonedDoc.querySelectorAll<HTMLSourceElement>("picture source"));
  pictureSources.forEach((source) => {
    source.removeAttribute("srcset");
    source.removeAttribute("sizes");
  });

  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  let proxiedImagesCount = 0;
  images.forEach((image, index) => {
    const effectiveSource = getImageEffectiveSrc(image) || image.getAttribute("src") || "";
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.loading = "eager";
    image.decoding = "sync";

    if (!effectiveSource || !isCrossOriginHttpUrlForDocument(clonedDoc, effectiveSource)) {
      return;
    }

    const proxied = buildProxyImageUrl(effectiveSource, { ...options, index });
    image.src = proxied;
    proxiedImagesCount += 1;
  });

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  let proxiedBackgroundImagesCount = 0;
  nodes.forEach((node) => {
    const computedBackgroundImage =
      clonedDoc.defaultView?.getComputedStyle(node).backgroundImage || "";
    if (!computedBackgroundImage.includes("url(")) return;
    const replaced = replaceBackgroundUrlsWithProxy(computedBackgroundImage, options);
    if (replaced.replacedCount <= 0) return;
    node.style.setProperty("background-image", replaced.value, "important");
    proxiedBackgroundImagesCount += replaced.replacedCount;
  });

  const inlineWithHttp = Array.from(
    root.querySelectorAll<HTMLElement>('[style*="http://"], [style*="https://"]'),
  );
  inlineWithHttp.forEach((node) => {
    const current = node.style.getPropertyValue("background-image");
    if (!current || !current.includes("url(")) return;
    const replaced = replaceBackgroundUrlsWithProxy(current, options);
    if (replaced.replacedCount <= 0) return;
    node.style.setProperty("background-image", replaced.value, "important");
    proxiedBackgroundImagesCount += replaced.replacedCount;
  });

  const forcedProxyImages = Array.from(
    root.querySelectorAll<HTMLImageElement>('img[src^="http://"], img[src^="https://"], img[srcset*="http"]'),
  );
  forcedProxyImages.forEach((image, index) => {
    const rawSrc = image.getAttribute("src") || image.currentSrc || image.src || "";
    if (
      rawSrc &&
      isCrossOriginHttpUrlForDocument(clonedDoc, rawSrc) &&
      !rawSrc.includes("/v1/aux/proxy-image")
    ) {
      image.src = buildProxyImageUrl(rawSrc, { ...options, index: images.length + index });
      proxiedImagesCount += 1;
    }
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.loading = "eager";
    image.decoding = "sync";
  });

  const startedAt = performance.now();
  const settled = await Promise.all(images.map((image) => waitForCloneImageReady(image)));
  const imageWaitMs = Math.round(performance.now() - startedAt);
  const decodedImages = settled.filter(Boolean).length;
  const failedImages = settled.length - decodedImages;

  const directRemoteImageRequestsCount = countDirectRemoteImageRequestsInClone(root, clonedDoc);
  return {
    captureTargetSelector,
    captureTargetSnippet,
    captureTargetRect,
    captureTargetPages,
    visibleNodeCount,
    totalImages: images.length,
    decodedImages,
    failedImages,
    proxiedImagesCount,
    proxiedBackgroundImagesCount,
    directRemoteImageRequestsCount,
    unsupportedColorHitsByProperty: colorStats.unsupportedColorHitsByProperty,
    unsupportedColorElementsCount: colorStats.unsupportedColorElementsCount,
    bgModernFlaggedCount: colorStats.bgModernFlaggedCount,
    globalOverridesApplied: colorStats.globalOverridesApplied || globalOverridesApplied,
    normalizedColorsCount: colorStats.normalizedColorsCount,
    remainingUnsupportedColorCount,
    imageWaitMs,
  };
}

function countDirectRemoteImageRequests(container: HTMLElement): number {
  const imageCount = Array.from(container.querySelectorAll<HTMLImageElement>("img")).filter((img) => {
    const effective = getImageEffectiveSrc(img);
    return isCrossOriginHttpUrl(effective);
  }).length;

  const nodes = [container, ...Array.from(container.querySelectorAll<HTMLElement>("*"))];
  let backgroundCount = 0;
  nodes.forEach((node) => {
    const backgroundImage = window.getComputedStyle(node).backgroundImage || "";
    if (!backgroundImage.includes("url(")) return;
    const matches = backgroundImage.matchAll(/url\((['"]?)(.*?)\1\)/gi);
    for (const match of matches) {
      const rawUrl = (match[2] || "").trim();
      if (isCrossOriginHttpUrl(rawUrl)) {
        backgroundCount += 1;
      }
    }
  });

  return imageCount + backgroundCount;
}

function countRemainingUnsupportedColors(root: HTMLElement): number {
  let count = 0;
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  nodes.forEach((node) => {
    const computed = window.getComputedStyle(node);
    COLOR_STYLE_FIELDS.forEach((field) => {
      const value = computed[field];
      if (typeof value === "string" && hasUnsupportedColorFunction(value)) {
        count += 1;
      }
    });

    const backgroundImage = computed.backgroundImage || "";
    if (hasUnsupportedColorFunction(backgroundImage)) {
      count += 1;
    }
  });
  return count;
}

function normalizeUnsupportedColorsForCapture(
  root: HTMLElement,
  log: DebugLogger,
): ColorNormalizationResult {
  const cleanupTasks: Array<() => void> = [];
  let normalizedColorsCount = 0;

  const resolver = root.ownerDocument.createElement("span");
  resolver.style.position = "fixed";
  resolver.style.left = "-99999px";
  resolver.style.top = "-99999px";
  resolver.style.visibility = "hidden";
  resolver.style.pointerEvents = "none";
  resolver.style.width = "0";
  resolver.style.height = "0";
  root.ownerDocument.body.appendChild(resolver);
  cleanupTasks.push(() => resolver.remove());

  const resolveToRgb = (rawValue: string): string | null => {
    if (!rawValue) return null;
    resolver.style.color = "";
    resolver.style.color = rawValue;
    const resolved = window.getComputedStyle(resolver).color;
    if (!resolved || hasUnsupportedColorFunction(resolved)) return null;
    return resolved;
  };

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  nodes.forEach((node) => {
    const computed = window.getComputedStyle(node);

    COLOR_STYLE_FIELDS.forEach((field) => {
      const value = computed[field];
      if (typeof value !== "string" || !hasUnsupportedColorFunction(value)) return;

      const cssField = toKebabCase(field);
      const resolved = resolveToRgb(value);
      if (!resolved) return;

      const previousValue = node.style.getPropertyValue(cssField);
      const previousPriority = node.style.getPropertyPriority(cssField);
      cleanupTasks.push(() => {
        if (previousValue) {
          node.style.setProperty(cssField, previousValue, previousPriority || "");
        } else {
          node.style.removeProperty(cssField);
        }
      });

      node.style.setProperty(cssField, resolved, "important");
      normalizedColorsCount += 1;
    });

    const backgroundImage = computed.backgroundImage || "";
    if (hasUnsupportedColorFunction(backgroundImage)) {
      const previousBackgroundImage = node.style.getPropertyValue("background-image");
      const previousBackgroundImagePriority = node.style.getPropertyPriority("background-image");
      const previousBackgroundColor = node.style.getPropertyValue("background-color");
      const previousBackgroundColorPriority = node.style.getPropertyPriority("background-color");
      const fallbackBackground = resolveToRgb(computed.backgroundColor || "") || "rgba(255, 255, 255, 1)";

      cleanupTasks.push(() => {
        if (previousBackgroundImage) {
          node.style.setProperty(
            "background-image",
            previousBackgroundImage,
            previousBackgroundImagePriority || "",
          );
        } else {
          node.style.removeProperty("background-image");
        }

        if (previousBackgroundColor) {
          node.style.setProperty(
            "background-color",
            previousBackgroundColor,
            previousBackgroundColorPriority || "",
          );
        } else {
          node.style.removeProperty("background-color");
        }
      });

      node.style.setProperty("background-image", "none", "important");
      node.style.setProperty("background-color", fallbackBackground, "important");
      normalizedColorsCount += 1;
    }
  });

  const remainingUnsupportedColorCount = countRemainingUnsupportedColors(root);
  log("unsupported color normalization", {
    normalizedColorsCount,
    remainingUnsupportedColorCount,
  });

  return {
    normalizedColorsCount,
    remainingUnsupportedColorCount,
    cleanup: () => {
      while (cleanupTasks.length > 0) {
        const task = cleanupTasks.pop();
        if (!task) continue;
        try {
          task();
        } catch {
          // no-op
        }
      }
    },
  };
}

function normalizeImageForCapture(image: HTMLImageElement): void {
  image.loading = "eager";
  image.decoding = "sync";
  image.fetchPriority = "high";
  image.crossOrigin = "anonymous";
}

function createOriginalImageSnapshot(
  rootElement: HTMLElement,
  maxImages = 5,
): OriginalImageSnapshot[] {
  const images = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img")).slice(0, maxImages);
  return images.map((image, index) => ({
    index,
    src: image.src || "",
    srcset: image.srcset || "",
    sizes: image.sizes || "",
    loading: image.loading || "",
    decoding: image.decoding || "",
    crossOrigin: image.crossOrigin,
  }));
}

function assertOriginalImagesIntact(
  rootElement: HTMLElement,
  before: OriginalImageSnapshot[],
  log: DebugLogger,
): void {
  if (before.length === 0) return;

  const after = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img"))
    .slice(0, before.length)
    .map((image, index) => ({
      index,
      src: image.src || "",
      srcset: image.srcset || "",
      sizes: image.sizes || "",
      loading: image.loading || "",
      decoding: image.decoding || "",
      crossOrigin: image.crossOrigin,
    }));

  const changed = before.filter((entry, index) => {
    const target = after[index];
    if (!target) return true;
    return (
      entry.src !== target.src ||
      entry.srcset !== target.srcset ||
      entry.sizes !== target.sizes ||
      entry.loading !== target.loading ||
      entry.decoding !== target.decoding ||
      entry.crossOrigin !== target.crossOrigin
    );
  });

  log("ui integrity check", {
    checkedImages: before.length,
    changedImages: changed.length,
    changed,
  });
}

function restoreOriginalImagesFromSnapshot(
  rootElement: HTMLElement,
  before: OriginalImageSnapshot[],
  log: DebugLogger,
): void {
  if (before.length === 0) return;

  const images = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img")).slice(0, before.length);
  images.forEach((image, index) => {
    const snapshot = before[index];
    if (!snapshot) return;

    if (image.src !== snapshot.src) image.src = snapshot.src;
    if (image.srcset !== snapshot.srcset) image.srcset = snapshot.srcset;
    if (image.sizes !== snapshot.sizes) image.sizes = snapshot.sizes;
    if (image.loading !== snapshot.loading) image.loading = snapshot.loading as HTMLImageElement["loading"];
    if (image.decoding !== snapshot.decoding)
      image.decoding = snapshot.decoding as HTMLImageElement["decoding"];
    if ((image.crossOrigin || null) !== snapshot.crossOrigin) {
      image.crossOrigin = snapshot.crossOrigin;
    }
  });

  log("ui restore fallback executed", { restoredImages: images.length });
}

function getImageEffectiveSrc(image: HTMLImageElement): string {
  return image.currentSrc || image.src || "";
}

function getImageCaptureSource(image: HTMLImageElement): string {
  return (
    image.getAttribute("data-pdf-original-current-src") ||
    image.getAttribute("data-pdf-original-src") ||
    getImageEffectiveSrc(image)
  );
}

function isImageLoaded(image: HTMLImageElement): boolean {
  if (!image.complete) return false;
  if (image.naturalWidth > 0) return true;
  return image.src.startsWith("data:image");
}

function getImageDebugEntry(image: HTMLImageElement, index: number): ImageDebugEntry {
  const effectiveSrc = getImageEffectiveSrc(image);
  const captureSource = getImageCaptureSource(image);
  return {
    index,
    src: image.src || "",
    currentSrc: effectiveSrc,
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    loading: image.loading,
    isDataUrl: effectiveSrc.startsWith("data:"),
    isBlobUrl: effectiveSrc.startsWith("blob:"),
    isProxyUrl: effectiveSrc.includes("/v1/aux/proxy-image"),
    captureSource,
  };
}

async function waitForRaf(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function ensureSourceImagesReady(rootElement: HTMLElement, log: DebugLogger): Promise<void> {
  const sourceImages = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img"));
  if (sourceImages.length === 0) return;

  await Promise.all(
    sourceImages.map(async (image) => {
      if (isImageLoaded(image)) return;

      try {
        if (typeof image.decode === "function") {
          await waitWithTimeout(image.decode(), IMAGE_DECODE_TIMEOUT_MS);
        } else {
          await waitWithTimeout(
            new Promise<void>((resolve) => {
              const done = () => resolve();
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
            }),
            IMAGE_DECODE_TIMEOUT_MS,
          );
        }
      } catch {
        log("source image decode failed", { src: image.src, currentSrc: image.currentSrc });
      }
    }),
  );
}

function collectTextLayoutSamples(root: HTMLElement, limit = 5): TextLayoutSample[] {
  const doc = root.ownerDocument;
  const view = doc.defaultView || window;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("h1, h2, h3, p, span, td, th, div"),
  )
    .filter((el) => (el.textContent || "").trim().length > 0)
    .slice(0, limit);

  return candidates.map((element, index) => {
    const computed = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      index,
      tag: element.tagName.toLowerCase(),
      className: element.className || "",
      text: (element.textContent || "").trim().slice(0, 120),
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
      x: Number(rect.x.toFixed(2)),
      y: Number(rect.y.toFixed(2)),
    };
  });
}

function createLayoutSnapshot(root: HTMLElement, limit = 5): LayoutSnapshot {
  return {
    scrollHeight: root.scrollHeight,
    scrollWidth: root.scrollWidth,
    samples: collectTextLayoutSamples(root, limit),
  };
}

function areLayoutSnapshotsStable(previous: LayoutSnapshot, current: LayoutSnapshot): boolean {
  if (previous.scrollHeight !== current.scrollHeight) return false;
  if (previous.scrollWidth !== current.scrollWidth) return false;
  if (previous.samples.length !== current.samples.length) return false;

  return previous.samples.every((sample, index) => {
    const target = current.samples[index];
    if (!target) return false;
    return (
      sample.fontFamily === target.fontFamily &&
      sample.fontWeight === target.fontWeight &&
      sample.fontStyle === target.fontStyle &&
      sample.lineHeight === target.lineHeight &&
      sample.letterSpacing === target.letterSpacing &&
      Math.abs(sample.width - target.width) < 0.2 &&
      Math.abs(sample.height - target.height) < 0.2 &&
      Math.abs(sample.x - target.x) < 0.2 &&
      Math.abs(sample.y - target.y) < 0.2
    );
  });
}

function summarizeLayoutDiff(source: LayoutSnapshot, capture: LayoutSnapshot): Record<string, unknown> {
  const compared = Math.min(source.samples.length, capture.samples.length);
  let changed = 0;

  for (let i = 0; i < compared; i += 1) {
    const a = source.samples[i];
    const b = capture.samples[i];
    if (
      a.fontFamily !== b.fontFamily ||
      a.fontWeight !== b.fontWeight ||
      a.fontStyle !== b.fontStyle ||
      a.lineHeight !== b.lineHeight ||
      a.letterSpacing !== b.letterSpacing ||
      Math.abs(a.width - b.width) >= 0.2 ||
      Math.abs(a.height - b.height) >= 0.2
    ) {
      changed += 1;
    }
  }

  return {
    sourceScrollHeight: source.scrollHeight,
    captureScrollHeight: capture.scrollHeight,
    sourceScrollWidth: source.scrollWidth,
    captureScrollWidth: capture.scrollWidth,
    comparedSamples: compared,
    changedSamples: changed,
  };
}

function normalizeDebugText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildTextDebugKey(element: HTMLElement): string {
  const text = normalizeDebugText((element.textContent || "").slice(0, 240));
  return `${element.tagName.toLowerCase()}|${text}`;
}

function getAncestorTransforms(element: HTMLElement, stopAt: HTMLElement): TextDebugAncestorTransform[] {
  const output: TextDebugAncestorTransform[] = [];
  const doc = element.ownerDocument;
  const view = doc.defaultView || window;
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && depth < 12) {
    const computed = view.getComputedStyle(current);
    output.push({
      depth,
      tag: current.tagName.toLowerCase(),
      className: current.className || "",
      transform: computed.transform || "none",
      zoom: computed.zoom || "normal",
    });
    if (current === stopAt) break;
    current = current.parentElement;
    depth += 1;
  }

  return output;
}

function findDebugTextTargets(root: HTMLElement, limit = 3): HTMLElement[] {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("p, div, span, td, th, h1, h2, h3, h4, h5, h6"),
  ).filter((element) => {
    const text = normalizeDebugText(element.textContent || "");
    return text.length >= 24 && !element.querySelector("img, svg, canvas");
  });

  return candidates.slice(0, limit);
}

function collectTextDebugSamples(
  root: HTMLElement,
  selectedKeys?: string[],
): TextDebugSample[] {
  const doc = root.ownerDocument;
  const view = doc.defaultView || window;
  const allCandidates = Array.from(
    root.querySelectorAll<HTMLElement>("p, div, span, td, th, h1, h2, h3, h4, h5, h6"),
  ).filter((element) => normalizeDebugText(element.textContent || "").length >= 24);

  const selectedElements =
    selectedKeys && selectedKeys.length > 0
      ? selectedKeys
          .map((key) => allCandidates.find((element) => buildTextDebugKey(element) === key) || null)
          .filter((element): element is HTMLElement => Boolean(element))
      : findDebugTextTargets(root, 3);

  return selectedElements.map((element) => {
    const computed = view.getComputedStyle(element);
    return {
      key: buildTextDebugKey(element),
      text: normalizeDebugText(element.textContent || ""),
      textShort: (normalizeDebugText(element.textContent || "") || "").slice(0, 140),
      tag: element.tagName.toLowerCase(),
      className: element.className || "",
      transform: computed.transform || "none",
      zoom: computed.zoom || "normal",
      computed: {
        fontFamily: computed.fontFamily || "",
        fontWeight: computed.fontWeight || "",
        fontStyle: computed.fontStyle || "",
        fontStretch: computed.fontStretch || "",
        fontKerning: computed.fontKerning || "",
        fontFeatureSettings: computed.fontFeatureSettings || "",
        fontVariantLigatures: computed.fontVariantLigatures || "",
        letterSpacing: computed.letterSpacing || "",
        wordSpacing: computed.wordSpacing || "",
        textRendering: computed.textRendering || "",
        whiteSpace: computed.whiteSpace || "",
        wordBreak: computed.wordBreak || "",
      },
      ancestors: getAncestorTransforms(element, root),
    };
  });
}

function summarizeTextDebugDiffs(
  source: TextDebugSample[],
  capture: TextDebugSample[],
): Array<Record<string, unknown>> {
  return source.map((sourceSample) => {
    const captureSample = capture.find((entry) => entry.key === sourceSample.key) || null;
    const compare = (field: keyof TextDebugComputedStyle) => {
      const sourceValue = sourceSample.computed[field];
      const captureValue = captureSample?.computed[field] || "";
      return sourceValue === captureValue ? null : { source: sourceValue, capture: captureValue };
    };

    return {
      key: sourceSample.key,
      text: sourceSample.textShort,
      foundInCapture: Boolean(captureSample),
      fontFamily: compare("fontFamily"),
      fontWeight: compare("fontWeight"),
      fontStyle: compare("fontStyle"),
      fontStretch: compare("fontStretch"),
      fontKerning: compare("fontKerning"),
      fontFeatureSettings: compare("fontFeatureSettings"),
      fontVariantLigatures: compare("fontVariantLigatures"),
      letterSpacing: compare("letterSpacing"),
      wordSpacing: compare("wordSpacing"),
      textRendering: compare("textRendering"),
      whiteSpace: compare("whiteSpace"),
      wordBreak: compare("wordBreak"),
      transform: sourceSample.transform === (captureSample?.transform || "")
        ? null
        : { source: sourceSample.transform, capture: captureSample?.transform || "" },
      zoom: sourceSample.zoom === (captureSample?.zoom || "")
        ? null
        : { source: sourceSample.zoom, capture: captureSample?.zoom || "" },
      ancestorTransforms: {
        source: sourceSample.ancestors.map((entry) => ({
          depth: entry.depth,
          tag: entry.tag,
          transform: entry.transform,
          zoom: entry.zoom,
        })),
        capture:
          captureSample?.ancestors.map((entry) => ({
            depth: entry.depth,
            tag: entry.tag,
            transform: entry.transform,
            zoom: entry.zoom,
          })) || [],
      },
    };
  });
}

function resolveCssUrl(rawUrl: string, baseUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("about:") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return trimmed;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function normalizeCssUrls(cssText: string, baseUrl: string): string {
  return cssText.replace(/url\(([^)]+)\)/gi, (match, rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return match;
    if (value.startsWith("var(")) return match;

    const unquoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;

    const resolved = resolveCssUrl(unquoted, baseUrl);
    return `url("${resolved}")`;
  });
}

function extractFontFaceCssFromDocument(doc: Document): string {
  const blocks: string[] = [];
  const styleSheets = Array.from(doc.styleSheets);

  styleSheets.forEach((sheet) => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      rules.forEach((rule) => {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          const baseUrl =
            sheet.href ||
            doc.baseURI ||
            (typeof window !== "undefined" ? window.location.origin : "");
          blocks.push(normalizeCssUrls(rule.cssText, baseUrl));
        }
      });
    } catch {
      return;
    }
  });

  return blocks.join("\n");
}

function applyCaptureFontVariables(sourceDoc: Document, captureDoc: Document): void {
  const sourceStyle = sourceDoc.defaultView?.getComputedStyle(sourceDoc.documentElement);
  if (!sourceStyle) return;
  CAPTURE_FONT_VARIABLES.forEach((variableName) => {
    const value = sourceStyle.getPropertyValue(variableName).trim();
    if (value) {
      captureDoc.documentElement.style.setProperty(variableName, value);
      captureDoc.body.style.setProperty(variableName, value);
    }
  });
}

function injectFontFaceContextIntoCaptureDocument(sourceDoc: Document, captureDoc: Document): void {
  const css = extractFontFaceCssFromDocument(sourceDoc);
  if (!css) return;
  const style = captureDoc.createElement("style");
  style.setAttribute("data-pdf-font-face", "1");
  style.textContent = css;
  captureDoc.head.appendChild(style);
  applyCaptureFontVariables(sourceDoc, captureDoc);
}

function areNumberArraysStable(previous: number[], current: number[], epsilon = 0.2): boolean {
  if (previous.length !== current.length) return false;
  return previous.every((value, index) => Math.abs(value - current[index]) <= epsilon);
}

function collectReferenceTextWidths(root: HTMLElement, max = 3): number[] {
  const candidates = findDebugTextTargets(root, max);
  return candidates.map((element) => Number(element.getBoundingClientRect().width.toFixed(2)));
}

async function waitForLayoutStability(root: HTMLElement, log: DebugLogger): Promise<void> {
  const maxAttempts = 10;
  let previous: LayoutSnapshot | null = null;
  let previousWidths: number[] | null = null;
  let stableFrames = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForRaf();
    const current = createLayoutSnapshot(root, 5);
    const currentWidths = collectReferenceTextWidths(root, 3);

    const isStableLayout = previous && areLayoutSnapshotsStable(previous, current);
    const isStableTextWidths =
      previousWidths && areNumberArraysStable(previousWidths, currentWidths);

    if (isStableLayout && isStableTextWidths) {
      stableFrames += 1;
      if (stableFrames >= 2) {
        log("layout settled", {
          attempt,
          stableFrames,
          snapshot: current,
          referenceTextWidths: currentWidths,
        });
        return;
      }
    } else {
      stableFrames = 0;
    }

    previous = current;
    previousWidths = currentWidths;
  }

  log("layout settle timeout", {
    attempts: maxAttempts,
    snapshot: previous,
    referenceTextWidths: previousWidths,
  });
}

function deepCloneWithComputedStyles(
  node: HTMLElement,
  canvasCtx: CanvasRenderingContext2D | null,
): HTMLElement {
  const clone = node.cloneNode(false) as HTMLElement;
  clone.removeAttribute("id");
  clone.removeAttribute("class");

  const computed = window.getComputedStyle(node);
  const propertiesToCopy = [
    "display",
    "position",
    "boxSizing",
    "top",
    "left",
    "right",
    "bottom",
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "margin",
    "marginTop",
    "marginBottom",
    "marginLeft",
    "marginRight",
    "padding",
    "paddingTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "borderTopWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopStyle",
    "borderBottomStyle",
    "borderLeftStyle",
    "borderRightStyle",
    "borderTopColor",
    "borderBottomColor",
    "borderLeftColor",
    "borderRightColor",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
    "outline",
    "outlineColor",
    "outlineStyle",
    "outlineWidth",
    "flex",
    "flexDirection",
    "flexWrap",
    "justifyContent",
    "alignItems",
    "alignContent",
    "gap",
    "order",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "gridTemplateColumns",
    "gridTemplateRows",
    "gridTemplateAreas",
    "gridAutoColumns",
    "gridAutoRows",
    "gridAutoFlow",
    "gridColumn",
    "gridRow",
    "gridArea",
    "columnGap",
    "rowGap",
    "font",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontStretch",
    "fontKerning",
    "fontFeatureSettings",
    "fontVariantLigatures",
    "lineHeight",
    "letterSpacing",
    "wordSpacing",
    "textRendering",
    "textAlign",
    "textTransform",
    "textDecoration",
    "textDecorationColor",
    "textUnderlineOffset",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
    "textOverflow",
    "verticalAlign",
    "color",
    "backgroundColor",
    "opacity",
    "visibility",
    "zIndex",
    "boxShadow",
    "overflow",
    "overflowX",
    "overflowY",
    "transform",
    "transformOrigin",
    "zoom",
    "fill",
    "stroke",
    "strokeWidth",
    "objectFit",
    "objectPosition",
    "aspectRatio",
    "breakInside",
  ];

  propertiesToCopy.forEach((propertyName) => {
    let value = computed[propertyName as keyof CSSStyleDeclaration];
    if (!value || typeof value !== "string") return;

    if (
      propertyName.toLowerCase().includes("color") ||
      propertyName === "fill" ||
      propertyName === "stroke"
    ) {
      value = safeCssColor(value, canvasCtx, propertyName);
    } else if (containsModernColor(value)) {
      value = propertyName.toLowerCase().includes("shadow") ? "none" : "";
    }

    if (value) {
      clone.style.setProperty(toKebabCase(propertyName), value, "important");
    }
  });

  if (computed.backgroundImage && computed.backgroundImage !== "none") {
    if (containsModernColor(computed.backgroundImage)) {
      clone.style.backgroundImage = "none";
      clone.style.backgroundColor = safeCssColor(
        computed.backgroundColor,
        canvasCtx,
        "backgroundColor",
      );
    } else {
      clone.style.backgroundImage = computed.backgroundImage;
    }
  }

  if (node instanceof HTMLImageElement) {
    const sourceImage = node as HTMLImageElement;
    const cloneImage = clone as HTMLImageElement;
    const srcToUse = getImageEffectiveSrc(sourceImage);

    cloneImage.src = TRANSPARENT_PIXEL_DATA_URL;
    cloneImage.removeAttribute("srcset");
    cloneImage.sizes = "";
    normalizeImageForCapture(cloneImage);
    cloneImage.setAttribute("data-pdf-original-src", sourceImage.src || srcToUse);
    cloneImage.setAttribute("data-pdf-original-current-src", srcToUse);
    if (sourceImage.srcset) cloneImage.setAttribute("data-pdf-original-srcset", sourceImage.srcset);
    if (sourceImage.sizes) cloneImage.setAttribute("data-pdf-original-sizes", sourceImage.sizes);
  }

  Array.from(node.childNodes).forEach((childNode) => {
    if (childNode.nodeType === Node.ELEMENT_NODE) {
      clone.appendChild(
        deepCloneWithComputedStyles(childNode as HTMLElement, canvasCtx),
      );
      return;
    }
    clone.appendChild(childNode.cloneNode(true));
  });

  return clone;
}

function applyCaptureLayoutFixes(
  root: HTMLElement,
  cleanupTasks: Array<() => void>,
): void {
  // Intentionally no-op; layout is normalized by capture-mode CSS rules.
  void root;
  void cleanupTasks;
}

function prepareDomForPdfCapture(root: HTMLElement): CaptureDomPreparation {
  const cleanupTasks: Array<() => void> = [];
  root.classList.add(CAPTURE_MODE_CLASS);
  cleanupTasks.push(() => root.classList.remove(CAPTURE_MODE_CLASS));

  const pageElements = Array.from(
    root.querySelectorAll<HTMLElement>("[data-page-index]"),
  );
  pageElements.forEach((pageEl) => {
    const previousStyle = pageEl.getAttribute("style");
    cleanupTasks.push(() => {
      if (previousStyle === null) pageEl.removeAttribute("style");
      else pageEl.setAttribute("style", previousStyle);
    });

    pageEl.style.setProperty("width", `${PAGE_WIDTH_PX}px`, "important");
    pageEl.style.setProperty("min-width", `${PAGE_WIDTH_PX}px`, "important");
    pageEl.style.setProperty("max-width", `${PAGE_WIDTH_PX}px`, "important");
    pageEl.style.setProperty("height", `${PAGE_HEIGHT_PX}px`, "important");
    pageEl.style.setProperty("min-height", `${PAGE_HEIGHT_PX}px`, "important");
    pageEl.style.setProperty("max-height", `${PAGE_HEIGHT_PX}px`, "important");
    pageEl.style.setProperty("box-shadow", "none", "important");
    pageEl.style.setProperty("break-inside", "avoid", "important");
    pageEl.style.setProperty("page-break-inside", "avoid", "important");
    pageEl.style.setProperty("contain", "layout paint", "important");
  });

  const overrideSelectors = [
    "[data-pdf-margin-bottom]",
    "[data-pdf-margin-top]",
    "[data-pdf-padding-bottom]",
    "[data-pdf-padding-top]",
    "[data-pdf-height]",
    "[data-pdf-border-top]",
  ];

  overrideSelectors.forEach((selector) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const previousStyle = el.getAttribute("style");
      cleanupTasks.push(() => {
        if (previousStyle === null) el.removeAttribute("style");
        else el.setAttribute("style", previousStyle);
      });

      const marginBottom = el.getAttribute("data-pdf-margin-bottom");
      if (marginBottom)
        el.style.setProperty("margin-bottom", marginBottom, "important");
      const marginTop = el.getAttribute("data-pdf-margin-top");
      if (marginTop) el.style.setProperty("margin-top", marginTop, "important");
      const paddingBottom = el.getAttribute("data-pdf-padding-bottom");
      if (paddingBottom)
        el.style.setProperty("padding-bottom", paddingBottom, "important");
      const paddingTop = el.getAttribute("data-pdf-padding-top");
      if (paddingTop) el.style.setProperty("padding-top", paddingTop, "important");
      const height = el.getAttribute("data-pdf-height");
      if (height) {
        el.style.setProperty("height", height, "important");
        el.style.setProperty("min-height", height, "important");
        el.style.setProperty("line-height", height, "important");
      }
      const borderTop = el.getAttribute("data-pdf-border-top");
      if (borderTop) {
        el.style.setProperty("border-top-width", borderTop, "important");
        el.style.setProperty("border-top-style", "solid", "important");
        el.style.setProperty("border-top-color", "transparent", "important");
        el.style.setProperty("height", "0px", "important");
      }
    });
  });

  applyCaptureLayoutFixes(root, cleanupTasks);

  return {
    root,
    cleanup: () => {
      while (cleanupTasks.length > 0) {
        cleanupTasks.pop()?.();
      }
    },
  };
}

function addCaptureModeStyle(doc: Document): HTMLStyleElement {
  const style = doc.createElement("style");
  style.textContent = `
    .${CAPTURE_MODE_CLASS},
    .${CAPTURE_MODE_CLASS} * {
      transition: none !important;
      animation: none !important;
    }
    .${CAPTURE_MODE_CLASS} [data-page-index] {
      width: ${PAGE_WIDTH_PX}px !important;
      height: ${PAGE_HEIGHT_PX}px !important;
      min-width: ${PAGE_WIDTH_PX}px !important;
      min-height: ${PAGE_HEIGHT_PX}px !important;
      max-width: ${PAGE_WIDTH_PX}px !important;
      max-height: ${PAGE_HEIGHT_PX}px !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-item-extra-tag] {
      margin-top: 0 !important;
      top: auto !important;
      line-height: 0 !important;
      transform: translateY(3px) !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-ambiente-pill] {
      line-height: 0 !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-system-title] {
      margin: 0 !important;
      display: block !important;
      transform: translateY(-2px) !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-system-head] {
      transform: translateY(-4px) !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-ambiente-list] {
      margin-top: 10px !important;
      padding-top: 0 !important;
    }
    .${CAPTURE_MODE_CLASS} [data-pdf-item-extra-tag] svg,
    .${CAPTURE_MODE_CLASS} [data-pdf-ambiente-pill] svg {
      display: block !important;
    }
  `;
  doc.head.appendChild(style);
  return style;
}

function getElementRectSnapshot(element: HTMLElement | null): ElementRectSnapshot | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    width: Number(rect.width.toFixed(2)),
    height: Number(rect.height.toFixed(2)),
    x: Number(rect.x.toFixed(2)),
    y: Number(rect.y.toFixed(2)),
    offsetTop: element.offsetTop,
    offsetLeft: element.offsetLeft,
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
  };
}

function getCaptureTargetSelector(rootElement: HTMLElement): string {
  if (rootElement.id) return `#${rootElement.id}`;
  return `[${CAPTURE_TARGET_ATTR}="1"]`;
}

function getPageRectDiagnostics(root: HTMLElement): Array<{
  pageIndex: string;
  rect: ElementRectSnapshot | null;
  scrollWidth: number;
  scrollHeight: number;
}> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-page-index]"));
  return pages.map((pageElement) => ({
    pageIndex: pageElement.getAttribute("data-page-index") || "",
    rect: getElementRectSnapshot(pageElement),
    scrollWidth: pageElement.scrollWidth,
    scrollHeight: pageElement.scrollHeight,
  }));
}

function countVisibleNodes(root: HTMLElement, view: Window): number {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  let visibleCount = 0;
  nodes.forEach((node) => {
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      visibleCount += 1;
    }
  });
  return visibleCount;
}

function inspectCanvasBlank(canvas: HTMLCanvasElement): {
  isBlankCanvas: boolean;
  samples: Array<{ x: number; y: number; rgba: [number, number, number, number] }>;
} {
  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = canvas.width;
  probeCanvas.height = canvas.height;
  const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  const samplePoints = [
    { x: 1, y: 1 },
    { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
    { x: Math.max(1, Math.floor(canvas.width / 2)), y: Math.max(1, canvas.height - 2) },
  ];

  if (!probeCtx || canvas.width <= 0 || canvas.height <= 0) {
    return {
      isBlankCanvas: true,
      samples: samplePoints.map((point) => ({ x: point.x, y: point.y, rgba: [0, 0, 0, 0] })),
    };
  }

  probeCtx.drawImage(canvas, 0, 0);

  const samples = samplePoints.map((point) => {
    const x = Math.min(Math.max(0, point.x), canvas.width - 1);
    const y = Math.min(Math.max(0, point.y), canvas.height - 1);
    const data = probeCtx.getImageData(x, y, 1, 1).data;
    return { x, y, rgba: [data[0], data[1], data[2], data[3]] as [number, number, number, number] };
  });

  const isBlankCanvas = samples.every((sample) => {
    const [r, g, b, a] = sample.rgba;
    return a === 0 || (r === 255 && g === 255 && b === 255 && a === 255);
  });

  return { isBlankCanvas, samples };
}

function getElementStyleSnapshot(
  element: HTMLElement | null,
  fields: readonly string[],
): ElementStyleSnapshot | null {
  if (!element) return null;
  const computed = window.getComputedStyle(element);
  const output: ElementStyleSnapshot = {};
  fields.forEach((field) => {
    const value = computed[field as keyof CSSStyleDeclaration];
    if (typeof value === "string") {
      output[field] = value;
    }
  });
  return output;
}

function findQtyElement(row: HTMLElement | null): HTMLElement | null {
  if (!row) return null;
  return row.querySelector<HTMLElement>("[data-pdf-item-qty]");
}

function findTitleElement(row: HTMLElement | null): HTMLElement | null {
  if (!row) return null;
  return row.querySelector<HTMLElement>("[data-pdf-item-title]");
}

function findTitleTextElement(
  row: HTMLElement | null,
  titleElement: HTMLElement | null,
): HTMLElement | null {
  if (!row) return null;
  const tagged = row.querySelector<HTMLElement>("[data-pdf-item-title-text]");
  if (tagged) return tagged;

  if (titleElement) {
    const structuralText = Array.from(
      titleElement.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, span, p, div"),
    ).find((element) => !element.querySelector("img, svg, canvas"));
    if (structuralText) return structuralText;
  }

  return null;
}

function findExtraTagElement(row: HTMLElement | null): HTMLElement | null {
  if (!row) return null;
  return row.querySelector<HTMLElement>("[data-pdf-item-extra-tag]");
}

function collectProductLayoutDiagnostics(
  root: HTMLElement,
  maxItems = PRODUCT_LAYOUT_DEBUG_MAX_ITEMS,
): ProductRowDiagnostic[] {
  const rows = Array.from(
    root.querySelectorAll<HTMLElement>("[data-pdf-item-row]"),
  ).slice(0, maxItems);

  return rows.map((rowElement, index) => {
    const titleWrapperElement = findTitleElement(rowElement);
    const titleTextElement = findTitleTextElement(rowElement, titleWrapperElement);
    const qtyElement = findQtyElement(rowElement);
    const extraTagElement = findExtraTagElement(rowElement);

    return {
      key: rowElement.getAttribute("data-pdf-item-id") || `row-${index + 1}`,
      found: Boolean(titleTextElement && rowElement),
      titleWrapperText: normalizeDebugText(titleWrapperElement?.textContent || ""),
      titleText: normalizeDebugText(titleTextElement?.textContent || ""),
      qtyText: normalizeDebugText(qtyElement?.textContent || ""),
      extraTagText: normalizeDebugText(extraTagElement?.textContent || ""),
      rowRect: getElementRectSnapshot(rowElement),
      titleWrapperRect: getElementRectSnapshot(titleWrapperElement),
      titleTextRect: getElementRectSnapshot(titleTextElement),
      qtyRect: getElementRectSnapshot(qtyElement),
      extraTagRect: getElementRectSnapshot(extraTagElement),
      rowComputed: getElementStyleSnapshot(rowElement, ROW_DEBUG_STYLE_FIELDS),
      titleWrapperComputed: getElementStyleSnapshot(titleWrapperElement, TITLE_DEBUG_STYLE_FIELDS),
      titleTextComputed: getElementStyleSnapshot(titleTextElement, TITLE_TEXT_DEBUG_STYLE_FIELDS),
      qtyComputed: getElementStyleSnapshot(qtyElement, QTY_DEBUG_STYLE_FIELDS),
      extraTagComputed: getElementStyleSnapshot(extraTagElement, EXTRA_TAG_DEBUG_STYLE_FIELDS),
    };
  });
}

function summarizeProductLayoutDiagnostics(
  source: ProductRowDiagnostic[],
  capture: ProductRowDiagnostic[],
): Array<Record<string, unknown>> {
  return source.map((sourceEntry) => {
    const captureEntry = capture.find((entry) => entry.key === sourceEntry.key) || null;

    const compareRect = (
      sourceRect: ElementRectSnapshot | null,
      captureRect: ElementRectSnapshot | null,
    ): Record<string, unknown> | null => {
      if (!sourceRect && !captureRect) return null;
      if (!sourceRect || !captureRect) return { source: sourceRect, capture: captureRect };

      return {
        width: Number((captureRect.width - sourceRect.width).toFixed(2)),
        height: Number((captureRect.height - sourceRect.height).toFixed(2)),
        x: Number((captureRect.x - sourceRect.x).toFixed(2)),
        y: Number((captureRect.y - sourceRect.y).toFixed(2)),
        offsetTop: captureRect.offsetTop - sourceRect.offsetTop,
        offsetLeft: captureRect.offsetLeft - sourceRect.offsetLeft,
        offsetWidth: captureRect.offsetWidth - sourceRect.offsetWidth,
        offsetHeight: captureRect.offsetHeight - sourceRect.offsetHeight,
      };
    };

    const compareStyles = (
      sourceStyles: ElementStyleSnapshot | null,
      captureStyles: ElementStyleSnapshot | null,
    ): Record<string, unknown> | null => {
      if (!sourceStyles && !captureStyles) return null;
      if (!sourceStyles || !captureStyles) return { source: sourceStyles, capture: captureStyles };

      const keys = new Set([...Object.keys(sourceStyles), ...Object.keys(captureStyles)]);
      const diff: Record<string, unknown> = {};
      keys.forEach((key) => {
        const sourceValue = sourceStyles[key] || "";
        const captureValue = captureStyles[key] || "";
        if (sourceValue !== captureValue) {
          diff[key] = { source: sourceValue, capture: captureValue };
        }
      });
      return diff;
    };

    const isWithinOnePixel = (rectDelta: Record<string, unknown> | null): boolean | null => {
      if (!rectDelta) return null;
      const numericValues = ["width", "height", "x", "y"].map((key) => {
        const value = rectDelta[key];
        return typeof value === "number" ? Math.abs(value) : 0;
      });
      return numericValues.every((value) => value <= 1);
    };

    const titleWrapperRectDelta = compareRect(
      sourceEntry.titleWrapperRect,
      captureEntry?.titleWrapperRect || null,
    );
    const titleTextRectDelta = compareRect(
      sourceEntry.titleTextRect,
      captureEntry?.titleTextRect || null,
    );
    const extraTagRectDelta = compareRect(sourceEntry.extraTagRect, captureEntry?.extraTagRect || null);
    const rowStyleDiff = compareStyles(sourceEntry.rowComputed, captureEntry?.rowComputed || null);
    const titleWrapperStyleDiff = compareStyles(
      sourceEntry.titleWrapperComputed,
      captureEntry?.titleWrapperComputed || null,
    );
    const titleTextStyleDiff = compareStyles(
      sourceEntry.titleTextComputed,
      captureEntry?.titleTextComputed || null,
    );
    const extraTagStyleDiff = compareStyles(
      sourceEntry.extraTagComputed,
      captureEntry?.extraTagComputed || null,
    );
    const qtyRectDelta = compareRect(sourceEntry.qtyRect, captureEntry?.qtyRect || null);
    const rowRectDelta = compareRect(sourceEntry.rowRect, captureEntry?.rowRect || null);

    const isQtyWithinRow = (
      rowRect: ElementRectSnapshot | null,
      qtyRect: ElementRectSnapshot | null,
    ): boolean | null => {
      if (!rowRect || !qtyRect) return null;
      return qtyRect.x + qtyRect.width <= rowRect.x + rowRect.width + 1;
    };

    return {
      key: sourceEntry.key,
      foundInCapture: Boolean(captureEntry?.found),
      sourceTitleWrapperText: sourceEntry.titleWrapperText,
      captureTitleWrapperText: captureEntry?.titleWrapperText || "",
      sourceTitleText: sourceEntry.titleText,
      captureTitleText: captureEntry?.titleText || "",
      sourceQtyText: sourceEntry.qtyText,
      captureQtyText: captureEntry?.qtyText || "",
      sourceExtraTagText: sourceEntry.extraTagText,
      captureExtraTagText: captureEntry?.extraTagText || "",
      rowRectDelta,
      titleWrapperRectDelta,
      titleTextRectDelta,
      qtyRectDelta,
      extraTagRectDelta,
      rowStyleDiff,
      titleWrapperStyleDiff,
      titleTextStyleDiff,
      qtyStyleDiff: compareStyles(sourceEntry.qtyComputed, captureEntry?.qtyComputed || null),
      extraTagStyleDiff,
      qtyWithinRow: {
        source: isQtyWithinRow(sourceEntry.rowRect, sourceEntry.qtyRect),
        capture: isQtyWithinRow(captureEntry?.rowRect || null, captureEntry?.qtyRect || null),
      },
      within1px: {
        titleWrapperRect: isWithinOnePixel(titleWrapperRectDelta),
        titleTextRect: isWithinOnePixel(titleTextRectDelta),
        extraTagRect: isWithinOnePixel(extraTagRectDelta),
      },
    };
  });
}

function collectFontRequirements(root: HTMLElement): FontRequirement[] {
  const requirements = new Map<string, FontRequirement>();
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  elements.forEach((element) => {
    const computed = window.getComputedStyle(element);
    const normalizedFamily = normalizePdfFontFamily(computed.fontFamily || "");
    const families = extractConcreteFontFamilies(normalizedFamily);
    const weight = normalizeWeight(computed.fontWeight || "400");
    const style = normalizeStyle(computed.fontStyle || "normal");

    families.forEach((family) => {
      const key = `${family}|${weight}|${style}`;
      if (!requirements.has(key)) {
        requirements.set(key, { family, weight, style });
      }
    });
  });

  return Array.from(requirements.values());
}

async function loadAndStabilizeFonts(
  doc: Document,
  requirements: FontRequirement[],
  log: DebugLogger,
): Promise<{ elapsedMs: number; fontsTimeout: boolean }> {
  const startedAt = performance.now();
  const fontSet = doc.fonts;
  if (!fontSet || requirements.length === 0) {
    return { elapsedMs: 0, fontsTimeout: false };
  }

  await fontSet.ready.catch(() => undefined);
  await Promise.allSettled(
    requirements.map((entry) =>
      fontSet.load(`${entry.style} ${entry.weight} 16px "${entry.family}"`),
    ),
  );

  const probe = doc.createElement("span");
  probe.textContent = "mmmmmmmmmWWWWWW000000";
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";
  probe.style.fontSize = "36px";
  probe.style.whiteSpace = "nowrap";
  doc.body.appendChild(probe);

  const timeoutAt = startedAt + FONT_READY_TIMEOUT_MS;
  let fontsTimeout = false;

  while (performance.now() < timeoutAt) {
    const allReady = requirements.every((entry) => {
      const checkQuery = `${entry.style} ${entry.weight} 16px "${entry.family}"`;
      const isChecked = fontSet.check(checkQuery);

      probe.style.fontFamily = `"${entry.family}", monospace`;
      probe.style.fontWeight = String(entry.weight);
      probe.style.fontStyle = entry.style;
      const widthWithFamily = probe.getBoundingClientRect().width;
      const heightWithFamily = probe.getBoundingClientRect().height;

      probe.style.fontFamily = "monospace";
      probe.style.fontWeight = "400";
      probe.style.fontStyle = "normal";
      const widthFallback = probe.getBoundingClientRect().width;
      const heightFallback = probe.getBoundingClientRect().height;

      const hasMetricDiff =
        Math.abs(widthWithFamily - widthFallback) > 0.1 ||
        Math.abs(heightWithFamily - heightFallback) > 0.1;

      return isChecked && hasMetricDiff;
    });

    if (allReady) break;
    await new Promise((resolve) => window.setTimeout(resolve, 60));
  }

  if (performance.now() >= timeoutAt) {
    fontsTimeout = true;
  }

  probe.remove();
  const elapsedMs = Math.round(performance.now() - startedAt);

  log("font stabilization", {
    elapsedMs,
    fontsTimeout,
    requirements,
  });

  return { elapsedMs, fontsTimeout };
}

function applyImagePlaceholder(image: HTMLImageElement): void {
  const rect = image.getBoundingClientRect();
  if (!image.style.width && rect.width > 0) {
    image.style.width = `${rect.width}px`;
  }
  if (!image.style.height && rect.height > 0) {
    image.style.height = `${rect.height}px`;
  }
  image.src = TRANSPARENT_PIXEL_DATA_URL;
  image.removeAttribute("srcset");
  image.sizes = "";
}

async function proxyAndLoadImages(
  container: HTMLElement,
  options: { apiBaseUrl: string; tenantId?: string; disableCache: boolean },
  log: DebugLogger,
): Promise<ImageLoadResult> {
  const startedAt = performance.now();
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  const before = images.map((img, index) => getImageDebugEntry(img, index));
  const cleanupTasks: Array<() => void> = [];

  const backgroundNodes = [container, ...Array.from(container.querySelectorAll<HTMLElement>("*"))];
  let proxiedBackgroundImagesCount = 0;
  backgroundNodes.forEach((node) => {
    const computedBackgroundImage = window.getComputedStyle(node).backgroundImage || "";
    if (!computedBackgroundImage || !computedBackgroundImage.includes("url(")) return;

    const replaced = replaceBackgroundUrlsWithProxy(computedBackgroundImage, options);
    if (replaced.replacedCount <= 0) return;

    proxiedBackgroundImagesCount += replaced.replacedCount;
    const previousValue = node.style.getPropertyValue("background-image");
    const previousPriority = node.style.getPropertyPriority("background-image");
    cleanupTasks.push(() => {
      if (previousValue) {
        node.style.setProperty("background-image", previousValue, previousPriority || "");
      } else {
        node.style.removeProperty("background-image");
      }
    });
    node.style.setProperty("background-image", replaced.value, "important");
  });

  if (images.length === 0) {
    const directRemoteImageRequestsCount = countDirectRemoteImageRequests(container);
    return {
      totalImages: 0,
      decodedImages: 0,
      failedImages: 0,
      proxiedImagesCount: 0,
      proxiedBackgroundImagesCount,
      directRemoteImageRequestsCount,
      waitMs: 0,
      before,
      after: [],
      cleanup: () => {
        while (cleanupTasks.length > 0) {
          const task = cleanupTasks.pop();
          if (!task) continue;
          task();
        }
      },
    };
  }

  images.forEach((image) => normalizeImageForCapture(image));

  const uniqueSourceUrls = new Set(
    images
      .map((image) => getImageCaptureSource(image))
      .filter(
        (src) =>
          src &&
          !src.startsWith("data:") &&
          !src.startsWith("blob:") &&
          !src.startsWith("about:") &&
          isHttpUrl(src),
      ),
  );

  const proxiedMap = new Map<string, string>();
  let proxiedImagesCount = 0;

  Array.from(uniqueSourceUrls).forEach((rawUrl, index) => {
    if (!isCrossOriginHttpUrl(rawUrl)) {
      return;
    }

    proxiedMap.set(
      rawUrl,
      buildProxyImageUrl(rawUrl, {
        ...options,
        index,
      }),
    );
  });

  images.forEach((image) => {
    const previousSrc = image.getAttribute("src");
    const previousSrcset = image.getAttribute("srcset");
    const previousSizes = image.getAttribute("sizes");
    const previousLoading = image.getAttribute("loading");
    const previousDecoding = image.getAttribute("decoding");
    const previousCrossOrigin = image.getAttribute("crossorigin");
    cleanupTasks.push(() => {
      if (previousSrc === null) image.removeAttribute("src");
      else image.setAttribute("src", previousSrc);
      if (previousSrcset === null) image.removeAttribute("srcset");
      else image.setAttribute("srcset", previousSrcset);
      if (previousSizes === null) image.removeAttribute("sizes");
      else image.setAttribute("sizes", previousSizes);
      if (previousLoading === null) image.removeAttribute("loading");
      else image.setAttribute("loading", previousLoading);
      if (previousDecoding === null) image.removeAttribute("decoding");
      else image.setAttribute("decoding", previousDecoding);
      if (previousCrossOrigin === null) image.removeAttribute("crossorigin");
      else image.setAttribute("crossorigin", previousCrossOrigin);
    });

    const captureSource = getImageCaptureSource(image);
    const proxied = proxiedMap.get(captureSource);
    if (proxied) {
      image.crossOrigin = "anonymous";
      image.loading = "eager";
      image.decoding = "sync";
      image.src = proxied;
      image.removeAttribute("srcset");
      image.sizes = "";
      proxiedImagesCount += 1;
    } else if (captureSource && !captureSource.startsWith("about:")) {
      image.crossOrigin = "anonymous";
      image.loading = "eager";
      image.decoding = "sync";
      image.src = captureSource;
      image.removeAttribute("srcset");
      image.sizes = "";
    }
  });

  let decodedImages = 0;
  let failedImages = 0;

  await Promise.all(
    images.map(async (image, index) => {
      if (isImageLoaded(image)) {
        decodedImages += 1;
        return;
      }

      let status: "ok" | "error" | "timeout" = "ok";
      try {
        if (typeof image.decode === "function") {
          await waitWithTimeout(image.decode(), IMAGE_DECODE_TIMEOUT_MS);
        } else {
          await waitWithTimeout(
            new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            }),
            IMAGE_DECODE_TIMEOUT_MS,
          );
        }
      } catch (error) {
        status = error instanceof Error && error.message === "timeout" ? "timeout" : "error";
      }

      if (isImageLoaded(image)) {
        decodedImages += 1;
      } else {
        failedImages += 1;
        applyImagePlaceholder(image);
      }

      const entry = getImageDebugEntry(image, index);
      entry.decodeStatus = status === "ok" && isImageLoaded(image) ? "ok" : status;
      log("image decode status", entry);
    }),
  );

  const after = images.map((img, index) => getImageDebugEntry(img, index));
  const waitMs = Math.round(performance.now() - startedAt);
  const directRemoteImageRequestsCount = countDirectRemoteImageRequests(container);

  return {
    totalImages: images.length,
    decodedImages,
    failedImages,
    proxiedImagesCount,
    proxiedBackgroundImagesCount,
    directRemoteImageRequestsCount,
    waitMs,
    before,
    after,
    cleanup: () => {
      while (cleanupTasks.length > 0) {
        const task = cleanupTasks.pop();
        if (!task) continue;
        task();
      }
    },
  };
}

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  if (!crypto?.subtle) return "";
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getRootDescriptor(rootElement: HTMLElement): string {
  if (rootElement.id) return `#${rootElement.id}`;
  const className = rootElement.className?.toString().trim();
  if (className) return `${rootElement.tagName.toLowerCase()}.${className.split(/\s+/)[0]}`;
  return rootElement.tagName.toLowerCase();
}

function getRootImageCount(rootElement: HTMLElement): number {
  return rootElement.querySelectorAll("img").length;
}

export async function renderToPdf({
  rootElement,
  rootHint,
  proposalTitle,
  tenantId,
  sourceLabel = "download",
  apiBaseUrl,
  scale: _scale = DEFAULT_SCALE,
}: RenderToPdfOptions): Promise<RenderToPdfResult> {
  const captureScale = FORCED_HTML2CANVAS_SCALE;
  const log = createDebugLogger();
  const startedAt = performance.now();

  const html2canvas = (await import("html2canvas")).default;
  const jsPDF = (await import("jspdf")).default;

  const canvasProbe = document.createElement("canvas");
  canvasProbe.width = 1;
  canvasProbe.height = 1;
  const canvasCtx = canvasProbe.getContext("2d", { willReadFrequently: true });

  const rootDescriptor = getRootDescriptor(rootElement);
  const captureTargetSelector = getCaptureTargetSelector(rootElement);
  const rootImagesCount = getRootImageCount(rootElement);
  const originalImageSnapshot = createOriginalImageSnapshot(
    rootElement,
    Math.max(rootImagesCount, 1),
  );
  const sourceLayoutSnapshot = createLayoutSnapshot(rootElement, 5);
  const sourceTextDebugSamples = collectTextDebugSamples(rootElement);
  const sourceProductLayoutDiagnostics = collectProductLayoutDiagnostics(rootElement);

  log("start", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    rootDescriptor,
    rootImagesCount,
    scale: captureScale,
  });
  log("source layout snapshot", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    snapshot: sourceLayoutSnapshot,
  });
  log("source text diagnostics", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    samples: sourceTextDebugSamples,
  });
  log("source product row diagnostics", {
    sourceLabel,
    rootHint: rootHint || rootDescriptor,
    samples: sourceProductLayoutDiagnostics,
  });

  await ensureSourceImagesReady(rootElement, log);

  let prepared: CaptureDomPreparation | null = null;
  let captureStyle: HTMLStyleElement | null = null;
  const previousCaptureTargetAttribute = rootElement.getAttribute(CAPTURE_TARGET_ATTR);
  rootElement.setAttribute(CAPTURE_TARGET_ATTR, "1");

  try {
    prepared = prepareDomForPdfCapture(rootElement);
    captureStyle = addCaptureModeStyle(document);

    await waitForRaf();
    await waitForRaf();

    const fontRequirements = collectFontRequirements(rootElement);
    const fontResult = await loadAndStabilizeFonts(document, fontRequirements, log);

    await waitForLayoutStability(rootElement, log);
    log("capture target diagnostics (original)", {
      captureTargetSelector,
      captureTargetSnippet: (rootElement.outerHTML || "").slice(0, 200),
      rootRect: getElementRectSnapshot(rootElement),
      pageMetrics: getPageRectDiagnostics(rootElement),
      pageCountInTarget: rootElement.querySelectorAll("[data-page-index]").length,
    });
    const captureLayoutSnapshot = createLayoutSnapshot(rootElement, 5);
    const captureTextDebugSamples = collectTextDebugSamples(
      rootElement,
      sourceTextDebugSamples.map((sample) => sample.key),
    );
    const captureProductLayoutDiagnostics = collectProductLayoutDiagnostics(rootElement);
    log("capture layout snapshot", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      snapshot: captureLayoutSnapshot,
    });
    log("capture text diagnostics", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      samples: captureTextDebugSamples,
    });
    log("source vs capture layout diff", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      diff: summarizeLayoutDiff(sourceLayoutSnapshot, captureLayoutSnapshot),
    });
    log("source vs capture text diff", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      diff: summarizeTextDebugDiffs(sourceTextDebugSamples, captureTextDebugSamples),
    });
    log("capture product row diagnostics", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      samples: captureProductLayoutDiagnostics,
    });
    log("source vs capture product row diff", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      diff: summarizeProductLayoutDiagnostics(
        sourceProductLayoutDiagnostics,
        captureProductLayoutDiagnostics,
      ),
    });

    log("root image diagnostics", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      rootDescriptor,
      note: "clone-level diagnostics logged per page during onclone",
    });

    const pageElements = Array.from(
      rootElement.querySelectorAll<HTMLElement>("[data-page-index]"),
    );

    if (pageElements.length === 0) {
      throw new Error("Nenhuma página foi encontrada para renderizar o PDF.");
    }

    log("page diagnostics", {
      sourceLabel,
      rootHint: rootHint || rootDescriptor,
      pageElementsCount: pageElements.length,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const canvasSizes: Array<{ width: number; height: number }> = [];
    const html2CanvasOptions = {
      scale: captureScale,
      useCORS: true,
      logging: false,
      allowTaint: false,
      backgroundColor: "#ffffff",
      width: PAGE_WIDTH_PX,
      height: PAGE_HEIGHT_PX,
      windowWidth: PAGE_WIDTH_PX,
      windowHeight: PAGE_HEIGHT_PX,
    };
    log("html2canvas options", {
      ...html2CanvasOptions,
      letterRendering: "not-set",
      foreignObjectRendering: "not-set",
    });

    const captureProxyOptions = {
      apiBaseUrl: getApiBaseUrl(apiBaseUrl),
      tenantId,
      disableCache: process.env.NODE_ENV !== "production" && getPdfDebugEnabled(),
    };
    const aggregateUnsupportedColorHitsByProperty: Record<string, number> = {};
    let aggregateUnsupportedColorElementsCount = 0;
    let aggregateBgModernFlaggedCount = 0;
    let aggregateGlobalOverridesApplied = false;
    let aggregateNormalizedColorsCount = 0;
    let aggregateRemainingUnsupportedColorCount = 0;
    let blankCanvasPages = 0;
    let aggregateTotalImages = 0;
    let aggregateDecodedImages = 0;
    let aggregateFailedImages = 0;
    let aggregateProxiedImagesCount = 0;
    let aggregateProxiedBackgroundImagesCount = 0;
    let aggregateDirectRemoteImageRequestsCount = 0;
    let aggregateImageWaitMs = 0;

    for (let pageIndex = 0; pageIndex < pageElements.length; pageIndex += 1) {
      const pageElement = pageElements[pageIndex];
      let latestCloneErrorDiagnostics: unknown = null;
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(pageElement, {
          ...html2CanvasOptions,
          onclone: async (clonedDoc) => {
            const cloneStats = await prepareCloneForCapture(
              clonedDoc,
              captureProxyOptions,
              captureTargetSelector,
              log,
            );
            Object.entries(cloneStats.unsupportedColorHitsByProperty).forEach(([propertyName, count]) => {
              aggregateUnsupportedColorHitsByProperty[propertyName] =
                (aggregateUnsupportedColorHitsByProperty[propertyName] || 0) + count;
            });
            aggregateUnsupportedColorElementsCount += cloneStats.unsupportedColorElementsCount;
            aggregateBgModernFlaggedCount += cloneStats.bgModernFlaggedCount;
            aggregateGlobalOverridesApplied =
              aggregateGlobalOverridesApplied || cloneStats.globalOverridesApplied;
            aggregateNormalizedColorsCount += cloneStats.normalizedColorsCount;
            aggregateRemainingUnsupportedColorCount += cloneStats.remainingUnsupportedColorCount;
            aggregateTotalImages += cloneStats.totalImages;
            aggregateDecodedImages += cloneStats.decodedImages;
            aggregateFailedImages += cloneStats.failedImages;
            aggregateProxiedImagesCount += cloneStats.proxiedImagesCount;
            aggregateProxiedBackgroundImagesCount += cloneStats.proxiedBackgroundImagesCount;
            aggregateDirectRemoteImageRequestsCount += cloneStats.directRemoteImageRequestsCount;
            aggregateImageWaitMs += cloneStats.imageWaitMs;
            latestCloneErrorDiagnostics = {
              pageIndex,
              remainingUnsupportedColorCount: cloneStats.remainingUnsupportedColorCount,
              unsupportedColorHitsByProperty: cloneStats.unsupportedColorHitsByProperty,
            };
            log("clone capture diagnostics", {
              pageIndex,
              captureTargetSelector: cloneStats.captureTargetSelector,
              captureTargetSnippet: cloneStats.captureTargetSnippet,
              captureTargetRect: cloneStats.captureTargetRect,
              captureTargetPages: cloneStats.captureTargetPages,
              pageCountInTarget: cloneStats.captureTargetPages.length,
              visibleNodeCount: cloneStats.visibleNodeCount,
              unsupportedColorHitsByProperty: cloneStats.unsupportedColorHitsByProperty,
              unsupportedColorElementsCount: cloneStats.unsupportedColorElementsCount,
              bgModernFlaggedCount: cloneStats.bgModernFlaggedCount,
              globalOverridesApplied: cloneStats.globalOverridesApplied,
              normalizedColorsCount: cloneStats.normalizedColorsCount,
              remainingUnsupportedColorCount: cloneStats.remainingUnsupportedColorCount,
              proxiedImagesCount: cloneStats.proxiedImagesCount,
              proxiedBackgroundImagesCount: cloneStats.proxiedBackgroundImagesCount,
              directRemoteImageRequestsCount: cloneStats.directRemoteImageRequestsCount,
            });
          },
        });
      } catch (error) {
        const originalView = pageElement.ownerDocument.defaultView;
        const originalComputed = originalView ? originalView.getComputedStyle(pageElement) : null;
        log("html2canvas error diagnostics", {
          pageIndex,
          errorMessage: error instanceof Error ? error.message : String(error),
          note: "html2canvas parseBackgroundColor value is not directly exposed; logging nearest CSS candidates",
          originalPageElementStyles: {
            background: originalComputed?.getPropertyValue("background") || "",
            backgroundImage: originalComputed?.getPropertyValue("background-image") || "",
            backgroundColor: originalComputed?.getPropertyValue("background-color") || "",
            border: originalComputed?.getPropertyValue("border") || "",
          },
          cloneDiagnostics: latestCloneErrorDiagnostics,
        });
        throw error;
      }

      const blankInspection = inspectCanvasBlank(canvas);
      if (blankInspection.isBlankCanvas) {
        blankCanvasPages += 1;
      }
      log("canvas diagnostics", {
        pageIndex,
        width: canvas.width,
        height: canvas.height,
        isBlankCanvas: blankInspection.isBlankCanvas,
        pixelSamples: blankInspection.samples,
      });

      canvasSizes.push({ width: canvas.width, height: canvas.height });

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        0,
        A4_WIDTH_MM,
        A4_HEIGHT_MM,
      );
    }

    log("clone capture aggregate diagnostics", {
      unsupportedColorHitsByProperty: aggregateUnsupportedColorHitsByProperty,
      unsupportedColorElementsCount: aggregateUnsupportedColorElementsCount,
      bgModernFlaggedCount: aggregateBgModernFlaggedCount,
      globalOverridesApplied: aggregateGlobalOverridesApplied,
      remainingUnsupportedColorCount: aggregateRemainingUnsupportedColorCount,
      directRemoteImageRequestsCount: aggregateDirectRemoteImageRequestsCount,
      blankCanvasPages,
    });

    const blob = pdf.output("blob");
    const arrayBuffer = await blob.arrayBuffer();
    const hashHex = await hashBuffer(arrayBuffer);
    const durationMs = Math.round(performance.now() - startedAt);

    const result: RenderToPdfResult = {
      blob,
      arrayBuffer,
      filename: buildProposalPdfFilename(proposalTitle),
      pageCount: pageElements.length,
      canvasSizes,
      blobSize: blob.size,
      hashHex,
      metrics: {
        sourceLabel,
        rootHint: rootHint || rootDescriptor,
        rootDescriptor,
        pageElementsCount: pageElements.length,
        rootImagesCount,
        fontsReadyMs: fontResult.elapsedMs,
        fontsTimeout: fontResult.fontsTimeout,
        fontRequirements,
        totalImages: aggregateTotalImages,
        decodedImages: aggregateDecodedImages,
        failedImages: aggregateFailedImages,
        proxiedImagesCount: aggregateProxiedImagesCount,
        proxiedBackgroundImagesCount: aggregateProxiedBackgroundImagesCount,
        directRemoteImageRequestsCount: aggregateDirectRemoteImageRequestsCount,
        unsupportedColorHitsByProperty: aggregateUnsupportedColorHitsByProperty,
        unsupportedColorElementsCount: aggregateUnsupportedColorElementsCount,
        bgModernFlaggedCount: aggregateBgModernFlaggedCount,
        globalOverridesApplied: aggregateGlobalOverridesApplied,
        normalizedColorsCount: aggregateNormalizedColorsCount,
        remainingUnsupportedColorCount: aggregateRemainingUnsupportedColorCount,
        blankCanvasPages,
        imageWaitMs: aggregateImageWaitMs,
        durationMs,
      },
    };

    log("pdf result", {
      ...result.metrics,
      blobSize: result.blobSize,
      hashHex: result.hashHex,
      canvasSizes: result.canvasSizes,
    });

    return result;
  } finally {
    if (previousCaptureTargetAttribute === null) {
      rootElement.removeAttribute(CAPTURE_TARGET_ATTR);
    } else {
      rootElement.setAttribute(CAPTURE_TARGET_ATTR, previousCaptureTargetAttribute);
    }
    captureStyle?.remove();
    prepared?.cleanup();
    restoreOriginalImagesFromSnapshot(rootElement, originalImageSnapshot, log);
    assertOriginalImagesIntact(rootElement, originalImageSnapshot, log);
  }
}

export function savePdfBlob(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}

