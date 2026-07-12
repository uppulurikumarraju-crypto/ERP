import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IndianRupee,
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  Wallet,
  Boxes,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { format, startOfDay, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Smart Kirana" }] }),
  component: Dashboard,
});

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const last14 = subDays(startOfDay(new Date()), 13).toISOString();

      const [todaySales, monthSales, dailySales, products, customers, topItems] = await Promise.all([
        supabase.from("sales").select("total, profit").gte("created_at", todayStart),
        supabase.from("sales").select("total, profit").gte("created_at", monthStart),
        supabase.from("sales").select("total, profit, created_at").gte("created_at", last14),
        supabase.from("products").select("id, current_stock, minimum_stock, selling_price"),
        supabase.from("customers").select("id, pending_amount"),
        supabase.from("sale_items").select("product_name, quantity, line_total").gte("created_at", last14),
      ]);

      const todayTotal = (todaySales.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const todayProfit = (todaySales.data ?? []).reduce((s, r) => s + Number(r.profit), 0);
      const monthTotal = (monthSales.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const monthProfit = (monthSales.data ?? []).reduce((s, r) => s + Number(r.profit), 0);

      const prods = products.data ?? [];
      const stockValue = prods.reduce((s, p) => s + Number(p.current_stock) * Number(p.selling_price), 0);
      const lowStock = prods.filter((p) => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.minimum_stock)).length;
      const outStock = prods.filter((p) => Number(p.current_stock) <= 0).length;

      const custs = customers.data ?? [];
      const pending = custs.reduce((s, c) => s + Number(c.pending_amount), 0);

      // Daily series
      const days: { date: string; sales: number; profit: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = startOfDay(subDays(new Date(), i));
        days.push({ date: format(d, "MMM d"), sales: 0, profit: 0 });
      }
      (dailySales.data ?? []).forEach((s) => {
        const label = format(new Date(s.created_at), "MMM d");
        const day = days.find((d) => d.date === label);
        if (day) {
          day.sales += Number(s.total);
          day.profit += Number(s.profit);
        }
      });

      const itemMap = new Map<string, number>();
      (topItems.data ?? []).forEach((i) => {
        itemMap.set(i.product_name, (itemMap.get(i.product_name) ?? 0) + Number(i.line_total));
      });
      const top = Array.from(itemMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name, total }));

      return {
        todayTotal,
        todayProfit,
        monthTotal,
        monthProfit,
        stockValue,
        lowStock,
        outStock,
        pending,
        totalProducts: prods.length,
        totalCustomers: custs.length,
        days,
        top,
      };
    },
  });

  const stats = [
    { label: "Today's Sales", value: fmt(data?.todayTotal ?? 0), icon: IndianRupee, tone: "primary" },
    { label: "Today's Profit", value: fmt(data?.todayProfit ?? 0), icon: TrendingUp, tone: "success" },
    { label: "Monthly Sales", value: fmt(data?.monthTotal ?? 0), icon: ShoppingCart, tone: "primary" },
    { label: "Monthly Profit", value: fmt(data?.monthProfit ?? 0), icon: TrendingUp, tone: "success" },
    { label: "Stock Value", value: fmt(data?.stockValue ?? 0), icon: Boxes, tone: "primary" },
    { label: "Pending Payments", value: fmt(data?.pending ?? 0), icon: Wallet, tone: "warning" },
    { label: "Low Stock", value: String(data?.lowStock ?? 0), icon: AlertTriangle, tone: "warning" },
    { label: "Out of Stock", value: String(data?.outStock ?? 0), icon: AlertTriangle, tone: "destructive" },
    { label: "Total Products", value: String(data?.totalProducts ?? 0), icon: Package, tone: "muted" },
    { label: "Total Customers", value: String(data?.totalCustomers ?? 0), icon: Users, tone: "muted" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your shop at a glance {isLoading ? "· loading…" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-lg font-semibold">{s.value}</div>
                </div>
                <div
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-lg " +
                    (s.tone === "success"
                      ? "bg-success/15 text-success"
                      : s.tone === "warning"
                        ? "bg-warning/20 text-warning-foreground"
                        : s.tone === "destructive"
                          ? "bg-destructive/15 text-destructive"
                          : s.tone === "muted"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/15 text-primary")
                  }
                >
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Sales · last 14 days</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.days ?? []}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)" }} />
                <Area type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Top selling products</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.top ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)" }} />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
