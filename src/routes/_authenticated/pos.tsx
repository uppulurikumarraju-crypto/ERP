import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Plus, Minus, Receipt, Package, QrCode, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { UpiQrDialog } from "@/components/upi-qr-dialog";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS Billing — Smart Kirana" }] }),
  component: POSPage,
});

type Product = {
  id: string; name: string; barcode: string | null; image_url: string | null;
  selling_price: number; purchase_price: number;
  current_stock: number; unit: string;
};

type CartLine = { product: Product; qty: number };

function POSPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("walk-in");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [qrOpen, setQrOpen] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{ invoice: string; total: number } | null>(null);

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["pos-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id,name,barcode,image_url,selling_price,purchase_price,current_stock,unit").limit(24);
      if (search) q = q.or(`name.ilike.%${search}%,barcode.eq.${search}`);
      return ((await q).data ?? []) as Product[];
    },
  });

  const customers = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,name").order("name")).data ?? [],
  });

  function addToCart(p: Product) {
    if (Number(p.current_stock) <= 0) return toast.error("Out of stock");
    setCart((c) => {
      const existing = c.find((l) => l.product.id === p.id);
      if (existing) {
        if (existing.qty + 1 > Number(p.current_stock)) { toast.error("Not enough stock"); return c; }
        return c.map((l) => l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...c, { product: p, qty: 1 }];
    });
  }
  function setQty(id: string, qty: number) {
    setCart((c) => c.map((l) => l.product.id === id ? { ...l, qty: Math.max(0, qty) } : l).filter((l) => l.qty > 0));
  }
  function remove(id: string) { setCart((c) => c.filter((l) => l.product.id !== id)); }

  const totals = useMemo(() => {
    let subtotal = 0, profit = 0;
    for (const l of cart) {
      const line = Number(l.product.selling_price) * l.qty;
      subtotal += line;
      profit += (Number(l.product.selling_price) - Number(l.product.purchase_price)) * l.qty;
    }
    const total = Math.max(0, subtotal - discount);
    return { subtotal, profit, total };
  }, [cart, discount]);

  const checkout = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");
      const invoice = "INV-" + Date.now();
      const { data: sale, error: se } = await supabase.from("sales").insert({
        invoice_number: invoice,
        customer_id: customerId === "walk-in" ? null : customerId,
        subtotal: totals.subtotal,
        discount,
        gst_amount: 0,
        total: totals.total,
        profit: totals.profit,
        payment_method: paymentMethod,
        paid_amount: paymentMethod === "credit" ? 0 : totals.total,
      }).select().single();
      if (se) throw se;
      const items = cart.map((l) => ({
        sale_id: sale.id,
        product_id: l.product.id,
        product_name: l.product.name,
        quantity: l.qty,
        unit_price: l.product.selling_price,
        purchase_price: l.product.purchase_price,
        gst_percent: 0,
        line_total: Number(l.product.selling_price) * l.qty,
      }));
      const { error: ie } = await supabase.from("sale_items").insert(items);
      if (ie) throw ie;
      if (paymentMethod === "credit" && customerId !== "walk-in") {
        await supabase.rpc("noop_placeholder").then(() => {}).catch(() => {});
        const { data: cust } = await supabase.from("customers").select("pending_amount").eq("id", customerId).single();
        if (cust) {
          await supabase.from("customers")
            .update({ pending_amount: Number(cust.pending_amount) + totals.total, last_purchase_date: new Date().toISOString() })
            .eq("id", customerId);
        }
      }
      return { invoice, total: totals.total };
    },
    onSuccess: ({ invoice, total }) => {
      toast.success(`Bill ${invoice} · ₹${total.toFixed(2)}`);
      setLastInvoice({ invoice, total });
      if (paymentMethod === "upi") setQrOpen(true);
      setCart([]); setDiscount(0);
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upiId = (profile.data as { upi_id?: string | null } | null)?.upi_id ?? null;
  const merchantName =
    (profile.data as { merchant_name?: string | null } | null)?.merchant_name ??
    (profile.data as { shop_name?: string | null } | null)?.shop_name ??
    "Merchant";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">POS Billing</h1>
          <p className="text-sm text-muted-foreground">Scan barcode or search to add products.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or scan barcode…" className="pl-9" autoFocus />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(products.data ?? []).map((p) => {
            const out = Number(p.current_stock) <= 0;
            return (
              <button key={p.id} disabled={out} onClick={() => addToCart(p)} className="text-left group">
                <Card className={"shadow-card overflow-hidden transition-all group-hover:border-primary/50 group-hover:shadow-elevated " + (out ? "opacity-50" : "")}>
                  <div className="aspect-square bg-gradient-to-br from-secondary to-accent/40 flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <CardContent className="p-2.5">
                    <div className="font-medium text-sm truncate" title={p.name}>{p.name}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="text-base font-semibold">₹{Number(p.selling_price).toFixed(2)}</div>
                      {out ? <Badge variant="destructive" className="text-[10px]">Out</Badge> :
                        <span className="text-[11px] text-muted-foreground">{Number(p.current_stock)} {p.unit}</span>}
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="shadow-elevated h-fit lg:sticky lg:top-20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Current bill
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Customer</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in customer</SelectItem>
                {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg divide-y max-h-[280px] overflow-y-auto">
            {cart.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Cart is empty</div>
            )}
            {cart.map((l) => (
              <div key={l.product.id} className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.product.name}</div>
                  <div className="text-xs text-muted-foreground">₹{Number(l.product.selling_price).toFixed(2)} × {l.qty}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(l.product.id, l.qty - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm">{l.qty}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(l.product.id, l.qty + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(l.product.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground flex-1">Discount</span>
              <Input type="number" value={discount} onChange={(e) => setDiscount(+e.target.value)} className="h-8 w-24 text-right" />
            </div>
            <div className="border-t pt-2 flex justify-between text-base font-semibold">
              <span>Total</span><span>₹{totals.total.toFixed(2)}</span>
            </div>
            {totals.profit > 0 && (
              <div className="flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-700 text-sm">
                <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Profit on this sale</span>
                <span className="font-semibold">₹{totals.profit.toFixed(2)}</span>
              </div>
            )}
          </div>

          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upi">UPI (Scan & Pay)</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="credit">Credit (Udhaar)</SelectItem>
            </SelectContent>
          </Select>

          <div className="grid grid-cols-1 gap-2">
            <Button className="w-full" size="lg" onClick={() => checkout.mutate()} disabled={checkout.isPending || cart.length === 0}>
              {checkout.isPending ? "Processing…" : `Complete sale · ₹${totals.total.toFixed(2)}`}
            </Button>
            {paymentMethod === "upi" && cart.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setQrOpen(true)} disabled={!upiId}>
                <QrCode className="h-4 w-4" /> {upiId ? "Show scanner now" : "Add UPI in Settings"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <UpiQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        upiId={upiId}
        merchantName={merchantName}
        amount={lastInvoice?.total ?? totals.total}
        note={lastInvoice?.invoice}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>₹{value.toFixed(2)}</span>
    </div>
  );
}
