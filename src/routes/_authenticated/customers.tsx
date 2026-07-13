import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — Smart Kirana" }] }),
  component: CustomersPage,
});

type CustomerForm = {
  name: string; mobile: string; email: string; address: string;
  customer_type: string; credit_limit: number;
};
const empty: CustomerForm = { name: "", mobile: "", email: "", address: "", customer_type: "retail", credit_limit: 0 };

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (search) q = q.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`);
      return (await q).data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: CustomerForm) => {
      if (editingId) {
        const { error } = await supabase.from("customers").update(f).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(f);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Customer updated" : "Customer added");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false); setForm(empty); setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function sendWhatsAppReminder(c: { name: string; mobile: string | null; pending_amount: number | string }) {
    if (!c.mobile) { toast.error("No mobile number on file"); return; }
    // Normalize to digits; assume India (+91) if 10 digits without country code
    const digits = c.mobile.replace(/\D/g, "");
    const phone = digits.length === 10 ? "91" + digits : digits;
    const amount = Number(c.pending_amount).toFixed(2);
    const msg = `Namaste ${c.name}, this is a friendly reminder from our store. Your pending balance is ₹${amount}. Kindly clear it at your convenience. Thank you!`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Track buyers, credit and purchase history.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm(empty); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit customer" : "New customer"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.customer_type} onValueChange={(v) => setForm({ ...form, customer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Credit limit (₹)</Label>
                <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: +e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.name}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or mobile…" className="pl-9" />
      </div>

      <Card className="shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Credit limit</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.mobile || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">{c.customer_type}</Badge>
                </TableCell>
                <TableCell>₹{Number(c.credit_limit).toFixed(2)}</TableCell>
                <TableCell>
                  {Number(c.pending_amount) > 0 ? (
                    <span className="text-warning-foreground font-medium">₹{Number(c.pending_amount).toFixed(2)}</span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {Number(c.pending_amount) > 0 && c.mobile && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => sendWhatsAppReminder(c)}
                      title="Send WhatsApp reminder"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Remind
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => {
                    setEditingId(c.id);
                    setForm({
                      name: c.name, mobile: c.mobile ?? "", email: c.email ?? "",
                      address: c.address ?? "", customer_type: c.customer_type,
                      credit_limit: Number(c.credit_limit),
                    });
                    setOpen(true);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && data.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No customers yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
