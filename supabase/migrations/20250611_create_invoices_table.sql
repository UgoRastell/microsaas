-- Création ou remplacement de la table invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  number bigint NOT NULL,
  customer_id uuid NOT NULL,
  total numeric DEFAULT '0'::numeric,
  status text NOT NULL,
  due_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

-- Vérifier l'existence de la séquence pour générer le numéro de facture
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'invoices_number_seq') THEN
    CREATE SEQUENCE public.invoices_number_seq START 1001;
  END IF;
END $$;

-- Commentaire sur la table
COMMENT ON TABLE public.invoices IS 'Table des factures liées aux clients';
