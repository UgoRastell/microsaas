-- Activer Row Level Security sur la table subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes si nécessaires
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.subscriptions;

-- Créer les politiques pour les abonnements
CREATE POLICY "Users can view their own subscriptions" 
  ON public.subscriptions 
  FOR SELECT 
  USING (auth.uid()::text = customer_id OR user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions" 
  ON public.subscriptions 
  FOR UPDATE 
  USING (auth.uid()::text = customer_id OR user_id = auth.uid());

-- Politique spéciale pour le rôle de service (pour les webhooks Stripe, API Gateway, etc.)
CREATE POLICY "Service role can manage all subscriptions" 
  ON public.subscriptions 
  USING (auth.role() = 'service_role');

-- Commentaire sur les politiques
COMMENT ON TABLE public.subscriptions IS 'Abonnements avec politiques RLS pour limiter l''accès aux propriétaires';
