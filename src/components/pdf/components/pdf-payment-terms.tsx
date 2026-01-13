import { formatCurrency } from "@/utils/format-utils";

interface PdfPaymentTermsProps {
  contentStyles: Record<string, React.CSSProperties>;
  downPaymentEnabled?: boolean;
  downPaymentValue?: number;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
}

export function PdfPaymentTerms({
  contentStyles,
  downPaymentEnabled,
  downPaymentValue,
  installmentsEnabled,
  installmentsCount,
  installmentValue,
}: PdfPaymentTermsProps) {
  return (
    <div className="mt-20 mb-4 text-left space-y-2">
      <div
        className="text-lg font-bold mb-2"
        style={{ color: (contentStyles.headerTitle as any)?.color }}
      >
        Condições de Pagamento:
      </div>
      <div className="space-y-1 pl-4 border-l-2 border-gray-100">
        {downPaymentEnabled && downPaymentValue && downPaymentValue > 0 && (
          <div className="flex items-center gap-8 text-sm">
            <span className="text-gray-600 min-w-[100px]">• Entrada:</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(downPaymentValue)}
            </span>
          </div>
        )}
        {installmentsEnabled && installmentsCount && installmentsCount >= 1 && (
          <div className="flex items-center gap-8 text-sm">
            <span className="text-gray-600 min-w-[100px]">• Parcelamento:</span>
            <span className="font-medium text-gray-900">
              {installmentsCount}x de {formatCurrency(installmentValue || 0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
