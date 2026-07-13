import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function UpiQrDialog({
  open, onOpenChange, upiId, merchantName, amount, note,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  upiId: string | null | undefined;
  merchantName: string;
  amount: number;
  note?: string;
}) {
  const hasUpi = !!upiId;
  const uri = hasUpi
    ? `upi://pay?pa=${encodeURIComponent(upiId!)}&pn=${encodeURIComponent(merchantName || "Merchant")}&am=${amount.toFixed(2)}&cu=INR${note ? `&tn=${encodeURIComponent(note)}` : ""}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan to pay ₹{amount.toFixed(2)}</DialogTitle>
          <DialogDescription>
            {hasUpi ? "Customer scans with GPay, PhonePe, Paytm or any UPI app." : "Add your UPI ID in Settings to show a payment QR."}
          </DialogDescription>
        </DialogHeader>

        {hasUpi ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="p-4 bg-white rounded-xl border">
              <QRCodeCanvas value={uri} size={220} />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium">{merchantName || "Merchant"}</div>
              <div className="text-xs text-muted-foreground">{upiId}</div>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="py-4">
            <Button asChild className="w-full">
              <Link to="/settings">Go to Settings</Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
