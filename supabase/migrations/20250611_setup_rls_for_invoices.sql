-- 1. Ajouter une colonne user_id à la table customers pour associer chaque client à un utilisateur
ALTER TABLE public.customers 
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- 2. Mettre à jour les clients existants pour les associer à leurs créateurs
-- Vous devrez faire cela manuellement si vous avez déjà des données
-- Exemple:
-- UPDATE public.customers SET user_id = 'ID-DE-UTILISATEUR' WHERE id = 'ID-DU-CLIENT';

-- 3. Activer Row Level Security sur toutes les tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 4. Créer des politiques RLS pour la table customers
CREATE POLICY "Users can view their own customers" 
ON public.customers
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own customers" 
ON public.customers
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customers" 
ON public.customers
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own customers" 
ON public.customers
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Créer des politiques RLS pour la table invoices
-- Pour les factures, nous devons joindre les tables pour vérifier le user_id du customer
CREATE POLICY "Users can view their own invoices"
ON public.invoices
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.customers
  WHERE customers.id = invoices.customer_id
  AND customers.user_id = auth.uid()
));

CREATE POLICY "Users can create invoices for their own customers"
ON public.invoices
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.customers
  WHERE customers.id = invoices.customer_id
  AND customers.user_id = auth.uid()
));

CREATE POLICY "Users can update invoices for their own customers"
ON public.invoices
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.customers
  WHERE customers.id = invoices.customer_id
  AND customers.user_id = auth.uid()
));

CREATE POLICY "Users can delete invoices for their own customers"
ON public.invoices
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.customers
  WHERE customers.id = invoices.customer_id
  AND customers.user_id = auth.uid()
));

-- 6. Créer des politiques RLS pour la table invoice_items
-- Pour les éléments de facture, nous devons joindre les tables pour vérifier
-- que la facture appartient à un client de l'utilisateur
CREATE POLICY "Users can view their own invoice items"
ON public.invoice_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.invoices
  JOIN public.customers ON invoices.customer_id = customers.id
  WHERE invoice_items.invoice_id = invoices.id
  AND customers.user_id = auth.uid()
));

CREATE POLICY "Users can create invoice items for their own invoices"
ON public.invoice_items
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices
  JOIN public.customers ON invoices.customer_id = customers.id
  WHERE invoice_items.invoice_id = invoices.id
  AND customers.user_id = auth.uid()
));

CREATE POLICY "Users can update invoice items for their own invoices"
ON public.invoice_items
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.invoices
  JOIN public.customers ON invoices.customer_id = customers.id
  WHERE invoice_items.invoice_id = invoices.id
  AND customers.user_id = auth.uid()
));

CREATE POLICY "Users can delete invoice items for their own invoices"
ON public.invoice_items
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.invoices
  JOIN public.customers ON invoices.customer_id = customers.id
  WHERE invoice_items.invoice_id = invoices.id
  AND customers.user_id = auth.uid()
));

-- 7. Mettre à jour la fonction de création de clients pour inclure l'ID utilisateur
CREATE OR REPLACE FUNCTION public.create_customer_with_user_id(
  p_email text,
  p_company text,
  p_vat text
) RETURNS uuid AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  INSERT INTO public.customers (email, company, vat, user_id)
  VALUES (p_email, p_company, p_vat, auth.uid())
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
