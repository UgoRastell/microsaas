-- Création ou remplacement de la table subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id text NOT NULL,
  status text NOT NULL,
  plan_type text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  canceled_at timestamp with time zone,
  invoice_usage integer DEFAULT 0,
  invoice_limit integer,
  organization_id text NOT NULL,
  customer_id text NOT NULL,
  stripe_subscription_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id)
);

-- Ajout d'une colonne user_id pour lier les abonnements aux utilisateurs
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscriptions' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Ajout d'index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Commentaire sur la table
COMMENT ON TABLE public.subscriptions IS 'Abonnements des utilisateurs avec limites et usage';
