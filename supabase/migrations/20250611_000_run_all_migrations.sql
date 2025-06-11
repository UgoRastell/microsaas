-- Script principal pour exécuter toutes les migrations dans l'ordre approprié
-- Date: 2025-06-11

-- Remarque: Ce script est conçu pour être exécuté dans l'ordre, mais vous pouvez
-- aussi exécuter chaque migration individuellement via l'éditeur SQL de Supabase

-- 1. Création des tables de base
\ir 20250611_create_customers_table.sql
\ir 20250611_create_invoices_table.sql
\ir 20250611_create_invoice_items_table.sql
\ir 20250611_create_profiles_table.sql
\ir 20250611_create_subscriptions_table.sql

-- 2. Mise en place des triggers pour les profils
\ir 20250611_create_profile_trigger.sql

-- 3. Configuration des politiques RLS pour l'isolation des données
\ir 20250611_setup_rls_for_invoices.sql
\ir 20250611_setup_rls_for_subscriptions.sql

-- 4. Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Toutes les migrations ont été exécutées avec succès!';
END $$;
