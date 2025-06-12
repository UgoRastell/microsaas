-- DATABASE SCHEMA
-- Note: This schema is meant to be run on a Supabase database

-- Table: Profiles (simplified, removed Stripe references)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  organization_id text,
  avatar_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  role text DEFAULT 'user'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- Table: Customers
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company text,
  vat text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Table: Invoices
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  number bigint NOT NULL,
  customer_id uuid NOT NULL,
  total numeric DEFAULT '0'::numeric,
  status text NOT NULL,
  due_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL, -- Added user_id for better isolation
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Table: Invoice Items
CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT '1'::numeric,
  price numeric DEFAULT '0'::numeric,
  amount numeric DEFAULT '0'::numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);

-- Row Level Security (RLS) Policies

-- Profiles: Users can only view and update their own profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Customers: Users can only access their own customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customers" 
  ON public.customers FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers" 
  ON public.customers FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers" 
  ON public.customers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers" 
  ON public.customers FOR DELETE
  USING (auth.uid() = user_id);

-- Invoices: Users can only access invoices linked to their own customers
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" 
  ON public.invoices FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" 
  ON public.invoices FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" 
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices" 
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Invoice Items: Access is determined by the parent invoice
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice items" 
  ON public.invoice_items FOR SELECT 
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own invoice items" 
  ON public.invoice_items FOR INSERT 
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own invoice items" 
  ON public.invoice_items FOR UPDATE
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own invoice items" 
  ON public.invoice_items FOR DELETE
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE user_id = auth.uid()
    )
  );
