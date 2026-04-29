# Plano: Bug do Valor Fechado, SEO+Favicon, Loaders, IA em Campos

## Contexto

5 trabalhos distintos no ProOps (Next.js 16 + Firebase Cloud Functions, multi-tenant, PT-BR):

1. **Bug financeiro:** ao aprovar proposta com `closedValue` (valor fechado) menor que `totalValue`, a transação criada no financeiro nasce com o valor errado. Investigação localizou 2 defeitos cooperando + 1 smell + 1 race no frontend.
2. **SEO fraco:** site não rankeia para "ERP", "automação residencial", "cortinas". `layout.tsx` é `"use client"` (Metadata API quebrada), sem sitemap/robots/manifest, sem OG, sem JSON-LD, título e descrição globais hardcoded em todas as rotas.
3. **Favicon não aparece:** Google + Vercel reportam erro de renderização. `<link>` mente o `type` (svg→ico), `favicon.ico` é single-frame 256×256, `favicon.svg` usa `fill="#ffffff"` (invisível em fundo branco) e nunca é referenciado.
4. **Loaders inconsistentes:** 225 ocorrências de `Loader2` em 81+ arquivos, 3 primitivas concorrentes (`Spinner`, `FullPageLoading` nunca usado, `SpinnerFallback` privado), 7+ tamanhos diferentes. `motion: ^12.34.0` já está instalado.
5. **IA para preencher campos:** existe módulo Lia (chat) com Gemini funcional; precisa expor uma rota one-shot para gerar texto em campos específicos (descrição produto, notas proposta, etc.) — Pro+ apenas.

Resultado esperado: 6 PRs incrementais, fix-1 como hotfix imediato; SEO + favicon como groundwork compartilhado; loaders e IA isolados; cada PR pequena, revisável e com testes.

---

## Estratégia de PRs (ordem de entrega)

| # | Branch | Item | Por quê primeiro/depois |
|---|--------|------|-------------------------|
| 1 | `hotfix/closed-value-sync` | 1 — bug | Sangue no chão, financeiro afetado. Independente de tudo. Hotfix em até 48h. |
| 2 | `chore/layout-server-component` | 2+3 groundwork | Layout vira Server Component (desbloqueia Metadata API e ícones Next 16). Pequeno, mecânico. |
| 3 | `feat/seo-content` | 2 conteúdo | sitemap/robots/manifest/JSON-LD/noindex sweep/landing reforçada/2 páginas de nicho. Depende de #2. |
| 4 | `feat/loader-primitive` | 4 base | Novo `<Loader>` + `<Button loading>` + re-export de `Spinner`. Backwards-compat. Pode rodar em paralelo com #3. |
| 5..N | `chore/loader-migration-<área>` | 4 sweep | 1 PR por diretório (proposals, products, transactions, etc.). Mecânico, <10 min de review. |
| N+1 | `feat/ai-field-generation` | 5 | Endpoint novo + `<AIFieldButton>`. Pro+ gate. Sem dependência. |

---

## Fase 1 — Bug closedValue (hotfix)

### Diagnóstico (já validado nos arquivos)

**`functions/src/api/controllers/proposals.controller.ts`:**
- L1599-1620 — `approvedSyncFields` whitelist NÃO inclui `closedValue`. Editar só `closedValue` em proposta aprovada não dispara re-sync das transações.
- L686-765 — `buildApprovedProposalTransactionDrafts`: branches de **entrada** e **parcelas** leem `proposalData.downPaymentValue` e `proposalData.installmentValue` direto do payload. **Nunca derivam de `closedValue`**. Só o branch de transação simples (L767-807) consulta `closedValue || totalValue`.
- L1652 — `if (false && isAlreadyApproved) { … ~150 linhas … }` — código morto (`false &&` curto-circuita). Removido nesta PR.
- L1556-1568 — recompute de `safeUpdate.totalValue` ignora `closedValue`. **Não é bug** dado o contrato (`totalValue` rastreia produtos; `closedValue` é override manual). Adicionar comentário explicando o invariante para evitar "fix" futuro.

**Frontend `src/hooks/proposal/useProposalForm.product-submit.ts`:**
- L380-413 — `useEffect`s sincronizam `downPaymentValue`/`installmentValue` com base em `closedValue` mas podem ficar atrás de re-render. Race que envia payload com valores stale.

### Mudanças

**1. `functions/src/api/controllers/proposals.controller.ts`:**

```typescript
// L1599-1620 — adicionar "closedValue" na whitelist
const approvedSyncFields = new Set([
  ..., "closedValue",  // NEW
]);
```

