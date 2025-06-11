"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPABASE_DB_URL = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("./logger");
require("dotenv/config");
// Configuration pour Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    logger_1.logger.error('SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis dans les variables d\'environnement');
    process.exit(1);
}
// Création du client Supabase
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
// Configuration pour la connexion directe à la base de données PostgreSQL
exports.SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || '';
logger_1.logger.info('Client Supabase initialisé');
if (exports.SUPABASE_DB_URL) {
    logger_1.logger.info('Connexion directe PostgreSQL configurée');
}
//# sourceMappingURL=supabase.js.map