-- Création ou remplacement de la table profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  organization_id text,
  customer_id text,
  stripe_customer_id text,
  avatar_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  role text DEFAULT 'user'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Ajout d'index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);

-- Commentaire sur la table
COMMENT ON TABLE public.profiles IS 'Profils des utilisateurs connectés à auth.users';