```typescript
// L653-810 — refatorar buildApprovedProposalTransactionDrafts
// Topo da função: derive effectiveTotalValue UMA vez:
const effectiveTotalValue = Number(proposalData.closedValue) > 0
  ? Number(proposalData.closedValue)
  : Number(proposalData.totalValue || 0);

// Branch downPayment (L686-716): derivar amount do effectiveTotalValue
const downPaymentAmount = downPaymentEnabled
  ? (String(proposalData.downPaymentType) === "percentage"
      ? roundCents(effectiveTotalValue * (Number(proposalData.downPaymentPercentage || 0) / 100))
      : Math.min(Number(proposalData.downPaymentValue || 0), effectiveTotalValue))
  : 0;

// Branch installments (L737-764): distribuir o que sobra
const remaining = Math.max(0, effectiveTotalValue - downPaymentAmount);
const baseInstallment = roundCents(remaining / installmentsCount);
// loop: amount = i === installmentsCount - 1
//   ? roundCents(remaining - baseInstallment * (installmentsCount - 1))  // última absorve resto
//   : baseInstallment;

// Branch transação simples (L767-807): já usa effectiveTotalValue, manter.
```

`roundCents = (n) => Math.round(n * 100) / 100`. **Última parcela absorve o resto do arredondamento** — convenção brasileira; soma das transações == `effectiveTotalValue` ao centavo.

**2. Remover código morto** L1652 (bloco `if (false && …)`) — verificar antes que nenhuma variável vazada é usada depois (é self-contained).

**3. Comentário em L1567** explicando o invariante `totalValue` (derivado de produtos) vs `closedValue` (override manual).

**4. Frontend (UX, não correção financeira pós-fix backend):** em `useProposalForm.product-submit.ts` `handleSubmit` (L456+), recomputar `downPaymentValue` e `installmentValue` síncronamente antes de chamar `prepareCreatePayload`, usando os callbacks memoizados existentes. ~5 linhas. Resolve flicker de UI; o backend agora garante correção mesmo se isso não rodar.

### Script de reconciliação (decisão confirmada: SIM)

`functions/src/scripts/reconcile-closed-value-proposals.ts` — idempotente, dryRun primeiro:

```typescript
// Pseudocódigo
// 1. Query proposals where status="approved" AND closedValue > 0 AND closedValue !== totalValue
// 2. Para cada: simular drafts com a função fixada
// 3. Comparar com transactions atuais (somar amounts onde proposalId == p.id)
// 4. Se diff > 0.01: log {proposalId, expected, actual, diff}
// 5. Se !dryRun: chamar syncApprovedProposalTransactions e logar mutação
// Flags: --dryRun (default true), --tenantId <id> (escopa por tenant)
```

Roda manualmente após deploy: `cd functions && npm run reconcile -- --dryRun`. Validar logs. Rodar real só após inspecionar a lista.

### Testes

**Unit (criar `functions/src/api/controllers/proposals.controller.test.ts` — não existe ainda):**

1. `closedValue=4500, totalValue=5000` + downPayment 30% + 3 parcelas → entrada 1350, 3 parcelas = 1050 cada (soma 4500).
2. `closedValue=4500` + downPayment valor 1500 + 2 parcelas → entrada 1500, 2 parcelas = 1500 cada (soma 4500).
3. `closedValue=4500`, sem entrada nem parcelas → 1 transação 4500.
4. Editar só `closedValue` em proposta aprovada → re-sync disparada, transações atualizadas.
5. Editar `installmentsCount` em proposta aprovada com closedValue → parcelas redistribuídas.
6. **Arredondamento:** `closedValue=1000, 3 parcelas` → 333.33 + 333.33 + 333.34 (soma exata).

**E2E (Playwright):** adicionar 1 teste em `e2e/proposals/`: criar proposta total 5000 → set closedValue 4500 → aprovar → assert soma das transações == 4500.

### Arquivos críticos

- `D:\DEV\ProOps\functions\src\api\controllers\proposals.controller.ts` (L1599-1620, L686-810, L1652, L1567)
- `D:\DEV\ProOps\functions\src\api\controllers\proposals.CLAUDE.md` (atualizar L437-444 documentando o novo invariante)
- `D:\DEV\ProOps\src\hooks\proposal\useProposalForm.product-submit.ts` (L456 — recompute síncrono)
- `D:\DEV\ProOps\functions\src\scripts\reconcile-closed-value-proposals.ts` (NOVO)
- `D:\DEV\ProOps\functions\src\api\controllers\proposals.controller.test.ts` (NOVO)

### Verificação

