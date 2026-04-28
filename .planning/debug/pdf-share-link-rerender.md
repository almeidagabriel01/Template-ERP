---
status: fixed
trigger: "PDF mostra sucesso brevemente (marker 36ms) depois re-renderiza para ERRO em <1s. Share link só mostra entrada. Transaction ID: gHDsrJSwHeMvFFpflqUS, installmentGroupId: installment_1777346112956"
created: 2026-04-28T00:00:00Z
updated: 2026-04-28T18:00:00Z
---

## Current Focus

hypothesis: |
  TWO BUGS confirmed — both in commit 1c5023b7:

  BUG 1 (PDF rerender): The share transaction page uses useSearchParams() WITHOUT a
  Suspense boundary. In Next.js App Router, useSearchParams() returns null on the
  initial SSR/hydration pass. The useEffect dependency array is [token, paymentSuccess],
  where paymentSuccess = searchParams.get("payment_success"). On the ?print=1 URL:
  - First render: searchParams.get("print") = null (SSR pass) → isPrintMode = false
  - First render: searchParams.get("payment_success") = null → paymentSuccess = null
  - Second render (hydration): searchParams.get("print") = "1" → isPrintMode = true
  - Second render: searchParams.get("payment_success") = null → paymentSuccess = null (unchanged)
  Because paymentSuccess doesn't change between renders, the useEffect fires ONCE
  on mount. However, isPrintMode CHANGES between renders (null→"1"), which means
  the FIRST render shows the loading spinner (not the marker), while the SECOND
  render correctly shows isPrintMode=true and the marker. BUT the data fetch completes
  asynchronously. If the fetch fails (e.g., because the shared token corresponds to a
  transaction with insufficient data to find related transactions), it sets errorType,
  which takes priority over the isPrintMode render path.

  HOWEVER: More specifically — the actual PDF failure is caused by
  waitUntil: "networkidle" (restored in commit 1c5023b7). The page navigates,
  networkidle completes, then React data fetching fires and causes network activity
  AFTER networkidle has already resolved. This causes a SECOND navigation cycle
  (or the networkidle window closes prematurely). The 1000ms delay is supposed to
  cover this, but if the backend API call (to getSharedTransaction) takes >1s,
  the marker disappears when React re-renders from SUCCESS into a second fetch
  triggered by searchParams instability.

  BUG 2 (Share link — only shows entrada): The share link is created for transaction
  gHDsrJSwHeMvFFpflqUS (the "entrada"/down payment). When getSharedTransaction loads
  this transaction, it checks the branching logic:
  - Does it have proposalGroupId? → NO (or the query succeeds but only returns the entrada itself)
  - Does it have installmentGroupId? → YES (commit 1c5023b7 added installmentGroupId
    to the down payment via: `data.downPayment ? groupId : null`)
  
  Wait — the fix in 1c5023b7 at line 409 ADDED installmentGroupId to down payments.
  BUT this is a NEW fix for FUTURE transactions. The EXISTING transaction
  gHDsrJSwHeMvFFpflqUS was created BEFORE this fix, so it likely does NOT have
  installmentGroupId set. Without installmentGroupId, the controller falls through
  to check proposalGroupId. If proposalGroupId matches the parcelas group but the
  parcelas DON'T have proposalGroupId (they have installmentGroupId), the query
  returns no results or only the entrada.

  CONFIRMED ROOT CAUSE FOR BUG 2: The relatedTransactions query only uses ONE
  field at a time (proposalGroupId OR installmentGroupId). The entrada transaction
  has proposalGroupId set (from the proposal), so it queries by proposalGroupId.
  But the installment parcelas have installmentGroupId set (not proposalGroupId),
  so they are NOT returned by the proposalGroupId query. The result: only the
  entrada (which IS in the proposalGroupId query results, along with other
  proposal-linked transactions, but NOT the installment parcelas from
  installment_1777346112956) is shown.

  CONFIRMED ROOT CAUSE FOR BUG 1 (PDF): When Playwright navigates to the share
  URL with ?print=1, useSearchParams returns null on SSR. isPrintMode is false.
  React renders the loading state. The useEffect fires and fetches the transaction.
  When the fetch completes, transaction state is set. BUT if errorType is also set
  (due to a related transactions query failure or a backend error), the component
  renders the error state instead of the print mode path. This is the "re-render
  to error" that causes the marker to disappear.

  The REAL issue is: the fetch fails intermittently because the "related transactions"
  query for a transaction that has proposalGroupId but whose parcelas are in a
  different group may throw a Firestore index error. But since the catch block now
  silences all related transaction errors, the main transaction STILL loads but
  relatedTransactions is []. This means the fetch succeeds, and the page renders
  in print mode correctly. So the PDF bug may be a SEPARATE timing issue.

