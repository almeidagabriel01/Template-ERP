import { createHash } from "node:crypto";

type SectionLike = {
  id?: unknown;
  type?: unknown;
  content?: unknown;
  imageUrl?: unknown;
  styles?: Record<string, unknown>;
};

type ProductLike = {
  productId?: unknown;
  itemType?: unknown;
  productName?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  total?: unknown;
  productImage?: unknown;
  productImages?: unknown;
  productDescription?: unknown;
  status?: unknown;
  _shouldHide?: unknown;
  _isGhost?: unknown;
  _isInactive?: unknown;
};

type ProposalLike = {
  title?: unknown;
  clientName?: unknown;
  validUntil?: unknown;
  notes?: unknown;
  customNotes?: unknown;
  discount?: unknown;
  extraExpense?: unknown;
  sections?: unknown;
  products?: unknown;
  pdfSettings?: unknown;
  downPaymentEnabled?: unknown;
  downPaymentType?: unknown;
  downPaymentPercentage?: unknown;
  downPaymentValue?: unknown;
  installmentsEnabled?: unknown;
  installmentsCount?: unknown;
  installmentValue?: unknown;
};

type TenantLike = {
  id: string;
  name?: unknown;
  logoUrl?: unknown;
  primaryColor?: unknown;
  proposalDefaults?: unknown;
};

export interface ProposalPdfTemplatePayload {
  proposalId: string;
  proposal: ProposalLike;
  tenant: TenantLike;
}