```bash
cd functions && npm run lint && npx tsc --noEmit && npm test
npm run test:e2e -- proposals
firebase emulators:start  # validar manual o fluxo completo
# Após deploy: npm run reconcile -- --dryRun  → revisar logs → rodar real
```

---

## Fase 2 — Layout refactor (groundwork SEO + Favicon)

### Mudança pivotal

`src/app/layout.tsx` está hoje como `"use client"`. Isso impede:
- `export const metadata` (Metadata API só roda em Server Components)
- Convenção de ícones Next 16 não tem efeito útil
- Verification Google, OG dinâmico, canonical, etc. — nada disso funciona

### Refator

**Criar `src/app/providers.tsx` (`"use client"`)** absorvendo TODO o tree atual:
- `ThemeProvider`, `ErrorBoundary`, `AuthProvider`
- Lógica de branching por pathname (landing/share/auth/protected) — usa `usePathname`
- `PermissionsProvider`, `TenantProvider`, `PlanProvider`, `ProtectedRoute`
- `ToastProvider`
- **Remover** chamada ao hook `usePageTitle()` (será substituído por metadata por rota)

**`src/app/layout.tsx` vira Server Component (zero `"use client"`):**
- Estrutura `<html>`, `<body>`
- `next/font` imports
- `<Analytics />` (UMA vez — fix do duplicate render L132+L135)
- `<SpeedInsights />`
- `export const metadata` com `metadataBase` (URL absoluta — env-driven)
- `export const viewport`
- Renderiza `<Providers>{children}</Providers>`

### Metadata raiz

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://proops.com.br"),
  title: { default: "ProOps — ERP para automação residencial e cortinas", template: "%s | ProOps" },
  description: "ProOps é o ERP completo para empresas de serviço: propostas, CRM, financeiro, agenda e WhatsApp integrados em uma plataforma online com editor de PDF profissional.",
  applicationName: "ProOps",
  keywords: ["ERP automação residencial", "ERP cortinas", "sistema gestão de serviços", "propostas comerciais", "CRM kanban", "ERP brasileiro", "gestão financeira PMEs", "editor PDF propostas"],
  authors: [{ name: "ProOps" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    url: "/",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps — ERP para gestão de serviços" }],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image.png"] },
  alternates: { canonical: "/" },
  verification: { google: process.env.NEXT_PUBLIC_SEARCH_CONSOLE_VERIFICATION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }],
};
```

### Itens combinados nesta PR

- Remover `<Analytics />` duplicado (deixar apenas 1, dentro do `<Providers>`).
- Deletar `src/hooks/usePageTitle.ts` e remover todos os imports (substituídos por metadata por rota nas próximas PRs).

### Favicon (Item 3) entra junto

**Criar em `src/app/`** (convenção Next 16 gera `<link>` automaticamente):
- `src/app/icon.svg` — copiar `public/logo/logo2-cropped.svg`, **trocar `fill="#ffffff"` por `fill="currentColor"`** (renderiza correto em fundo claro e escuro). 32×32 viewbox.
- `src/app/icon.png` — 32×32 PNG do logo
- `src/app/apple-icon.png` — 180×180, fundo sólido brand (Apple não aceita transparente)
- `src/app/opengraph-image.png` — 1200×630, marca + tagline "ERP para automação residencial e cortinas"
- `src/app/twitter-image.png` — 1200×630 (pode reusar OG)

**Substituir `public/favicon.ico`** por multi-frame (16, 32, 48, 256) gerado a partir do SVG corrigido. Ferramenta: `realfavicongenerator.net` ou `imagemagick convert`.

**Deletar `public/favicon.svg`** (órfão, branco invisível, gera confusão).

**Em `src/app/layout.tsx`:** REMOVER os `<link rel="icon" …>` manuais. Next gera sozinho a partir dos arquivos `icon.*` em `src/app/`.

### Arquivos críticos

- `D:\DEV\ProOps\src\app\layout.tsx` (Server Component completo)
- `D:\DEV\ProOps\src\app\providers.tsx` (NOVO — toda a parte client)
- `D:\DEV\ProOps\src\app\icon.{svg,png}`, `apple-icon.png`, `opengraph-image.png`, `twitter-image.png` (NOVOS)
- `D:\DEV\ProOps\public\favicon.ico` (substituir)
- `D:\DEV\ProOps\public\favicon.svg` (deletar)
- `D:\DEV\ProOps\src\hooks\usePageTitle.ts` (deletar + sweep imports)

### Verificação

```bash
npm run dev
# Inspect HTML <head> em / — confirma <link rel="icon" type="image/png">, OG tags, canonical
curl -I http://localhost:3000/favicon.ico  # 200, content-type image/x-icon
# Após deploy: opengraph.xyz, Slack/WhatsApp unfurl, Google SERP "site:proops.com.br"
```

---

## Fase 3 — SEO conteúdo (depende da Fase 2)

### 1. `src/app/sitemap.ts`

```typescript
import type { MetadataRoute } from "next";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proops.com.br";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/automacao-residencial`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/cortinas`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
```

### 2. `src/app/robots.ts`

```typescript
import type { MetadataRoute } from "next";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proops.com.br";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/share/", "/admin/", "/dashboard/", "/proposals/", "/transactions/", "/settings/", "/profile/", "/products/", "/contacts/", "/crm/", "/team/", "/wallets/", "/spreadsheets/", "/services/", "/automation/", "/calendar/", "/notifications/", "/login", "/register", "/forgot-password", "/subscribe", "/checkout", "/checkout-success", "/addon-success", "/auth/", "/403", "/subscription-blocked"] }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
```

### 3. `src/app/manifest.ts`

```typescript
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProOps — ERP para gestão de serviços",
    short_name: "ProOps",
    description: "ERP completo para automação residencial, cortinas e empresas de serviço.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    lang: "pt-BR",
    categories: ["business", "productivity"],
  };
}
```
+ adicionar `public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`.

### 4. JSON-LD

`src/components/seo/json-ld.tsx`:

```typescript
export function OrganizationJsonLd() { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({...}) }} />; }
export function SoftwareApplicationJsonLd({ niche?: "automacao_residencial" | "cortinas" }) { ... }
export function WebSiteJsonLd() { ... }  // com SearchAction
export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) { ... }
```

Mount: layout (Org + WebSite globais), `/` (SoftwareApplication geral), `/automacao-residencial` (SoftwareApplication + Breadcrumb), `/cortinas` (idem).

### 5. Páginas de nicho (decisão: ambos — landing reforçada + 2 dedicadas)

**Landing `/` reforçada:**
- Mover H1 estático fora dos `useEffect` motion (visível pré-hidratação): "ERP para empresas de serviço — automação residencial, cortinas e mais"
- H2/H3 mencionando palavras-chave (CRM, propostas, financeiro, kanban, WhatsApp)
- Seções `#automacao-residencial` e `#cortinas` ancoradas com link interno para as dedicadas
- FAQ Section com `FAQPage` JSON-LD

