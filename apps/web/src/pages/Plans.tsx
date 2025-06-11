import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSession } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import subscriptionService, { Plan, Subscription } from '../services/subscription-service';

const Plans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const user = useUser();
  const session = useSession();
  const navigate = useNavigate();
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [plansData, subscription] = await Promise.all([
          subscriptionService.getPlans(session),
          subscriptionService.getCurrentSubscription(session)
        ]);
        
        // Filtrer uniquement les plans principaux (pas les addons)
        const mainPlans = plansData.filter(plan => plan.type !== 'addon');
        setPlans(mainPlans);
        setCurrentSubscription(subscription);
      } catch (err) {
        console.error('Erreur lors du chargement des données:', err);
        setError('Impossible de charger les plans ou les informations d\'abonnement.');
        toast.error('Impossible de charger les plans d\'abonnement.');
      } finally {
        setLoading(false);
      }
    };
    
    if (session) {
      loadData();
    }
  }, [session]);
  
  const handleSubscribe = async (planId: string) => {
    if (!user) return;
    
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    // Pour les plans freemium, on affiche une confirmation avec message informatif
    if (plan.type === 'freemium') {
      if (!window.confirm(
          'Vous allez activer le plan gratuit Freemium. Voulez-vous continuer ?'
        )) {
        return;
      }
    }
    
    const toastId = toast.loading(
      plan.price > 0
        ? 'Préparation de votre session de paiement Stripe...'
        : 'Activation de votre plan Freemium...'
    );
    
    setActionLoading(true);
    try {
      // createCheckoutSession retourne directement l'URL de Stripe Checkout
      const url = await subscriptionService.createCheckoutSession(planId, session);
      
      if (plan.type === 'freemium') {
        // Pour le plan freemium, pas de redirection vers Stripe
        toast.success('Votre plan Freemium a été activé avec succès !', { id: toastId });
        // Rafraîchir l'abonnement et rediriger vers le tableau de bord
        const subscription = await subscriptionService.getCurrentSubscription(session);
        setCurrentSubscription(subscription);
        navigate('/dashboard');
      } else {
        // Pour les plans payants, redirection vers Stripe
        toast.dismiss(toastId);
        window.location.href = url;
      }
    } catch (err) {
      console.error('Erreur lors de la création du checkout:', err);
      setError('Impossible de créer la session de paiement. Veuillez réessayer plus tard.');
      toast.error('Impossible de préparer votre abonnement. Veuillez réessayer plus tard.', { id: toastId });
    } finally {
      if (plan.type !== 'freemium') {
        setActionLoading(false);
      }
    }
  };
  
  const handleCancel = async () => {
    if (!user || !currentSubscription) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir annuler votre abonnement ? Vous aurez toujours accès jusqu\'à la fin de la période de facturation actuelle.')) {
      const toastId = toast.loading('Annulation de votre abonnement en cours...');
      setActionLoading(true);
      try {
        await subscriptionService.cancelSubscription(session);
        // Rafraîchir l'abonnement
        const subscription = await subscriptionService.getCurrentSubscription(session);
        setCurrentSubscription(subscription);
        toast.success('Votre abonnement a été annulé. Il restera actif jusqu\'à la fin de votre période actuelle.', { id: toastId });
      } catch (err) {
        console.error('Erreur lors de l\'annulation de l\'abonnement:', err);
        setError('Impossible d\'annuler l\'abonnement. Veuillez réessayer plus tard.');
        toast.error('Impossible d\'annuler votre abonnement. Veuillez réessayer plus tard.', { id: toastId });
      } finally {
        setActionLoading(false);
      }
    }
  };
  
  const isPlanActive = (planType: string): boolean => {
    return currentSubscription !== null && currentSubscription.plan_type === planType;
  };
  
  const canUpgradeToPlan = (planType: string): boolean => {
    if (!currentSubscription) return true; // Peut souscrire à n'importe quel plan s'il n'a pas d'abonnement
    
    // Logique pour déterminer si le plan est une amélioration
    if (currentSubscription.plan_type === 'freemium') {
      return planType === 'standard' || planType === 'premium';
    } else if (currentSubscription.plan_type === 'standard') {
      return planType === 'premium';
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        <p className="text-center mt-4">Chargement des plans d'abonnement...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
          Plans d'abonnement
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-gray-600">
          Choisissez le plan qui correspond le mieux à vos besoins.
        </p>
        
        {currentSubscription && (
          <div className="mt-6 bg-blue-50 py-3 px-4 rounded-lg inline-block">
            <p className="text-blue-800">
              Vous êtes actuellement abonné au plan <strong>{currentSubscription.plan_type.charAt(0).toUpperCase() + currentSubscription.plan_type.slice(1)}</strong>
              {" "}
              <span className="text-sm">
                ({currentSubscription.status === 'active' ? 'actif' : 
                 currentSubscription.status === 'canceled' ? 'annulé' : 
                 currentSubscription.status === 'trialing' ? 'période d\'essai' : 
                 currentSubscription.status})
              </span>
            </p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div 
            key={plan.id}
            className={`border rounded-lg overflow-hidden shadow-sm transition-all ${
              isPlanActive(plan.type) ? 'ring-2 ring-blue-500 border-blue-500' : ''
            }`}
          >
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">{plan.name}</h2>
              <div className="mt-4">
                <span className="text-3xl font-bold text-gray-900">{plan.price === 0 ? 'Gratuit' : `${plan.price}€`}</span>
                {plan.price > 0 && <span className="text-gray-500 ml-2">/ {plan.period}</span>}
              </div>
              <p className="mt-4 text-gray-500">{plan.description}</p>
            </div>
            
            <div className="p-6">
              <ul className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 shrink-0 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-8">
                {isPlanActive(plan.type) ? (
                  <button
                    className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded disabled:opacity-50"
                    disabled={true}
                  >
                    Plan actuel
                  </button>
                ) : canUpgradeToPlan(plan.type) ? (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'En cours...' : plan.price === 0 ? 'Activer' : currentSubscription ? 'Passer à ce plan' : 'S\'abonner'}
                  </button>
                ) : (
                  <button
                    className="w-full py-2 px-4 bg-gray-200 text-gray-500 rounded cursor-not-allowed"
                    disabled={true}
                  >
                    Non disponible
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {currentSubscription && currentSubscription.plan_type !== 'freemium' && currentSubscription.status === 'active' && (
        <div className="mt-12 text-center">
          <button
            onClick={handleCancel}
            className="text-red-600 hover:text-red-800 font-medium"
            disabled={actionLoading}
          >
            {actionLoading ? 'En cours...' : 'Annuler mon abonnement'}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Votre abonnement restera actif jusqu'à la fin de la période de facturation actuelle.
          </p>
        </div>
      )}
    </div>
  );
};

export default Plans;