type NormalizedProduct = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl: string;
  isService: boolean;
};

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toNumberValue(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function toBooleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(raw: string): string {
  return escapeHtml(raw).replace(/`/g, "&#96;");
}

function normalizeFontFamily(value: unknown): string {
  const raw = toStringValue(value);
  if (!raw) return "Arial, Helvetica, sans-serif";

  const withoutCssVars = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !/^var\(.+\)$/i.test(part));

  const normalized = withoutCssVars.join(", ").trim();
  if (!normalized) return "Arial, Helvetica, sans-serif";

  const safe = normalized.replace(/[^a-zA-Z0-9\s,'"-]/g, "");
  return safe || "Arial, Helvetica, sans-serif";
}

function lightenColor(hexColor: string, percent: number): string {
  const normalized = hexColor.replace("#", "");
  const color = normalized.length === 3
    ? normalized
        .split("")
        .map((item) => `${item}${item}`)
        .join("")
    : normalized;

  const parsed = Number.parseInt(color, 16);
  if (!Number.isFinite(parsed)) return hexColor;

  const amount = Math.round(2.55 * percent);
  const red = Math.min(255, Math.max(0, (parsed >> 16) + amount));
  const green = Math.min(255, Math.max(0, ((parsed >> 8) & 0xff) + amount));
  const blue = Math.min(255, Math.max(0, (parsed & 0xff) + amount));
  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value: unknown): string {
  const raw = toStringValue(value);
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("pt-BR");
}

function normalizeText(value: unknown): string {
  return toStringValue(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (
        entry &&
        typeof entry === "object" &&
        "url" in (entry as Record<string, unknown>) &&
        typeof (entry as Record<string, unknown>).url === "string"
      ) {
        return String((entry as Record<string, unknown>).url).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function normalizeProducts(rawProducts: unknown): NormalizedProduct[] {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .map((rawProduct, index) => {
      const product = (rawProduct || {}) as ProductLike;
      const quantity = Math.max(0, toNumberValue(product.quantity, 0));
      const unitPrice = Math.max(0, toNumberValue(product.unitPrice, 0));
      const total = Math.max(0, toNumberValue(product.total, quantity * unitPrice));
      const normalizedImages = extractImageUrls(product.productImages);
      const fallbackImage =
        toStringValue(product.productImage) || normalizedImages[0] || "";
      const isInactive = toStringValue(product.status) === "inactive" || toBooleanValue(product._isInactive);
      const isGhost = quantity <= 0 || toBooleanValue(product._isGhost);
      const shouldHide = isInactive || isGhost || toBooleanValue(product._shouldHide);

      return {
        id: toStringValue(product.productId) || `product-${index + 1}`,
        name: toStringValue(product.productName) || "Item sem nome",
        description: toStringValue(product.productDescription),
        quantity,
        unitPrice,
        total,
        imageUrl: fallbackImage,
        isService: toStringValue(product.itemType) === "service",
        shouldHide,
      };
    })
    .filter((item) => !item.shouldHide)
    .map(({ shouldHide: _shouldHide, ...rest }) => rest);
}

function generatePaymentTerms(proposal: ProposalLike): string {
  const lines: string[] = [];

  const totalValue = toNumberValue((proposal as Record<string, unknown>).totalValue, 0);
  const downPaymentEnabled = toBooleanValue(proposal.downPaymentEnabled);
  const downPaymentType = toStringValue(proposal.downPaymentType) || "value";
  const downPaymentPercentage = Math.max(0, toNumberValue(proposal.downPaymentPercentage, 0));

  const downPaymentValue =
    downPaymentType === "percentage"
      ? (totalValue * downPaymentPercentage) / 100
      : Math.max(0, toNumberValue(proposal.downPaymentValue, 0));

  if (downPaymentEnabled && downPaymentValue > 0) {
    const percentage = totalValue > 0 ? Math.round((downPaymentValue / totalValue) * 100) : 0;
    lines.push(`- Entrada: ${formatCurrency(downPaymentValue)} (${percentage}%) na aprovacao`);
  }

  const installmentsEnabled = toBooleanValue(proposal.installmentsEnabled);
  const installmentsCount = Math.max(0, Math.floor(toNumberValue(proposal.installmentsCount, 0)));
  const installmentValue = Math.max(0, toNumberValue(proposal.installmentValue, 0));

  if (installmentsEnabled && installmentsCount > 0 && installmentValue > 0) {
    lines.push(`- Parcelamento: ${installmentsCount}x de ${formatCurrency(installmentValue)}`);
  } else if (downPaymentEnabled && downPaymentValue > 0) {
    lines.push("- Saldo: na entrega");
  } else {
    lines.push("- Pagamento a vista na entrega");
  }

  lines.push("- Formas de pagamento: PIX, boleto ou cartao");
  return lines.join("\n");
}

function createDefaultSections(
  proposal: ProposalLike,
  tenant: TenantLike,
): SectionLike[] {
  const defaults = ((tenant.proposalDefaults as Record<string, unknown>) || {}) as Record<string, unknown>;
  const intro = toStringValue(defaults.introductionText);
  const scope = toStringValue(defaults.scopeText);
  const payment = toStringValue(defaults.paymentTerms) || generatePaymentTerms(proposal);
  const warranty = toStringValue(defaults.warrantyText);
  const footer = toStringValue(defaults.footerText);

  const sections: SectionLike[] = [];

  if (intro) {
    sections.push({ type: "text", content: intro });
  }

  if (scope) {
    sections.push({ type: "title", content: "Escopo do Projeto" });
    sections.push({ type: "text", content: scope });
  }

  sections.push({ type: "product-table", content: "Sistemas / Ambientes / Produtos" });

  if (payment) {
    sections.push({ type: "title", content: "Condicoes de Pagamento" });
    sections.push({ type: "text", content: payment });
  }

  if (warranty) {
    sections.push({ type: "title", content: "Garantia" });
    sections.push({ type: "text", content: warranty });
  }

  if (footer) {
    sections.push({ type: "divider", content: "" });
    sections.push({ type: "text", content: footer });
  }

  return sections;
}

function normalizeSections(
  proposal: ProposalLike,
  tenant: TenantLike,
): SectionLike[] {
  const rawSections = Array.isArray(proposal.sections)
    ? (proposal.sections as SectionLike[])
    : [];

  const sections = rawSections.length > 0
    ? rawSections
    : createDefaultSections(proposal, tenant);

  const hasProductTable = sections.some((section) => toStringValue(section.type) === "product-table");
  if (!hasProductTable) {
    sections.push({
      type: "product-table",
      content: "Sistemas / Ambientes / Produtos",
    });
  }

  const paymentTerms = generatePaymentTerms(proposal);

  return sections.map((section) => {
    if (toStringValue(section.type) !== "text") {
      return section;
    }

    const normalizedContent = normalizeText(section.content);
    const isPaymentSection =
      normalizedContent.includes("formas de pagamento") ||
      normalizedContent.includes("entrada:") ||
      normalizedContent.includes("parcelamento:") ||
      normalizedContent.includes("pagamento a vista") ||
      normalizedContent.includes("saldo:");

    if (!isPaymentSection) {
      return section;
    }

    return {
      ...section,
      content: paymentTerms,
    };
  });
}

function renderMultilineText(raw: string): string {
  const escaped = escapeHtml(raw);
  return escaped
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function renderProductsTable(products: NormalizedProduct[]): string {
  if (products.length === 0) {
    return `
      <div class="products-empty">Nenhum produto ativo para exibir.</div>
    `;
  }

  const rows = products
    .map((product) => {
      const imageCell = product.imageUrl
        ? `<img class="product-image" src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.name)}" />`
        : `<div class="product-image-placeholder">Sem imagem</div>`;

      const descriptionHtml = product.description
        ? `<div class="product-description">${escapeHtml(product.description)}</div>`
        : "";

      return `
        <tr>
          <td class="product-cell-image">${imageCell}</td>
          <td class="product-cell-name">
            <div class="product-name">${escapeHtml(product.name)}</div>
            ${descriptionHtml}
            ${product.isService ? '<span class="badge-service">Servico</span>' : ""}
          </td>
          <td class="product-cell-number">${product.quantity}</td>
          <td class="product-cell-number">${formatCurrency(product.unitPrice)}</td>
          <td class="product-cell-number product-cell-total">${formatCurrency(product.total)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="products-table" aria-label="Tabela de produtos da proposta">
      <thead>
        <tr>
          <th class="product-cell-image">Imagem</th>
          <th>Produto</th>
          <th class="product-cell-number">Qtd</th>
          <th class="product-cell-number">Valor Unit.</th>
          <th class="product-cell-number">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderFinancialSummary(proposal: ProposalLike, products: NormalizedProduct[]): string {
  const subtotal = products.reduce((sum, product) => sum + product.total, 0);
  const discountPercent = Math.max(0, toNumberValue(proposal.discount, 0));
  const extraExpense = Math.max(0, toNumberValue(proposal.extraExpense, 0));
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount + extraExpense;

  return `
    <div class="totals-grid">
      <div class="totals-item"><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
      <div class="totals-item"><span>Desconto (${discountPercent.toFixed(2)}%)</span><strong>- ${formatCurrency(discountAmount)}</strong></div>
      <div class="totals-item"><span>Despesas Extras</span><strong>${formatCurrency(extraExpense)}</strong></div>
      <div class="totals-item totals-item-grand"><span>Total</span><strong>${formatCurrency(total)}</strong></div>
    </div>
  `;
}

function renderSection(
  section: SectionLike,
  products: NormalizedProduct[],
): string {
  const sectionType = toStringValue(section.type);
  const content = toStringValue(section.content);

  if (sectionType === "product-table") {
    return `
      <section class="content-section product-section">
        <h2>${escapeHtml(content || "Sistemas / Ambientes / Produtos")}</h2>
        ${renderProductsTable(products)}
      </section>
    `;
  }

  if (sectionType === "title") {
    return `
      <section class="content-section">
        <h2>${escapeHtml(content || "Secao")}</h2>
      </section>
    `;
  }

  if (sectionType === "divider") {
    return `
      <section class="content-section">
        <hr class="section-divider" />
      </section>
    `;
  }

  if (sectionType === "image") {
    const imageUrl = toStringValue(section.imageUrl);
    if (!imageUrl) return "";

    return `
      <section class="content-section">
        <img class="section-image" src="${escapeAttr(imageUrl)}" alt="Imagem da proposta" />
      </section>
    `;
  }

  if (sectionType === "text" || !sectionType) {
    if (!content) return "";
    return `
      <section class="content-section section-text">
        ${renderMultilineText(content)}
      </section>
    `;
  }

  return "";
}

function getStableDocumentFingerprint(payload: ProposalPdfTemplatePayload): string {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return fingerprint.slice(0, 16);
}

export function renderProposalPdfHtml(payload: ProposalPdfTemplatePayload): string {
  const proposal = payload.proposal || {};
  const tenant = payload.tenant || { id: "" };

  const title = toStringValue(proposal.title) || "Proposta Comercial";
  const clientName = toStringValue(proposal.clientName) || "Cliente";
  const tenantName = toStringValue(tenant.name) || "Empresa";
  const validUntil = formatDate(proposal.validUntil);
  const logoUrl = toStringValue(tenant.logoUrl);

  const pdfSettings = (proposal.pdfSettings as Record<string, unknown>) || {};
  const fontFamily = normalizeFontFamily(pdfSettings.fontFamily);
  const primaryColorRaw =
    toStringValue(pdfSettings.primaryColor) ||
    toStringValue(tenant.primaryColor) ||
    "#2563eb";
  const primaryColor = isValidHexColor(primaryColorRaw) ? primaryColorRaw : "#2563eb";
  const secondaryColor = lightenColor(primaryColor, -18);
  const accentColor = lightenColor(primaryColor, 30);

  const coverImage =
    toStringValue(pdfSettings.coverImage) ||
    toStringValue((tenant.proposalDefaults as Record<string, unknown>)?.coverImage) ||
    "";
  const coverTitle =
    toStringValue(pdfSettings.coverTitle) ||
    title;
  const coverOpacity = Math.max(0, Math.min(100, toNumberValue(pdfSettings.coverImageOpacity, 28)));

  const proposalSections = normalizeSections(proposal, tenant);
  const products = normalizeProducts(proposal.products);
  const documentFingerprint = getStableDocumentFingerprint(payload);
  const generatedAt = new Date().toISOString();

  const contentSections = proposalSections
    .map((section) => renderSection(section, products))
    .join("\n");

  const notes =
    toStringValue(proposal.customNotes) ||
    toStringValue(proposal.notes);

  const notesBlock = notes
    ? `
      <section class="content-section section-text">
        <h2>Observacoes</h2>
        ${renderMultilineText(notes)}
      </section>
    `
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      :root {
        --pdf-primary: ${primaryColor};
        --pdf-secondary: ${secondaryColor};
        --pdf-accent: ${accentColor};
        --pdf-text: #1f2937;
        --pdf-muted: #6b7280;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 210mm;
        background: #f3f4f6;
        color: var(--pdf-text);
        font-family: ${fontFamily};
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .pdf-page {
        width: 210mm;
        min-height: 297mm;
        background: #ffffff;
        position: relative;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
      }

      .pdf-page:last-of-type {
        break-after: auto;
        page-break-after: auto;
      }

      .cover {
        color: #ffffff;
        background: linear-gradient(135deg, var(--pdf-primary), var(--pdf-secondary));
      }

      .cover-overlay {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 85% 10%, rgba(255, 255, 255, 0.22), transparent 42%),
          radial-gradient(circle at 10% 85%, rgba(255, 255, 255, 0.12), transparent 40%);
      }

      .cover-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .cover-inner {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        padding: 18mm 16mm;
      }

      .cover-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12mm;
      }

      .cover-brand {
        max-width: 130mm;
      }

      .cover-company {
        font-size: 9mm;
        font-weight: 700;
        line-height: 1.1;
      }

      .cover-logo {
        width: 34mm;
        max-height: 18mm;
        object-fit: contain;
      }

      .cover-main {
        margin-top: 20mm;
        max-width: 160mm;
      }

      .cover-title {
        margin: 0 0 8mm 0;
        font-size: 16mm;
        line-height: 1.05;
        letter-spacing: 0.3px;
      }

      .cover-subtitle {
        margin: 0;
        font-size: 5mm;
        opacity: 0.92;
      }

      .cover-footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12mm;
      }

      .meta-grid {
        display: grid;
        gap: 2mm;
      }

      .meta-item {
        display: grid;
        gap: 0.4mm;
      }

      .meta-label {
        font-size: 3.1mm;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        opacity: 0.78;
      }

      .meta-value {
        font-size: 4.2mm;
        font-weight: 600;
      }

      .fingerprint {
        font-size: 2.8mm;
        opacity: 0.72;
      }

      .content-page {
        padding: 14mm 14mm 12mm;
      }

      .content-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid var(--pdf-primary);
        padding-bottom: 4mm;
        margin-bottom: 6mm;
      }

      .content-title {
        margin: 0;
        font-size: 7mm;
        color: var(--pdf-primary);
      }

      .content-subtitle {
        margin: 1mm 0 0;
        font-size: 3.5mm;
        color: var(--pdf-muted);
      }

      .content-logo {
        max-width: 32mm;
        max-height: 12mm;
        object-fit: contain;
      }

      .content-section {
        margin-bottom: 5.2mm;
      }

      .content-section h2 {
        margin: 0 0 2.4mm;
        font-size: 5mm;
        color: var(--pdf-primary);
      }

      .section-text p {
        margin: 0 0 1.4mm;
        font-size: 3.65mm;
        line-height: 1.5;
        color: #374151;
      }

      .section-divider {
        border: 0;
        border-top: 1px solid #d1d5db;
        margin: 2mm 0;
      }

      .section-image {
        width: 100%;
        max-height: 90mm;
        object-fit: contain;
        border-radius: 2mm;
        border: 1px solid #e5e7eb;
      }

      .products-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        border: 1px solid #d1d5db;
      }

      .products-table th,
      .products-table td {
        border-bottom: 1px solid #e5e7eb;
        padding: 2.2mm;
        vertical-align: top;
      }

      .products-table thead th {
        background: #f9fafb;
        color: #374151;
        font-size: 3.1mm;
        font-weight: 700;
        text-align: left;
      }

      .product-cell-image {
        width: 24mm;
      }

      .product-cell-number {
        width: 22mm;
        text-align: right;
      }

      .product-cell-total {
        font-weight: 700;
        color: var(--pdf-primary);
      }

      .product-image {
        width: 100%;
        height: 18mm;
        object-fit: cover;
        border-radius: 1.5mm;
        border: 1px solid #e5e7eb;
        display: block;
      }

      .product-image-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 18mm;
        font-size: 2.8mm;
        border: 1px dashed #d1d5db;
        color: #9ca3af;
      }

      .product-name {
        font-size: 3.4mm;
        font-weight: 600;
        color: #111827;
      }

      .product-description {
        margin-top: 1mm;
        font-size: 3mm;
        color: #6b7280;
        white-space: pre-wrap;
      }

      .badge-service {
        margin-top: 1.2mm;
        display: inline-block;
        border: 1px solid #d1d5db;
        background: #f9fafb;
        color: #4b5563;
        border-radius: 999px;
        padding: 0.5mm 2.2mm;
        font-size: 2.6mm;
      }

      .products-empty {
        border: 1px dashed #d1d5db;
        background: #f9fafb;
        padding: 6mm;
        border-radius: 2mm;
        font-size: 3.4mm;
        color: #6b7280;
        text-align: center;
      }

      .totals-grid {
        margin-top: 4mm;
        border: 1px solid #e5e7eb;
        border-radius: 2mm;
        overflow: hidden;
      }

      .totals-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2.4mm 2.8mm;
        font-size: 3.4mm;
        border-bottom: 1px solid #f1f5f9;
      }

      .totals-item:last-child {
        border-bottom: 0;
      }

      .totals-item strong {
        font-size: 3.6mm;
      }

      .totals-item-grand {
        background: #f8fafc;
        color: var(--pdf-primary);
      }

      .content-footer {
        margin-top: 7mm;
        border-top: 1px solid #e5e7eb;
        padding-top: 3mm;
        display: flex;
        justify-content: space-between;
        font-size: 2.8mm;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <section class="pdf-page cover">
      ${coverImage ? `<img class="cover-image" src="${escapeAttr(coverImage)}" alt="" style="opacity: ${coverOpacity / 100};" />` : ""}
      <div class="cover-overlay"></div>
      <div class="cover-inner">
        <div class="cover-top">
          <div class="cover-brand">
            <div class="cover-company">${escapeHtml(tenantName)}</div>
          </div>
          ${logoUrl ? `<img class="cover-logo" src="${escapeAttr(logoUrl)}" alt="Logo" />` : ""}
        </div>

        <div class="cover-main">
          <h1 class="cover-title">${escapeHtml(coverTitle)}</h1>
          <p class="cover-subtitle">Proposta preparada para ${escapeHtml(clientName)}</p>
        </div>

        <div class="cover-footer">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Cliente</span>
              <span class="meta-value">${escapeHtml(clientName)}</span>
            </div>
            ${validUntil ? `<div class="meta-item"><span class="meta-label">Valido ate</span><span class="meta-value">${escapeHtml(validUntil)}</span></div>` : ""}
          </div>
          <div class="fingerprint">Ref: ${escapeHtml(documentFingerprint)}</div>
        </div>
      </div>
    </section>

    <section class="pdf-page content-page">
      <header class="content-header">
        <div>
          <h1 class="content-title">${escapeHtml(title)}</h1>
          <p class="content-subtitle">${escapeHtml(tenantName)}</p>
        </div>
        ${logoUrl ? `<img class="content-logo" src="${escapeAttr(logoUrl)}" alt="Logo" />` : ""}
      </header>

      ${contentSections}
      ${renderFinancialSummary(proposal, products)}
      ${notesBlock}

      <footer class="content-footer">
        <span>Documento gerado automaticamente</span>
        <span>${escapeHtml(formatDate(generatedAt))}</span>
      </footer>
    </section>
  </body>
</html>`;
}
