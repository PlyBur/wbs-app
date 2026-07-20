import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Package } from "lucide-react"
import { formatZAR } from "@/lib/utils"
import Link from "next/link"

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: products } = await supabase.from("products").select("*").order("name")

  return (
    <DashboardLayout
      title="Products"
      user={{ email: user?.email, name: user?.user_metadata?.full_name }}
      actions={
        <Link href="/products/new" className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          + New product
        </Link>
      }
    >
      {!products || products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add products to use in quotes and invoices." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map(p => (
            <Link key={p.id} href={`/products/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                    </div>
                    <Badge variant={p.is_active ? "success" : "muted"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-bold">{formatZAR(p.unit_price)}</span>
                    <span className="text-xs text-muted-foreground">{p.unit ?? "unit"}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
