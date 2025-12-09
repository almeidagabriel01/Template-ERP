"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTenant } from "@/providers/tenant-provider" // Import added
import {
    LayoutDashboard,
    Package,
    Users,
    Settings,
    LogOut,
    Box,
    ShieldAlert
} from "lucide-react"

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Package, label: "Produtos", href: "/products/new" },
    { icon: Users, label: "Clientes", href: "/customers" },
    { icon: Box, label: "Estoque", href: "/inventory" },
    { icon: Settings, label: "Configurações", href: "/settings" },
]

export function Sidebar() {
    const pathname = usePathname()
    const { tenant, logout } = useTenant() // Hook usage

    // If no tenant is selected (e.g. on Admin page or logged out state), verify path
    if (pathname.startsWith('/admin')) {
        return null // Don't show app sidebar on super admin page
    }

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50 transition-colors duration-500">
            <div className="p-6 flex items-center gap-2 border-b border-border h-16">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-colors duration-500">
                    <span className="text-primary-foreground font-bold text-lg">
                        {tenant ? tenant.name.charAt(0).toUpperCase() : 'E'}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-tight line-clamp-1">
                        {tenant ? tenant.name : 'ERP PRO'}
                    </span>
                    {tenant && <span className="text-[10px] text-muted-foreground uppercase">Enterprise</span>}
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-border space-y-2">
                {/* Super Admin Back Link */}
                <Link href="/admin">
                    <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mb-2">
                        <ShieldAlert className="w-4 h-4" />
                        Voltar p/ Admin
                    </button>
                </Link>

                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sair
                </button>
            </div>
        </aside>
    )
}
