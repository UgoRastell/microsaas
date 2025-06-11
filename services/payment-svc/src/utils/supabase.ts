import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';
import 'dotenv/config';

// Configuration pour Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis dans les variables d\'environnement');
  process.exit(1);
}

// Création du client Supabase
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configuration pour la connexion directe à la base de données PostgreSQL
export const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || '';

logger.info('Client Supabase initialisé');
if (SUPABASE_DB_URL) {
  logger.info('Connexion directe PostgreSQL configurée');
}
