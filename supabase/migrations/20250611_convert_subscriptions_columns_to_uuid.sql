-- 1. Désactiver temporairement RLS
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer les politiques existantes
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.subscriptions;

-- 3. Modifier les types de colonnes
ALTER TABLE public.subscriptions 
ALTER COLUMN customer_id TYPE uuid USING customer_id::uuid,
ALTER COLUMN organization_id TYPE uuid USING organization_id::uuid;

-- 4. Réactiver RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. Recréer les politiques avec la bonne syntaxe pour UUID
CREATE POLICY "Users can view their own subscriptions" 
  ON public.subscriptions 
  FOR SELECT 
  USING (auth.uid() = customer_id OR user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions" 
  ON public.subscriptions 
  FOR UPDATE 
  USING (auth.uid() = customer_id OR user_id = auth.uid());

-- Politique spéciale pour le rôle de service (pour les webhooks Stripe, API Gateway, etc.)
CREATE POLICY "Service role can manage all subscriptions" 
  ON public.subscriptions 
  USING (auth.role() = 'service_role');

-- 6. Mettre à jour le commentaire
COMMENT ON TABLE public.subscriptions IS 'Abonnements avec politiques RLS pour limiter l''accès aux propriétaires (types UUID)';
