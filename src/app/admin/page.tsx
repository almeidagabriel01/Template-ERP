"use client"

import * as React from "react"
import { MockDB, Tenant } from "@/lib/mock-db"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useTenant } from "@/providers/tenant-provider"
import { Plus, LogIn, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AdminPage() {
    const [tenants, setTenants] = React.useState<Tenant[]>([])
    const [name, setName] = React.useState("")
    const [color, setColor] = React.useState("#3b82f6") // Default blue
    const { refreshTenant } = useTenant()
    const router = useRouter()

    React.useEffect(() => {
        setTenants(MockDB.getTenants())
    }, [])

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return

        const newTenant = MockDB.createTenant(name, color)
        setTenants([...tenants, newTenant])
        setName("")
        alert(`Empresa ${newTenant.name} criada com sucesso!`)
    }

    const handleLoginAs = (tenant: Tenant) => {
        MockDB.setCurrentTenantId(tenant.id)
        refreshTenant()
        router.push('/')
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Painel Super Admin</h1>
                    <p className="text-muted-foreground">Gerencie as empresas (Tenants) do seu sistema SaaS.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Create Tenant Form */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Nova Empresa</CardTitle>
                        <CardDescription>Crie um novo ambiente isolado.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleCreate}>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nome da Empresa</Label>
                                <Input
                                    id="name"
                                    placeholder="Ex: Acme Corp"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="color">Cor da Marca</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="color"
                                        type="color"
                                        className="w-12 h-10 p-1 cursor-pointer"
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                    />
                                    <Input
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        className="font-mono uppercase"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full">
                                <Plus className="w-4 h-4 mr-2" /> Criar Tenant
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* Tenant List */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {tenants.map(tenant => (
                        <Card key={tenant.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: tenant.primaryColor }}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center justify-between">
                                    {tenant.name}
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tenant.primaryColor }} />
                                </CardTitle>
                                <CardDescription className="text-xs font-mono">ID: {tenant.id.slice(0, 8)}...</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="text-sm text-muted-foreground">
                                    Criado em: {new Date(tenant.createdAt).toLocaleDateString()}
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/30 pt-4">
                                <Button className="w-full cursor-pointer" onClick={() => handleLoginAs(tenant)}>
                                    <LogIn className="w-4 h-4 mr-2" /> Acessar Painel
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}

                    {tenants.length === 0 && (
                        <div className="col-span-full py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            Nenhuma empresa criada ainda.
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
