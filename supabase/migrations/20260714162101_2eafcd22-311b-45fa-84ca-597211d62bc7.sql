
-- Ensure staff role exists in enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'staff' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'staff';
  END IF;
END $$;

-- Fix function search_paths
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke direct execute on SECURITY DEFINER helpers from PostgREST roles
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Profiles: only own row
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- user_roles: only own rows
DROP POLICY IF EXISTS roles_read ON public.user_roles;
CREATE POLICY roles_read_own ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Helper: staff-or-admin check inline via has_role (SECURITY DEFINER bypasses RLS on user_roles)
-- Categories
DROP POLICY IF EXISTS cat_all_auth ON public.categories;
CREATE POLICY cat_select ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY cat_write ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Products
DROP POLICY IF EXISTS products_all_auth ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_write ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Price history: admin only for writes; staff+admin read
DROP POLICY IF EXISTS ph_all_auth ON public.price_history;
CREATE POLICY ph_select ON public.price_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY ph_insert ON public.price_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY ph_admin_modify ON public.price_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ph_admin_delete ON public.price_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Customers (PII)
DROP POLICY IF EXISTS customers_all_auth ON public.customers;
CREATE POLICY customers_rw ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Sales
DROP POLICY IF EXISTS sales_all_auth ON public.sales;
CREATE POLICY sales_select ON public.sales FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());
CREATE POLICY sales_insert ON public.sales FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
              AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY sales_update ON public.sales FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY sales_delete ON public.sales FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sale items: scoped through parent sale
DROP POLICY IF EXISTS sale_items_all_auth ON public.sale_items;
CREATE POLICY sale_items_select ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (public.has_role(auth.uid(), 'admin') OR s.created_by = auth.uid())));
CREATE POLICY sale_items_insert ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (public.has_role(auth.uid(), 'admin') OR s.created_by = auth.uid())));
CREATE POLICY sale_items_update ON public.sale_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY sale_items_delete ON public.sale_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
