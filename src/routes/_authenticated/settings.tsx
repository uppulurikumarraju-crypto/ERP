import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Smart Kirana" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [shopName, setShopName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [upiId, setUpiId] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setShopName(profile.shop_name ?? "");
      setMerchantName((profile as { merchant_name?: string | null }).merchant_name ?? profile.shop_name ?? "");
      setUpiId((profile as { upi_id?: string | null }).upi_id ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = { id: u.user.id, shop_name: shopName, merchant_name: merchantName, upi_id: upiId };
      const { error } = await supabase.from("profiles").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upiUri = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName || shopName || "Merchant")}&cu=INR`
    : "";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Shop details and merchant UPI for checkout.</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Merchant details</CardTitle>
          <CardDescription>Your UPI ID is used to generate the QR shown to customers at checkout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Shop name</Label>
              <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Sri Krishna Kirana" />
            </div>
            <div className="space-y-1.5">
              <Label>Merchant name (shown on QR)</Label>
              <Input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Shopkeeper name" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>UPI ID</Label>
              <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@okhdfcbank" autoComplete="off" />
              <p className="text-xs text-muted-foreground">Example: 9876543210@ybl · shopname@paytm · name@okicici</p>
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </CardContent>
      </Card>

      {upiUri && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>QR preview</CardTitle>
            <CardDescription>Customers scan this with any UPI app (GPay, PhonePe, Paytm).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="p-4 bg-white rounded-xl border">
              <QRCodeCanvas value={upiUri} size={200} />
            </div>
            <div className="text-sm text-muted-foreground">{upiId}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
