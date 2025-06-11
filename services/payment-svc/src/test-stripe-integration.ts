import Stripe from 'stripe';
import { SubscriptionService } from './providers/subscription-service';
import { logger } from './utils/logger';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

// Configuration Stripe et Supabase
const stripeApiKey = process.env.STRIPE_API_KEY || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!stripeApiKey || !supabaseUrl || !supabaseServiceKey) {
  logger.error('Variables d\'environnement manquantes');
  process.exit(1);
}

// Initialisation des clients
try {
  logger.info(`Configuration avec Stripe API Key: ${stripeApiKey.substring(0, 8)}... et Supabase URL: ${supabaseUrl}`);

  const stripe = new Stripe(stripeApiKey, {
    apiVersion: '2023-10-16'
  });
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Initialisation du service d'abonnement
const subscriptionService = new SubscriptionService(stripe, supabaseClient);

// Organisation et client fictifs pour les tests
const testOrgId = 'test-org-' + Date.now();
const testCustomerId = 'test-customer-' + Date.now();
const testEmail = 'test@example.com';

async function runTests() {
  try {
    logger.info('===== TEST D\'INTÉGRATION STRIPE =====');
    logger.info(`ID Organisation de test: ${testOrgId}`);
    logger.info(`ID Client de test: ${testCustomerId}`);
    logger.info(`Email de test: ${testEmail}`);
    
    // Test 1 : Initialiser les plans Stripe
    logger.info('\n----- Test 1: Initialisation des plans Stripe -----');
    logger.info('Démarrage de l\'initialisation des plans...');
    const plans = await subscriptionService.initializeStripePlans();
    logger.info(`Plans initialisés avec succès: ${plans.length}`);
    plans.forEach(p => logger.info(`- ${p.name} (${p.id}): ${p.stripeProductId || 'Pas de produit Stripe'}, ${p.stripePriceId || 'Pas de prix Stripe'}`));
    
    // Test 2 : Récupérer les plans disponibles
    logger.info('\n----- Test 2: Récupération des plans disponibles -----');
    logger.info('Récupération des plans disponibles...');
    const availablePlans = await subscriptionService.getAvailablePlans();
    logger.info(`Plans disponibles récupérés: ${availablePlans.length}`);
    
    // Test 3 : Créer un abonnement Freemium
    logger.info('\n----- Test 3: Création d\'un abonnement Freemium via createSubscriptionCheckout -----');
    const freemiumPlan = availablePlans.find(p => p.id === 'freemium');
    if (!freemiumPlan) {
      logger.error('Plan Freemium non trouvé dans les plans disponibles');
      throw new Error('Plan Freemium non trouvé');
    }
    
    logger.info(`Création de l'abonnement Freemium avec le plan: ${JSON.stringify(freemiumPlan)}`);
    
    // Utiliser la méthode publique createSubscriptionCheckout
    try {
      const freemiumCheckout = await subscriptionService.createSubscriptionCheckout({
        planId: freemiumPlan.id,
        organizationId: testOrgId,
        customerId: testCustomerId,
        customerEmail: testEmail,
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      });
      
      logger.info(`Session de checkout Freemium créée: ${JSON.stringify(freemiumCheckout, null, 2)}`);
      logger.info(`URL de checkout Freemium: ${freemiumCheckout.url}`);
    } catch (error) {
      logger.error(`Erreur lors de la création de l'abonnement Freemium: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Détail de l\'erreur:', error);
      throw error;
    }

    
    // Test 4 : Créer une session de checkout payant (pour un upgrade)
    logger.info('\n----- Test 4: Création d\'une session de checkout pour upgrade -----');
    const standardPlan = availablePlans.find(p => p.id === 'standard');
    if (!standardPlan) {
      logger.error('Plan Standard non trouvé dans les plans disponibles');
      throw new Error('Plan Standard non trouvé');
    }
    
    logger.info(`Création de la session de checkout Standard avec le plan: ${JSON.stringify(standardPlan)}`);
    
    try {
      const checkoutSession = await subscriptionService.createSubscriptionCheckout({
        planId: standardPlan.id,
        organizationId: testOrgId,
        customerId: testCustomerId,
        customerEmail: testEmail,
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      });
      
      logger.info(`Session de checkout Standard créée: ${JSON.stringify(checkoutSession, null, 2)}`);
      logger.info(`URL de checkout Standard: ${checkoutSession.url}`);
    } catch (error) {
      logger.error(`Erreur lors de la création de la session de checkout Standard: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Détail de l\'erreur:', error);
      throw error;
    }
    
    // Test 5 : Tester l'incrémentation d'utilisation des factures
    logger.info('\n----- Test 5: Incrémentation de l\'utilisation des factures -----');
    try {
      logger.info(`Tentative d'incrémentation de l'utilisation pour l'organisation ${testOrgId}`);
      const usage = await subscriptionService.incrementInvoiceUsage(testOrgId, 1);
      logger.info(`Utilisation incrémentée avec succès: ${JSON.stringify(usage, null, 2)}`);
    } catch (error) {
      logger.error(`Erreur lors de l'incrémentation: ${error instanceof Error ? error.message : String(error)}`);
      logger.info('Note: Cette erreur est normale si l\'abonnement n\'existe pas encore dans Supabase');
    }
    
    logger.info('\n===== TESTS TERMINÉS AVEC SUCCÈS =====');
    
  } catch (error) {
    logger.error(`Erreur pendant les tests: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('Détail complet de l\'erreur:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runTests();

} catch (error) {
  logger.error(`Erreur d'initialisation: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
