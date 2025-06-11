-- Script de correction pour créer les profils et abonnements manquants
-- Pour les utilisateurs existants

-- Étape 1: Créer des profils pour tous les utilisateurs qui n'en ont pas
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  created_at,
  updated_at
)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'first_name', ''),
  COALESCE(raw_user_meta_data->>'last_name', ''),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Étape 2: Créer des abonnements freemium pour tous les utilisateurs qui n'en ont pas
INSERT INTO public.subscriptions (
  id,
  status,
  plan_type,
  start_date,
  current_period_start,
  current_period_end,
  invoice_usage,
  invoice_limit,
  organization_id,
  customer_id,
  stripe_subscription_id,
  metadata,
  created_at,
  user_id
)
SELECT 
  'sub_free_' || substr(replace(u.id::text, '-', ''), 1, 16),
  'active',
  'freemium',
  now(),
  now(),
  now() + interval '1 year',
  0,
  10,
  u.id::text,
  u.id::text,
  NULL,
  '{"note": "Auto-generated freemium subscription for existing user"}'::jsonb,
  now(),
  u.id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
);

-- Vérification: Afficher les utilisateurs avec leurs profils et abonnements associés
SELECT 
  a.id as auth_id, 
  a.email, 
  p.id as profile_id, 
  s.id as subscription_id, 
  s.plan_type 
FROM auth.users a
LEFT JOIN public.profiles p ON a.id = p.id
LEFT JOIN public.subscriptions s ON a.id = s.user_id
ORDER BY a.created_at DESC;