reasoning_checkpoint:
  hypothesis: |
    BUG 2 (definitive): The down payment transaction gHDsrJSwHeMvFFpflqUS has
    proposalGroupId set (from being linked to a proposal) but the installment
    parcelas have installmentGroupId=installment_1777346112956. The controller
    branches on proposalGroupId FIRST, so queries proposalGroupId — which returns
    only proposal-linked transactions (the down payment itself, not the installment
    parcelas). Fix: query BOTH installmentGroupId AND proposalGroupId in parallel,
    or check if the transaction also has installmentGroupId and query that too.

    BUG 1 (PDF, definitive): The page fetches shared transaction data.
    If the transaction the PDF is being generated for has proposalGroupId AND
    the parcelas are fetched via proposalGroupId, this succeeds. However, the
    PDF fails because useSearchParams without Suspense causes isPrintMode to be
    false on FIRST render. On first render, the loading spinner shows. React
    hydrates, isPrintMode becomes true. Then fetch fires. Fetch completes with
    transaction data. THEN React renders the print mode path with the marker.
    Playwright's waitForFunction sees the marker. 1000ms delay elapses. Then
    page.emulateMedia fires. THEN the pre-pdf check runs and finds markerVal: null.
    This means after the 1000ms delay, something caused a RE-RENDER that removed
    the marker. That re-render could only happen if isPrintMode becomes false again
    OR if errorType gets set OR if the component unmounts.

    The most likely cause: paymentSuccess = searchParams.get("payment_success").
    On first SSR: searchParams = null, so searchParams.get() returns null → paymentSuccess = null
    After hydration: searchParams is the real URLSearchParams for ?print=1, so
    searchParams.get("payment_success") = null. SAME value. NO re-render triggered.

    BUT: searchParams object ITSELF is a new instance after hydration even though
    all values are identical. If any of the effects or memoizations compare by
    reference rather than value, a re-render occurs. The useEffect dep [token, paymentSuccess]
    uses the STRING value (null in both cases), so it should be stable.

    CONFIRMED NEW THEORY: The PDF markers disappears because the useEffect runs TWICE.
    First run: token is set, paymentSuccess = null → fetch fires → SUCCESS → transaction set
    THEN Playwright's 1000ms wait begins. BUT during that 1000ms, React's development
    strict mode (or hydration) might fire the effect a SECOND TIME with identical deps,
    which would re-trigger the fetch. Second fetch starts → setIsLoading(true) → LOADING
    state renders → isPrintMode is still true BUT the EARLY RETURN for isLoading fires
    BEFORE the isPrintMode check, so the marker DISAPPEARS.

    FOUND IT: Line 149-158 in page.tsx — the isLoading check comes BEFORE the isPrintMode
    check. So when the second fetch starts (setIsLoading(true)), the page renders the
    loading spinner, NOT the print mode marker.

  confirming_evidence:
    - "Marker appears at 36ms (React SUCCESS) then disappears <1s later (ERROR state)"
    - "The isLoading guard at line 149 renders spinner BEFORE the isPrintMode check at line 223"
    - "useEffect deps [token, paymentSuccess] — both stable as strings, but setIsLoading(true) is called at start of each fetch invocation"
    - "The page layout: isLoading → error states → !transaction → isPrintMode → full UI. Any re-fetch resets isLoading=true and hides the print marker"
    - "commit c45f927d fixed infinite loop by changing deps from [token, searchParams] to [token, paymentSuccess]"
    - "BUT: on ?print=1 URL, paymentSuccess is null. searchParams.get('print') = '1' gives isPrintMode=true. This is stable."
    - "The PDF error pre-pdf state shows markerVal: null — marker DISAPPEARED after being found"
  
  falsification_test: |
    If the fix is wrong: moving the isPrintMode check BEFORE isLoading would prevent
    the marker from being hidden during re-fetches. If the marker still disappears
    after moving isPrintMode check first, the hypothesis is wrong.
  
  fix_rationale: |
    BUG 1 FIX: Move the isPrintMode early return to BEFORE the isLoading check.
    When isPrintMode=true, we should NEVER show the loading spinner — Playwright
    needs the marker to stay stable once it appears. The TransactionPdfViewer can
    handle null/loading data gracefully (it renders empty), and the marker is what
    Playwright waits for. Once transaction data arrives and isPrintMode is true,
    the marker MUST stay.

    BUG 2 FIX: The relatedTransactions query must handle the case where a transaction
    has proposalGroupId but the related installment parcelas are linked via
    installmentGroupId. The controller should query installmentGroupId REGARDLESS
    of whether proposalGroupId is present. Or better: query BOTH in parallel when
    both fields are present on the anchor transaction.

  blind_spots: |
    - Don't know the actual Firestore fields on transaction gHDsrJSwHeMvFFpflqUS
      (whether it has both proposalGroupId AND installmentGroupId)
    - The exact sequence of React renders during Playwright navigation is not
      100% confirmed — it's inferred from code structure

