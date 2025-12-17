
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fontOptions } from "./pdf-theme-utils";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";

interface PdfStyleTabProps {
    primaryColor: string;
    setPrimaryColor: (val: string) => void;
    fontFamily: string;
    setFontFamily: (val: string) => void;
    repeatHeader: boolean;
    setRepeatHeader: (val: boolean) => void;
    setSections: React.Dispatch<React.SetStateAction<PdfSection[]>>;
}

export function PdfStyleTab({
    primaryColor,
    setPrimaryColor,
    fontFamily,
    setFontFamily,
    repeatHeader,
    setRepeatHeader,
    setSections,
}: PdfStyleTabProps) {

    const handleColorChange = (newColor: string) => {
        setPrimaryColor(newColor);
        setSections((prev) =>
            prev.map((s) => ({
                ...s,
                styles: {
                    ...s.styles,
                    color: undefined, // Reset to inherit new global color
                },
            }))
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cores e Fontes Globais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label>Cor Principal</Label>
                    <div className="flex gap-2">
                        <Input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                            value={primaryColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label>Fonte Principal</Label>
                    <Select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                    >
                        {fontOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="repeat-header-style"
                        checked={repeatHeader}
                        onCheckedChange={setRepeatHeader}
                    />
                    <Label htmlFor="repeat-header-style">
                        Repetir cabeçalho em todas as páginas
                    </Label>
                </div>
                <div
                    className="p-4 rounded-lg bg-muted"
                    style={{ fontFamily }}
                >
                    <div
                        className="text-lg font-bold mb-2"
                        style={{ color: primaryColor }}
                    >
                        Prévia do Estilo
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Este é um exemplo de como o texto aparecerá.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
