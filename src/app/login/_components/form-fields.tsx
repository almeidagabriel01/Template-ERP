"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { TenantNiche, NICHE_LABELS } from "@/types";

interface RegisterFormFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  companyName: string;
  onCompanyNameChange: (value: string) => void;
  companyNiche: TenantNiche;
  onCompanyNicheChange: (value: TenantNiche) => void;
  companyColor: string;
  onCompanyColorChange: (value: string) => void;
  companyLogo: string;
  onCompanyLogoChange: (value: string) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function RegisterFormFields({
  name,
  onNameChange,
  companyName,
  onCompanyNameChange,
  companyNiche,
  onCompanyNicheChange,
  companyColor,
  onCompanyColorChange,
  companyLogo,
  onCompanyLogoChange,
  onLogoUpload,
}: RegisterFormFieldsProps) {
  return (
    <>
      {/* User Info Section */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-300 border-b border-neutral-700 pb-2">
          Dados Pessoais
        </p>
        <div className="grid gap-2">
          <Label htmlFor="name" className="text-neutral-300">
            Seu Nome
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Seu nome completo"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            className="bg-neutral-800 border-neutral-700 text-white"
          />
        </div>
      </div>

      {/* Company Info Section */}
      <div className="space-y-3 pt-2">
        <p className="text-sm font-medium text-neutral-300 border-b border-neutral-700 pb-2">
          Dados da Empresa
        </p>

        <div className="grid gap-2">
          <Label htmlFor="companyName" className="text-neutral-300">
            Nome da Empresa
          </Label>
          <Input
            id="companyName"
            type="text"
            placeholder="Minha Empresa"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            required
            className="bg-neutral-800 border-neutral-700 text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="niche" className="text-neutral-300">
              Nicho
            </Label>
            <Select
              id="niche"
              value={companyNiche}
              onChange={(e) =>
                onCompanyNicheChange(e.target.value as TenantNiche)
              }
              className="bg-neutral-800 border-neutral-700 text-white"
            >
              {(Object.keys(NICHE_LABELS) as TenantNiche[]).map((key) => (
                <option key={key} value={key}>
                  {NICHE_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="color" className="text-neutral-300">
              Cor da Marca
            </Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={companyColor}
                onChange={(e) => onCompanyColorChange(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer bg-neutral-800 border-neutral-700"
              />
              <Input
                value={companyColor}
                onChange={(e) => onCompanyColorChange(e.target.value)}
                className="font-mono bg-neutral-800 border-neutral-700 text-white flex-1"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="logo" className="text-neutral-300">
            Logo da Empresa
          </Label>
          <div className="flex items-center gap-3">
            {companyLogo ? (
              <div className="relative w-14 h-14 rounded-lg border border-neutral-700 overflow-hidden bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={companyLogo}
                  alt="Logo preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => onCompanyLogoChange("")}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-400"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg border-2 border-dashed border-neutral-700 flex items-center justify-center bg-neutral-800/50">
                <Upload className="w-5 h-5 text-neutral-500" />
              </div>
            )}
            <div className="flex-1">
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={onLogoUpload}
                className="cursor-pointer bg-neutral-800 border-neutral-700 text-white"
              />
              <p className="text-xs text-neutral-500 mt-1">
                PNG, JPG ou SVG. Máx 300KB.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-700 pt-3"></div>
    </>
  );
}

interface CredentialFieldsProps {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  mode: "login" | "register";
  error?: string;
}

export function CredentialFields({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  mode,
  error,
}: CredentialFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="email" className="text-neutral-300">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          className="bg-neutral-800 border-neutral-700 text-white"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password" className="text-neutral-300">
          Senha
        </Label>
        <Input
          id="password"
          type="password"
          placeholder={
            mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"
          }
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          className="bg-neutral-800 border-neutral-700 text-white"
        />
      </div>
      {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
    </>
  );
}