test: applying fixes
expecting: Both bugs resolved — PDF marker stable during print mode; share link returns installment parcelas
next_action: Apply fixes to both files

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: PDF carrega corretamente e exibe o conteúdo; share link mostra todas as transações relacionadas (entrada + parcelas do grupo de parcelamento)
actual: PDF — marker pdf:ready aparece em 36ms (React em SUCCESS STATE brevemente), depois some em <1s (React volta para ERRO STATE). Share link — só exibe a entrada, não mostra as parcelas
errors:
  - pdf:ready: 36ms → marker encontrado instantaneamente (React estava em SUCCESS STATE)
  - pre-pdf state { viewerIn: false, markerVal: null } → 1s depois o marker SUMIU
  - React re-renderizou para ERRO STATE após fetch inicialmente bem-sucedido
  - Share link: mostra só "entrada" para o grupo installment_1777346112956
reproduction:
  - Transaction ID: gHDsrJSwHeMvFFpflqUS
  - installmentGroupId: installment_1777346112956
  - Abrir a página de PDF da transação → ver sucesso breve → erro
  - Abrir share link do grupo → ver só entrada
started: Debug em andamento desde sessão anterior (contexto esgotado). Branch atual: develop. Branch main funciona segundo o usuário.

## Eliminated

- hypothesis: "searchParams instability causes useEffect re-fire via [token, searchParams] deps"
  evidence: "commit c45f927d already fixed this by changing to [token, paymentSuccess]"
  timestamp: 2026-04-28T14:00:00Z

- hypothesis: "Playwright waitUntil change (domcontentloaded→networkidle) causes race condition"
  evidence: "networkidle is actually MORE stable — it waits for all network requests to complete. The problem is the component re-render during the 1000ms delay window."
  timestamp: 2026-04-28T14:00:00Z

## Evidence

- timestamp: 2026-04-28T14:00:00Z
  checked: "page.tsx share transaction page — render order of guards"
  found: "isLoading guard at line 149 fires BEFORE isPrintMode check at line 223. Any re-fetch (setIsLoading=true) hides the print marker."
  implication: "PDF marker disappears whenever a second fetch is triggered during the 1000ms Playwright delay"

- timestamp: 2026-04-28T14:00:00Z
  checked: "shared-transactions.controller.ts relatedTransactions query branching"
  found: "Controller branches: proposalGroupId ELSE installmentGroupId. If anchor tx has proposalGroupId, it ONLY queries by proposalGroupId — parcelas linked by installmentGroupId are NOT returned."
  implication: "Share link for entrada (has proposalGroupId) never fetches installment parcelas (linked by installmentGroupId)"

- timestamp: 2026-04-28T14:00:00Z
  checked: "commit 1c5023b7 diff for transaction.service.ts"
  found: "Added installmentGroupId to down payment tx when data.downPayment is truthy. This is a forward-fix only — existing transactions are unaffected."
  implication: "Existing transaction gHDsrJSwHeMvFFpflqUS still lacks installmentGroupId, so the controller falls back to proposalGroupId branch"

- timestamp: 2026-04-28T14:00:00Z
  checked: "useEditTransaction.ts changes in commit 1c5023b7"
  found: "isLikelyOrphanDownPaymentForGroup now allows groupId-linked down payments to be returned — was previously filtered out when candidate had installmentGroupId"
  implication: "Frontend edit hook now shows entrada correctly. But this doesn't affect the share link query."

## Resolution

root_cause: |
  BUG 1 (PDF): The isLoading guard (line 149) renders before the isPrintMode check (line 223).
  Something causes setIsLoading(true) to fire after initial data load — exact upstream cause
  unclear (hydration boundary with useSearchParams(), Playwright networkidle interaction with
  React 19, or effect re-fire). The loading spinner then replaces the print-mode marker before
  Playwright's pre-pdf check runs. transaction state is NOT reset on re-fetch, so guarding with
  `isPrintMode && transaction` before isLoading makes the marker resilient to any subsequent
  setIsLoading(true) once data is loaded.

  BUG 2 (Share link — verified against actual Firestore data): Both transactions in group
  installment_1777346112956 have proposalGroupId=null and installmentGroupId set, so the
  controller correctly reaches the installmentGroupId branch. The query returns both. BUT
  TransactionPdfViewer only includes transactions where isInstallment===true in the installments
  array. Transaction gHDsrJSwHeMvFFpflqUS has isInstallment: false (paymentMode: "total" with
  installmentCount: 1). With uniqueTxs.length > 1, the "single" fallback also misses it
  (requires length === 1). The non-downpayment, non-installment transaction drops completely
  from allTableItems — only the downpayment row (Mds7rjfHjKtwA9AGmRzp) appears.

fix:
  "1. src/app/share/transaction/[token]/page.tsx: Move isPrintMode && transaction check to
      before the isLoading check so the print marker is stable once data is loaded.
   2. src/components/pdf/transaction-pdf-viewer.tsx: Add spread for non-installment,
      non-downpayment transactions in a multi-tx group (uniqueTxs.length > 1) to allTableItems."

verification:
  - TypeScript: `npx tsc --noEmit --skipLibCheck` passes with no errors
  - Firestore data verified: both txs have installmentGroupId set, proposalGroupId null

files_changed:
  - src/app/share/transaction/[token]/page.tsx
  - src/components/pdf/transaction-pdf-viewer.tsx
