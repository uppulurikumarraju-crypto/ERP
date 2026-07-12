import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — Smart Kirana" }] }),
  component: ProductsPage,
});

type ProductForm = {
  name: string;
  barcode: string;
  category_id: string | null;
  brand: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  gst_percent: number;
  current_stock: number;
  minimum_stock: number;
};

const emptyForm: ProductForm = {
  name: "",
  barcode: "",
  category_id: null,
  brand: "",
  unit: "piece",
  purchase_price: 0,
  selling_price: 0,
  gst_percent: 0,
  current_stock: 0,
  minimum_stock: 5,
};

function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name").order("name")).data ?? [],
  });

  const products = useQuery({
    queryKey: ["products", search, categoryFilter],
    queryFn: async () => {
      let q = supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      if (search) q = q.ilike("name", `%${search}%`);
      if (categoryFilter !== "all") q = q.eq("category_id", categoryFilter);
      return (await q).data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: ProductForm) => {
      const payload = { ...f, barcode: f.barcode || null, category_id: f.category_id || null };
      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Product updated" : "Product added");
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(p: Record<string, unknown>) {
    setEditingId(p.id as string);
    setForm({
      name: (p.name as string) ?? "",
      barcode: (p.barcode as string) ?? "",
      category_id: (p.category_id as string | null) ?? null,
      brand: (p.brand as string) ?? "",
      unit: (p.unit as string) ?? "piece",
      purchase_price: Number(p.purchase_price ?? 0),
      selling_price: Number(p.selling_price ?? 0),
      gst_percent: Number(p.gst_percent ?? 0),
      current_stock: Number(p.current_stock ?? 0),
      minimum_stock: Number(p.minimum_stock ?? 5),
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog and stock.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Add product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit product" : "New product"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Barcode</Label>
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category_id ?? "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["piece", "kg", "g", "litre", "ml", "packet", "bottle", "dozen"].map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Purchase price (₹)</Label>
                <Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Selling price (₹)</Label>
                <Input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Input type="number" step="0.01" value={form.gst_percent} onChange={(e) => setForm({ ...form, gst_percent: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Current stock</Label>
                <Input type="number" step="0.01" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Minimum stock</Label>
                <Input type="number" step="0.01" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: +e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.name}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {(products.data ?? []).map((p) => {
          const stock = Number(p.current_stock);
          const min = Number(p.minimum_stock);
          const status = stock <= 0 ? "out" : stock <= min ? "low" : "ok";
          return (
            <Card key={p.id} className="shadow-card group overflow-hidden">
              <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-accent/40 flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-10 w-10 text-muted-foreground/50" />
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.brand || "—"} · {(p as { categories?: { name?: string } }).categories?.name ?? "Uncategorized"}
                    </div>
                  </div>
                  {status === "out" && <Badge variant="destructive">Out</Badge>}
                  {status === "low" && <Badge className="bg-warning text-warning-foreground hover:bg-warning">Low</Badge>}
                  {status === "ok" && <Badge variant="secondary">In stock</Badge>}
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-lg font-semibold">₹{Number(p.selling_price).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{stock} {p.unit}</div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!products.isLoading && (products.data ?? []).length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No products yet. Add your first product to get started.</p>
        </Card>
      )}
    </div>
  );
}