**`src/app/automacao-residencial/page.tsx` (NOVA):**
- Server Component com metadata própria (title, description, keywords focados)
- H1: "ERP para Automação Residencial — propostas, projetos e gestão"
- Seções: hero, módulos (com prints), casos de uso, FAQ específica do nicho, CTA
- JSON-LD `SoftwareApplication` + `BreadcrumbList`
- Internal links para `/`, `/cortinas` e `/login`

**`src/app/cortinas/page.tsx` (NOVA):**
- Idem pattern, copy específica de cortinas e persianas
- H1: "Sistema ERP para Lojas de Cortinas e Persianas"

### 6. noindex sweep — por rota

Cada uma destas rotas exporta:
```typescript
export const metadata: Metadata = { robots: { index: false, follow: false } };
```

- `src/app/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`
- `src/app/share/[token]/page.tsx`, `share/transaction/[token]/page.tsx`
- `src/app/subscribe/page.tsx`, `checkout-success/page.tsx`, `addon-success/page.tsx`
- `src/app/403/page.tsx`, `subscription-blocked/page.tsx`, `auth/action/page.tsx`, `email-verification-pending/page.tsx`

### 7. Metadata específica para `/privacy`, `/terms`, `/automacao-residencial`, `/cortinas`

Já têm parte (privacy, terms) — completar com OG, alternates.canonical, keywords.

### 8. Search Console + GA4 — passo a passo (zero custo, decisão do usuário)

**A. Search Console (Google):**
1. Vá em https://search.google.com/search-console
2. "Adicionar propriedade" → escolha "Prefixo de URL" → digite `https://proops.com.br`
3. Método de verificação: "Tag HTML"
4. Copie o código `meta name="google-site-verification" content="XXX"`
5. Adicione `NEXT_PUBLIC_SEARCH_CONSOLE_VERIFICATION=XXX` em:
   - `.env.local` (local)
   - Vercel → Project Settings → Environment Variables (prod + preview)
