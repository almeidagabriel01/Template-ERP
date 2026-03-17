"use client";

import * as React from "react";
import { Eye, FileStack, ImageIcon, Receipt, ShieldCheck } from "lucide-react";
import { Proposal } from "@/types/proposal";
import {
  PdfDisplaySettings,
  defaultPdfSettings,
} from "@/components/features/proposal/form/pdf-display-options-section";
import {
  MobileMetric,
  MobilePanel,
  MobileToggleCard,
} from "./shared";

interface ProposalMobilePdfStepProps {
  formData: Partial<Proposal>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
}

const pdfOptionGroups: Array<{
  title: string;
  description: string;
  icon: typeof ImageIcon;
  options: Array<{ key: keyof PdfDisplaySettings; label: string; description: string }>;
}> = [
  {
    title: "Apresentacao dos itens",
    description: "Controla como produtos e servicos aparecem no corpo do PDF.",
    icon: ImageIcon,
    options: [
      {
        key: "showProductImages",
        label: "Mostrar imagens",
        description: "Mantem referencias visuais dos itens no documento.",
      },
      {
        key: "showProductDescriptions",
        label: "Mostrar descricoes",
        description: "Exibe contexto comercial sem depender de anexo separado.",
      },
      {
        key: "showProductPrices",
        label: "Mostrar precos unitarios",
        description: "Abre valor unitario alem do total consolidado.",
      },
    ],
  },
  {
    title: "Estrutura comercial",
    description: "Define como subtotal e pagamento aparecem para o cliente.",
    icon: Receipt,
    options: [
      {
        key: "showSubtotals",
        label: "Subtotal por solucao",
        description: "Resumo por bloco comercial ou sistema.",
      },
      {
        key: "showEnvironmentSubtotals",
        label: "Subtotal por ambiente",
        description: "Detalha valores por ambiente quando houver automacao.",
      },
      {
        key: "showPaymentTerms",
        label: "Mostrar condicoes de pagamento",
        description: "Inclui entrada, parcelas e saldo final no PDF.",
      },
    ],
  },
  {
    title: "Contexto institucional",
    description: "Regras de apoio para manter o documento completo e confiavel.",
    icon: ShieldCheck,
    options: [
      {
        key: "showLogo",
        label: "Mostrar logo",
        description: "Aplica identidade visual da empresa no documento.",
      },
      {
        key: "showValidUntil",
        label: "Mostrar validade",
        description: "Explicita prazo comercial para aprovacao.",
      },
      {
        key: "showNotes",
        label: "Mostrar observacoes",
        description: "Inclui notas finais e recados comerciais.",
      },
    ],
  },
];

export function ProposalMobilePdfStep({
  formData,
  setFormData,
}: ProposalMobilePdfStepProps) {
  const settings: PdfDisplaySettings = {
    ...defaultPdfSettings,
    ...(formData.pdfSettings as Partial<PdfDisplaySettings>),
  };

  const updateSetting = (key: keyof PdfDisplaySettings, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      pdfSettings: {
        ...defaultPdfSettings,
        ...(prev.pdfSettings as Partial<PdfDisplaySettings>),
        [key]: value,
      },
    }));
  };

  const enabledCount = Object.values(settings).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MobileMetric
          label="Ativos"
          value={`${enabledCount}/9 opcoes`}
          hint="equilibrio entre detalhe e leitura"
          accent="sky"
        />
        <MobileMetric
          label="Perfil"
          value={
            settings.showProductPrices && settings.showProductDescriptions
              ? "Completo"
              : "Enxuto"
          }
          hint="ajuste para o tipo de proposta"
          accent="amber"
        />
      </div>

      <MobilePanel
        eyebrow="Visual do documento"
        title="O que aparece no PDF"
        description="O mobile agora deixa claro o impacto de cada escolha sem empilhar checkboxes genericos."
        icon={Eye}
        tone="accent"
      >
        <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileStack className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            Leitura final do documento
          </div>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {settings.showProductDescriptions
              ? "PDF com contexto comercial completo."
              : "PDF mais direto, sem descricoes extensas."}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {settings.showPaymentTerms
              ? "Consegue explicar o pagamento dentro do proprio arquivo."
              : "Esconde condicoes de pagamento do documento compartilhado."}
          </p>
        </div>
      </MobilePanel>

      {pdfOptionGroups.map((group) => {
        const Icon = group.icon;

        return (
          <MobilePanel
            key={group.title}
            eyebrow="Configuracao granular"
            title={group.title}
            description={group.description}
            icon={Icon}
          >
            <div className="space-y-3">
              {group.options.map((option) => (
                <MobileToggleCard
                  key={option.key}
                  title={option.label}
                  description={option.description}
                  checked={settings[option.key]}
                  onCheckedChange={(checked) => updateSetting(option.key, checked)}
                  icon={Icon}
                />
              ))}
            </div>
          </MobilePanel>
        );
      })}
    </div>
  );
}
