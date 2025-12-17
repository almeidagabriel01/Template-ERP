"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Users, FileText, Package } from "lucide-react";

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ações Rápidas</CardTitle>
        <CardDescription>Atalhos para tarefas comuns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/proposals/new">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col gap-2"
            >
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-sm">Nova Proposta</span>
            </Button>
          </Link>
          <Link href="/financial/new">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col gap-2"
            >
              <Wallet className="w-5 h-5 text-primary" />
              <span className="text-sm">Novo Lançamento</span>
            </Button>
          </Link>
          <Link href="/customers/new">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col gap-2"
            >
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm">Novo Cliente</span>
            </Button>
          </Link>
          <Link href="/products/new">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col gap-2"
            >
              <Package className="w-5 h-5 text-primary" />
              <span className="text-sm">Novo Produto</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface ProposalStatsCardProps {
  stats: {
    approved: number;
    pending: number;
    total: number;
    conversionRate: number;
  };
}

export function ProposalStatsCard({ stats }: ProposalStatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Propostas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="font-bold">{stats.total}</span>
        </div>
        <div className="flex gap-2">
          <Badge variant="success" className="flex-1 justify-center">
            {stats.approved} Aprovadas
          </Badge>
          <Badge variant="warning" className="flex-1 justify-center">
            {stats.pending} Pendentes
          </Badge>
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-muted-foreground text-sm">
            Taxa de conversão
          </span>
          <span className="font-bold text-primary">
            {stats.conversionRate}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface ClientsStatsCardProps {
  totalClients: number;
  newClientsThisMonth: number;
}

export function ClientsStatsCard({
  totalClients,
  newClientsThisMonth,
}: ClientsStatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          Clientes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="font-bold">{totalClients}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Novos este mês</span>
          <Badge variant="outline">{newClientsThisMonth}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
