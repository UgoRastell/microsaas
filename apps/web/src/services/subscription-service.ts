import { Session } from '@supabase/auth-helpers-react';

export interface Plan {
  id: string;
  name: string;
  type: 'freemium' | 'standard' | 'premium' | 'addon';
  description: string;
  price: number;
  period: string;
  features: string[];
}

export interface Subscription {
  id: string;
  status: string;
  plan_type: 'freemium' | 'standard' | 'premium';
  start_date: string;
  current_period_start: string;
  current_period_end: string;
  canceled_at: string | null;
  invoice_usage: number;
  invoice_limit: number | null;
}

class SubscriptionService {
  private baseUrl = '/api';
  
  async getAccessToken(session: Session | null): Promise<string> {
    if (!session) {
      throw new Error('Utilisateur non authentifié');
    }
    return session.access_token;
  }

  async getPlans(session: Session | null): Promise<Plan[]> {
    try {
      const token = await this.getAccessToken(session);
      const response = await fetch(`${this.baseUrl}/subscriptions/plans`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de la récupération des plans: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.plans;
    } catch (error) {
      console.error('Erreur du service d\'abonnement:', error);
      throw error;
    }
  }

  async getCurrentSubscription(session: Session | null): Promise<Subscription | null> {
    try {
      // Si l'utilisateur n'est pas connecté, retourner null sans faire d'appel API
      if (!session) {
        return null;
      }
      
      const token = await this.getAccessToken(session);
      const response = await fetch(`${this.baseUrl}/subscriptions/current`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 404) {
        return null; // Pas d'abonnement
      }
      
      if (!response.ok) {
        // Essayer de lire les détails de l'erreur depuis le corps de la réponse
        try {
          const errorData = await response.json();
          throw new Error(`Erreur lors de la récupération de l'abonnement: ${errorData.error || response.statusText}`);
        } catch (parseError) {
          // Si impossible de parser le JSON, utiliser le statusText
          throw new Error(`Erreur lors de la récupération de l'abonnement: ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      return data.subscription;
    } catch (error) {
      console.error('Erreur du service d\'abonnement:', error);
      // Retourner null au lieu de propager l'erreur pour éviter les crashes d'UI
      // mais tout de même logger l'erreur
      return null;
    }
  }

  async createCheckoutSession(planId: string, session: Session | null): Promise<string> {
    try {
      // Construire les URLs de succès et d'annulation complètes
      const successUrl = new URL('/payment-success', window.location.origin).toString();
      const cancelUrl = new URL('/plans', window.location.origin).toString();
      
      const token = await this.getAccessToken(session);
      const response = await fetch(`${this.baseUrl}/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          planId,
          successUrl,
          cancelUrl
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de la création de la session de checkout: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Erreur du service d\'abonnement:', error);
      throw error;
    }
  }

  async cancelSubscription(session: Session | null): Promise<void> {
    try {
      const token = await this.getAccessToken(session);
      const response = await fetch(`${this.baseUrl}/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de l'annulation de l'abonnement: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Erreur du service d\'abonnement:', error);
      throw error;
    }
  }
}

export default new SubscriptionService();