6. Deploy. A meta tag aparece no `<head>` via `metadata.verification.google`.
7. Volte ao Console → "Verificar". Deve aprovar.
8. No menu lateral → "Sitemaps" → adicione `sitemap.xml` (vai virar `https://proops.com.br/sitemap.xml`).
9. "Inspeção de URL" para `https://proops.com.br/` → "Solicitar indexação". Repita para `/automacao-residencial` e `/cortinas`.

**B. Google Analytics 4 (gratuito):**
1. https://analytics.google.com → "Iniciar a medição"
2. Conta = "ProOps", Propriedade = "ProOps Web", fuso = `America/Sao_Paulo`, moeda = BRL
3. Plataforma = "Web", URL = `https://proops.com.br`, nome = "ProOps Production"
4. Copie o "ID de medição" `G-XXXXXXX`
5. Decisão: o projeto já usa Vercel Analytics. Para GA4 também: instalar `@next/third-parties` e adicionar `<GoogleAnalytics gaId="G-XXXXXXX" />` no layout (ou criar component próprio com `next/script`).
6. Adicionar `NEXT_PUBLIC_GA_ID=G-XXXXXXX` no .env.local + Vercel.
7. Em GA4 → Admin → Vincule a propriedade ao Search Console (em "Links de produtos") — unifica dados.

**C. Google Business Profile (futuro, gratuito):** se ProOps tiver endereço físico ou for SaaS B2B local, vale criar perfil.

**D. Bing Webmaster Tools (gratuito, bônus):**
1. https://www.bing.com/webmasters → "Importar do Search Console" (zero esforço se A já feito)
2. Submeter sitemap.

### 9. Eliminar `<Analytics />` duplicado já feito na Fase 2

### Arquivos críticos

- `D:\DEV\ProOps\src\app\sitemap.ts`, `robots.ts`, `manifest.ts` (NOVOS)
- `D:\DEV\ProOps\src\components\seo\json-ld.tsx` (NOVO)
- `D:\DEV\ProOps\src\app\automacao-residencial\page.tsx` (NOVO)
- `D:\DEV\ProOps\src\app\cortinas\page.tsx` (NOVO)
- `D:\DEV\ProOps\src\app\page.tsx` (refatorado: Server Component shell exportando metadata + child client component com motion)
- noindex sweep nas ~10 rotas listadas
- `D:\DEV\ProOps\.env.local.example` (documentar `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SEARCH_CONSOLE_VERIFICATION`, `NEXT_PUBLIC_GA_ID`)

### Verificação

```bash
npm run build && npm start
curl http://localhost:3000/sitemap.xml | head -20  # XML válido
curl http://localhost:3000/robots.txt              # texto com regras
curl http://localhost:3000/manifest.webmanifest    # JSON
# Lighthouse: SEO score deve subir de ~65 → 100
# Pós-deploy: Search Console / Bing Webmaster / GA4 — passo a passo na seção 8
```

---

## Fase 4 — Padronização de loaders

### Decisão de design

**Animação:** anel de gradiente conic-CSS rotativo. Razões:
- 225+ lugares; precisa ser barato. Conic-gradient é GPU-composited, zero JS runtime.
- Tema-aware via `var(--primary)` e `var(--background)` (dark mode + brand color grátis).
- Mais bonito que `Loader2` da Lucide; mantém leitura clara como "loading".
- Lottie / motion para 200+ pontos de render é exagero — `motion` permanece para casos específicos (full-page com brand animation).

### API única: `<Loader>`

`src/components/ui/loader.tsx` (NOVO):

```typescript
interface LoaderProps {
  size?: "sm" | "md" | "lg";       // 12px | 20px | 32px
  variant?: "inline" | "button" | "page" | "contained";
  className?: string;
  label?: string;                   // a11y aria-label, default "Carregando"
}
```

Variantes:
- `inline` — em texto/icon-buttons (default, size=sm)
- `button` — dentro de `<Button loading>`, herda cor do botão
- `contained` — preenche card/section (size=md, com `min-h-[200px]`)
- `page` — overlay full-viewport (substitui `FullPageLoading` morto, com brand mark animado via `motion`)

Sketch:
```tsx
<span role="status" aria-label={label} className={cn("relative inline-block", sizeClass[size])}>
  <span className="absolute inset-0 rounded-full animate-spin"
    style={{ background: "conic-gradient(from 0deg, transparent 0deg, var(--primary) 270deg, var(--primary) 360deg)" }} />
  <span className="absolute inset-[2px] rounded-full bg-background" />
</span>
```

### `<Button loading>` prop

`src/components/ui/button.tsx` ganha:
```typescript
interface ButtonProps {
  loading?: boolean;
  loadingText?: string;
}
// quando loading: disabled, substitui leftIcon por <Loader variant="button" />, opcional renderiza loadingText
```

