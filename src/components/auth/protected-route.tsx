"use client"

import * as React from "react"
import { useAuth } from "@/providers/auth-provider"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    React.useEffect(() => {
        if (!isLoading && !user) {
            if (pathname !== '/login') {
                router.push('/login')
            }
        } else if (user) {
            // Role Based Protection
            const isAdminRoute = pathname.startsWith('/admin')

            if (user.role === 'superadmin' && !isAdminRoute) {
                router.push('/admin')
            } else if (user.role !== 'superadmin' && isAdminRoute) {
                router.push('/')
            }
        }
    }, [user, isLoading, router, pathname])

    // Loading Screen
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>
                </div>
            </div>
        )
    }

    // If on login page, render without protection
    if (pathname === '/login') {
        return <>{children}</>
    }

    // If no user after loading, show nothing (redirect is happening)
    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    // Authenticated
    return <>{children}</>
}
