-- Création ou remplacement de la table invoice_items
CREATE TABLE IF NOT EXISTS public.invoice_items (
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

-- Ajout d'un trigger pour calculer automatiquement le montant
CREATE OR REPLACE FUNCTION public.calculate_invoice_item_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount := NEW.quantity * NEW.price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création du trigger sur invoice_items
DROP TRIGGER IF EXISTS calculate_amount_trigger ON public.invoice_items;
CREATE TRIGGER calculate_amount_trigger
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.calculate_invoice_item_amount();

-- Commentaire sur la table
COMMENT ON TABLE public.invoice_items IS 'Table des lignes de factures';