Mata o pattern `<Loader2 className="w-4 h-4 animate-spin" /> Salvando...` em dezenas de save buttons.

### Compatibilidade reversa

`src/components/ui/spinner.tsx` continua existindo, internamente delega:
```tsx
export function Spinner({ className, ...props }: SpinnerProps) {
  return <Loader size="sm" variant="inline" className={className} {...props} />;
}
```

Migration sweep PRs em sequência mecânica — substituem `<Loader2 ... animate-spin />` por `<Loader />` ou delegam ao `<Button loading>`. **Sem feature flag** porque é backwards-compat.

### Regras (documentar no topo de `loader.tsx`)

```typescript
/**
 * <Loader /> — primitiva única de loading.
 *
 * PROIBIDO:
 * - Loader dentro de célula de lista virtualizada (use skeleton no parent)
 * - Loader dentro de map() com >20 items (use 1 Loader contained no parent)
 * - Loader em botão sem usar <Button loading> (não duplique o pattern)
 */
```

Durante o sweep, qualquer `Loader2` dentro de `.map(` é candidato a refator (não rename mecânico).

### Skeletons fora de escopo

137 ocorrências de `<Skeleton>` — são placeholders de forma, conceito diferente. Mantidos.

### Arquivos críticos

- `D:\DEV\ProOps\src\components\ui\loader.tsx` (NOVO)
- `D:\DEV\ProOps\src\components\ui\spinner.tsx` (vira proxy)
- `D:\DEV\ProOps\src\components\ui\button.tsx` (adicionar `loading` prop)
- `D:\DEV\ProOps\src\components\ui\full-page-loading.tsx` (deprecar — vira proxy de `<Loader variant="page" />`)
- `D:\DEV\ProOps\src\components\layout\route-content-skeleton.tsx` (substituir `SpinnerFallback` privado por `<Loader variant="contained" />`)

### Migration sweep (PRs separadas)

1. `src/app/transactions/**` (top hotspot — `transaction-card.tsx` tem 9 spinners)
2. `src/app/proposals/**`
3. `src/app/products/**`, `services/**`
4. `src/app/login`, `register`, `forgot-password`, `share/**`
5. `src/components/features/**`, `src/components/notifications/**`, `src/components/profile/**`
6. `src/app/admin/**`, `settings/**`, demais

Cada PR: ~10 arquivos, <10 min de review.

### Verificação

```bash
npm run dev
# Browser DevTools → Performance tab → checar que loaders não geram layout thrash
# Lighthouse: CWV (LCP/CLS) não regridem
# A11y: axe DevTools — todos os <Loader> têm role="status"
```

---

## Fase 5 — IA para preencher campos (Pro+ apenas)

### Decisão de arquitetura

**Endpoint dedicado** `POST /api/v1/ai/generate-field` (não tool da Lia). Razões:
- One-shot, não SSE, não history, não tool-calling — shape diferente do chat
- Modelo único barato para todos os tiers (`gemini-2.5-flash-lite`)
- Rate limit dimensionado separado
- FE simples: button → POST → string → setFormData

### Backend

**`functions/src/ai/field-gen.route.ts`** (NOVO):

```typescript
// Discriminated union de campos suportados:
type GenerateFieldRequest =
  | { field: "product.description"; context: { name: string; category?: string; manufacturer?: string; niche: NicheKey } }
  | { field: "product.category"; context: { name: string; description?: string; niche: NicheKey } }
  | { field: "proposal.notes"; context: { title: string; clientName: string; products: { name: string; quantity: number }[]; totalValue: number; niche: NicheKey } }
  | { field: "proposal.pdfSection"; context: { title: string; sectionType: "cover" | "scope" | "terms"; products?: ...; niche: NicheKey } }
  | { field: "item.description"; context: { name: string; category?: string; niche: NicheKey } };

// Response:
{ value: string; tokensUsed: number; remainingMessages: number }

// Errors com mesmo shape de chat: AI_FREE_TIER_BLOCKED, AI_LIMIT_EXCEEDED,
// AI_RATE_LIMIT_EXCEEDED, AI_PLAN_NOT_ALLOWED (NEW), AI_SUBSCRIPTION_INACTIVE
```

**Plan gate Pro+:**
```typescript
const ALLOWED_PLANS = new Set(["pro", "enterprise"]);
if (!ALLOWED_PLANS.has(planTier)) return res.status(403).json({ code: "AI_PLAN_NOT_ALLOWED" });
```

**Modelo:** `gemini-2.5-flash-lite` para Pro e Enterprise. Razão: 1-shot, baixo stakes, custo previsível (~$0.0001/call).

