export type Tenant = {
    id: string
    name: string
    slug: string
    primaryColor: string // Hex code
    createdAt: string
}

export type Product = {
    id: string
    tenantId: string
    name: string
    description: string
    price: string
    manufacturer: string
    category: string
    sku: string
    stock: string
    image?: string | null
}

const KEYS = {
    TENANTS: 'saas_tenants',
    PRODUCTS: 'saas_products',
    CURRENT_TENANT: 'saas_current_tenant_id'
}

export const MockDB = {
    // --- Tenant Operations ---
    getTenants: (): Tenant[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.TENANTS)
        return data ? JSON.parse(data) : []
    },

    createTenant: (networkName: string, color: string): Tenant => {
        const tenants = MockDB.getTenants()
        const newTenant: Tenant = {
            id: crypto.randomUUID(),
            name: networkName,
            slug: networkName.toLowerCase().replace(/\s+/g, '-'),
            primaryColor: color,
            createdAt: new Date().toISOString()
        }
        localStorage.setItem(KEYS.TENANTS, JSON.stringify([...tenants, newTenant]))
        return newTenant
    },

    getTenantById: (id: string): Tenant | undefined => {
        return MockDB.getTenants().find(t => t.id === id)
    },

    // --- Session Operations ---
    setCurrentTenantId: (id: string) => {
        localStorage.setItem(KEYS.CURRENT_TENANT, id)
    },

    getCurrentTenantId: (): string | null => {
        if (typeof window === 'undefined') return null
        return localStorage.getItem(KEYS.CURRENT_TENANT)
    },

    clearSession: () => {
        localStorage.removeItem(KEYS.CURRENT_TENANT)
    },

    // --- Product Operations (Scoped) ---
    getProducts: (tenantId: string): Product[] => {
        if (typeof window === 'undefined') return []
        const data = localStorage.getItem(KEYS.PRODUCTS)
        const allProducts: Product[] = data ? JSON.parse(data) : []
        return allProducts.filter(p => p.tenantId === tenantId)
    },

    createProduct: (tenantId: string, data: Omit<Product, 'id' | 'tenantId'>) => {
        const allProductsStr = localStorage.getItem(KEYS.PRODUCTS)
        const allProducts: Product[] = allProductsStr ? JSON.parse(allProductsStr) : []

        const newProduct: Product = {
            ...data,
            id: crypto.randomUUID(),
            tenantId
        }

        localStorage.setItem(KEYS.PRODUCTS, JSON.stringify([...allProducts, newProduct]))
        return newProduct
    }
}
