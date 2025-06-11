import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@supabase/auth-helpers-react';
import subscriptionService, { Subscription } from '../services/subscription-service';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(5);

  // Récupérer l'ID de la session Stripe depuis l'URL si disponible
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    const loadSubscription = async () => {
      if (!session) return;
      
      try {
        setLoading(true);
        const currentSubscription = await subscriptionService.getCurrentSubscription(session);
        setSubscription(currentSubscription);
      } catch (error) {
        console.error('Erreur lors du chargement de l\'abonnement:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSubscription();
  }, [session]);

  // Compte à rebours pour la redirection automatique
  useEffect(() => {
    if (loading) return;
    
    const timer = setInterval(() => {
      setCountdown((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, navigate]);

  // Calcul de la date de fin au format lisible
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white shadow-xl rounded-lg max-w-lg w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircleIcon className="h-16 w-16 text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Paiement réussi !
        </h1>
        
        {loading ? (
          <div className="animate-pulse flex flex-col items-center space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">
              Merci pour votre abonnement. Votre plan {' '}
              <span className="font-semibold">
                {subscription?.plan_type === 'standard' ? 'Standard' : 
                 subscription?.plan_type === 'premium' ? 'Premium' : 
                 subscription?.plan_type === 'freemium' ? 'Freemium' : 'Inconnu'}
              </span> {' '}
              est maintenant actif.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Détails de l'abonnement</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-gray-500">Statut:</span>
                  <span className={`font-medium ${
                    subscription?.status === 'active' ? 'text-green-600' : 
                    subscription?.status === 'trialing' ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {subscription?.status === 'active' ? 'Actif' :
                     subscription?.status === 'trialing' ? 'Période d\'essai' :
                     subscription?.status}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Plan:</span>
                  <span className="font-medium">
                    {subscription?.plan_type === 'standard' ? 'Standard' : 
                     subscription?.plan_type === 'premium' ? 'Premium' : 
                     subscription?.plan_type === 'freemium' ? 'Freemium' : 'Inconnu'}
                  </span>
                </li>
                {subscription?.current_period_end && (
                  <li className="flex justify-between">
                    <span className="text-gray-500">Prochain renouvellement:</span>
                    <span className="font-medium">{formatDate(subscription.current_period_end)}</span>
                  </li>
                )}
                {subscription?.invoice_limit !== undefined && (
                  <li className="flex justify-between">
                    <span className="text-gray-500">Limite de factures:</span>
                    <span className="font-medium">
                      {subscription.invoice_limit === 0 ? 'Illimité' : subscription.invoice_limit}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
        
        <div className="mt-6">
          <p className="text-sm text-gray-500">
            Redirection automatique dans <span className="font-medium">{countdown}</span> secondes...
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
          >
            Aller au tableau de bord
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