**Quota:** mesmo bucket mensal do chat (`reserveAiMessage` / `finalizeTokenUsage` / `refundAiMessage` em `usage-tracker.ts`). Conta como 1 mensagem.

**Rate limit:** novo bucket separado em `functions/src/ai/field-gen-rate-limiter.ts` — espelha `rate-limiter.ts`. 30 req/h/user, sem concorrência SSE.

**Prompts:** `functions/src/ai/prompts/field-generation.ts`:
```typescript
export function buildPrompt(req: GenerateFieldRequest): { system: string; user: string } {
  switch (req.field) {
    case "product.description":
      return {
        system: "Você é redator técnico para o nicho de " + req.context.niche + ". Responda em PT-BR, 2-3 frases, focando em diferenciais e uso. Sem prefixos como 'Descrição:'. Sem aspas.",
        user: `Produto: ${req.context.name}\nCategoria: ${req.context.category ?? "-"}\nFabricante: ${req.context.manufacturer ?? "-"}`,
      };
    // ... outros casos
  }
}
```

**Limites de output:** description=200 tok, category=80 tok, notes=500 tok, pdfSection=800 tok.

**Sanitização:** todos os `context.*` strings passam por `sanitizeText` (existente em `functions/src/utils/sanitize` se existir, senão criar; strip `<` e `>`, max 500 chars/string). Reject prompt-injection patterns óbvios (`ignore previous instructions`, etc.).

**Logger + Sentry tags:** `route: ai.field-gen`, `tenantId`, `field`, `model`.

### Frontend

**`src/components/shared/ai-field-button.tsx` (NOVO):**

```typescript
interface AIFieldButtonProps {
  field: GenerateFieldRequest["field"];
  context: () => GenerateFieldRequest["context"];   // lazy: lê form state no click
  onGenerated: (value: string) => void;
  disabledReason?: string;
}
```

UX:
- Ícone: `WandSparkles` (lucide) — desambigua de `Sparkles` que já é Lia + premium
- Posição: top-right do label do campo, h-6 w-6, ghost button
- Tooltip: "Gerar com IA"
- Disabled (faltam contextos): tooltip explica "Preencha [campo X] primeiro"
- Loading: `<Loader variant="button" />` (Fase 4)
- Sucesso: pre-fill + toast "Sugestão preenchida — revise antes de salvar"
- Erro 403 free/starter (não-Pro): modal de upgrade local (não 403 silencioso)
- Erro 429: toast "Muitas requisições, aguarde X segundos"

### Onde colar o botão (escopo restrito — não em todo lugar)

Whitelist intencional:

| Local | Campo | Por quê |
|-------|-------|---------|
| `src/app/products/_components/product-form-new.tsx:379-388` | `description` | Cópia repetitiva de alto valor |
| `src/app/products/_components/product-form-new.tsx` (campo category) | `category` | Multi-class fácil, baixo risco |
| `src/components/features/proposal/form/*` (campo notes) | `proposal.notes` | Resumo contextual |
| `src/components/pdf/*` editor de seções PDF | `proposal.pdfSection` | Maior alívio de copy |
| `src/components/features/proposal/form/proposal-products-section.tsx` (override de descrição por item) | `item.description` | Repetitivo |

**Skip:** `product.name`, `product.manufacturer`, `proposal.title` — curtos, alto risco de halucinação.

### Env vars

Já existentes (`GEMINI_API_KEY`, `AI_PROVIDER`). Documentar em `functions/.env.example` se ainda não estiver.

### Testes

**Unit:** `functions/src/ai/field-gen.route.test.ts` — mock provider via `AI_PROVIDER=mock`, validar:
1. Pro plan + valid context → 200 com value não-vazio
2. Free/Starter → 403 `AI_PLAN_NOT_ALLOWED`
3. Quota exhausted → 429 `AI_LIMIT_EXCEEDED`
4. Context faltando campo obrigatório → 400 com erro Zod
5. Prompt injection no context → sanitização strip

**E2E (Playwright):** 1 teste em `e2e/ai/field-generation.spec.ts` — login Pro user, abre criar produto, preenche nome, clica botão IA, valida que descrição é preenchida (mock provider deterministic).

### Custo estimado

`gemini-2.5-flash-lite` ≈ $0.075/M input + $0.30/M output. ~300 input + 200 output = ~$0.0001/call. Pro com 400 msg/mês: $0.04 worst-case se 100% for field-gen. Negligível.

### Arquivos críticos

