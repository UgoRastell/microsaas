-- Création ou remplacement de la table customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company text,
  vat text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Si la table existe déjà, s'assurer que la colonne user_id existe
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'customers' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Commentaire sur la table
COMMENT ON TABLE public.customers IS 'Table des clients avec référence à l''utilisateur propriétaire';