- `D:\DEV\ProOps\functions\src\ai\field-gen.route.ts` (NOVO)
- `D:\DEV\ProOps\functions\src\ai\prompts\field-generation.ts` (NOVO)
- `D:\DEV\ProOps\functions\src\ai\field-gen-rate-limiter.ts` (NOVO)
- `D:\DEV\ProOps\functions\src\ai\index.ts` (montar a rota)
- `D:\DEV\ProOps\src\components\shared\ai-field-button.tsx` (NOVO)
- `D:\DEV\ProOps\src\services\ai-service.ts` (adicionar `generateField()`)
- `D:\DEV\ProOps\src\app\api\backend\[...path]\route.ts` (proxy genérico já cobre)
- formulários alvo: `product-form-new.tsx`, `simple-proposal-form.tsx`, seções PDF

### Verificação

```bash
firebase emulators:start
# Login com user Pro → criar produto → preencher nome → clicar wand → valida descrição
# Login com user Starter → clicar wand → modal upgrade aparece (não toast erro)
# DevTools Network: chamada vai pra /api/backend/v1/ai/generate-field, response < 1s
cd functions && npm test ai/field-gen
```

---

## Verificação ponta-a-ponta (todas as fases)

### Comandos locais (rodar antes de cada PR)

```bash
# Suite completa — equivalente ao CI
npm run test:e2e && npm run test:performance && npm run test:rules

# Verificações rápidas
npx tsc --noEmit                         # type-check frontend
cd functions && npx tsc --noEmit         # type-check functions
npm run lint                             # ESLint frontend
cd functions && npm run lint             # ESLint functions
npm audit --omit=dev --audit-level=critical  # security audit

# Cada fase tem comandos específicos nos verification blocks acima
```

### Branch protection

PRs vão pra `develop` → CI (`test-suite.yml`) com `all-checks-passed` deve passar antes do merge. Deploy automático para staging via `deploy-functions.yml`.

### Rollout produção

- **Fase 1 (hotfix)**: PR → CI verde → merge develop → validar staging → cherry-pick/merge para `main` → deploy auto. **Imediatamente após:** rodar `npm run reconcile -- --dryRun` em prod, revisar logs, rodar real se houver mismatches.
- **Fase 2-3 (SEO+favicon)**: rollout normal. Pós-deploy: setup Search Console + GA4 (passo a passo na Fase 3.8). "Solicitar indexação" em Search Console para forçar Google a re-crawl.
- **Fase 4 (loaders)**: foundation PR + sweeps incrementais. Sem feature flag, sem big-bang.
- **Fase 5 (IA)**: PR final. Pro+ gate é estrutural (403). Sem feature flag.

### Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Fix #1 quebra propostas com transações já erradas | Script de reconciliação dryRun → real, com logs antes/depois |
| Layout refactor quebra providers / contexto | PR pequena, revisão cuidadosa, rodar todos os testes E2E (59) e Firestore rules (41) |
| SEO regride CWV | Lighthouse CI no `performance-push.yml` já cobre; landing precisa renderizar texto sem JS (mover H1 fora de useEffect) |
| Loader migration introduz layout shift | Tamanhos fixos em `<Loader>`, conic-gradient não causa reflow; checar Lighthouse CLS |
| IA gera conteúdo impróprio | Gemini safety filters default + sanitização context + max output tokens |
| IA exhausta quota Pro do tenant | Counta no mesmo bucket de chat — usuário vê o consumo claramente; toast informativo |
| Reconciliação altera transação já paga | Script verifica `status === "paid"` e pula (ou avisa para ação manual) — adicionar essa salvaguarda |

---

## Resumo executável

6 PRs sequenciais (com paralelismo onde indicado):

1. **`hotfix/closed-value-sync`** — fix backend + script reconciliação + testes. Hotfix.
2. **`chore/layout-server-component`** — layout vira Server Component, ícones Next 16, single Analytics, deletar `usePageTitle`.
3. **`feat/seo-content`** — sitemap/robots/manifest/JSON-LD, landing reforçada, 2 páginas de nicho, noindex sweep, env vars.
4. **`feat/loader-primitive`** — `<Loader>` + `<Button loading>` + Spinner re-export. Backwards-compat.
5. **`chore/loader-migration-*`** — N PRs mecânicas (1 por área), <10 min review cada.
6. **`feat/ai-field-generation`** — endpoint Pro+ + `<AIFieldButton>` em campos whitelisted.

Cada PR tem testes (unit+E2E onde aplicável), passa por CI completo (`all-checks-passed`), deploy automático para staging via `deploy-functions.yml`. Pós-deploy: validações manuais documentadas nos blocos `Verificação` de cada fase.
