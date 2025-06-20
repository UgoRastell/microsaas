import React, { useState, useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useNavigate, Link, useLocation } from 'react-router-dom'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  
  const supabase = useSupabaseClient()
  const navigate = useNavigate()
  const location = useLocation()

  // Gérer les redirections Supabase pour la vérification d'email
  useEffect(() => {
    const handleHashBasedAuth = async () => {
      setLoading(true)
      const hash = window.location.hash

      try {
        // Nouveau format: /#accesstoken/login
        if (hash && hash.startsWith('#accesstoken')) {
          setVerificationMessage('Votre email a été vérifié avec succès! Vous pouvez maintenant vous connecter.')
          // Nettoyer l'URL
          window.history.replaceState({}, document.title, window.location.pathname)
          setLoading(false)
          return
        }
        
        // Format Supabase standard avec paramètres dans le hash
        if (hash && hash.includes('access_token')) {
          // Extraire les paramètres
          const hashParams = new URLSearchParams(hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const type = hashParams.get('type')
          
          // Nettoyer l'URL pour sécurité
          window.history.replaceState({}, document.title, window.location.pathname)
          
          // Vérifier le type de redirection
          if (type === 'signup') {
            setVerificationMessage('Votre email a été vérifié avec succès! Vous pouvez maintenant vous connecter.')
          } else if (type === 'recovery') {
            setVerificationMessage('Vous pouvez maintenant réinitialiser votre mot de passe.')
            setMode('forgot')
          }
          
          // Essayer de se connecter automatiquement si un token est présent
          if (accessToken) {
            const { data, error } = await supabase.auth.getUser(accessToken)
            
            if (data?.user && !error) {
              // Rediriger vers le dashboard si la connexion est réussie
              navigate('/dashboard')
            }
          }
        }
      } catch (err) {
        console.error('Erreur lors du traitement du hash URL:', err)
        setError('Erreur lors du traitement de l\'authentification')
      } finally {
        setLoading(false)
      }
    }
    
    handleHashBasedAuth()
  }, [location, navigate, supabase.auth, setMode, setVerificationMessage, setError])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de la connexion.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      // 1. Créer l'utilisateur dans Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            first_name: firstName,
            last_name: lastName
          }
        },
      })
      
      if (authError) throw authError
      
      // 2. Pour le profil, nous utilisons le trigger de base de données
      // Le trigger va créer automatiquement un profil dans la table profiles
      // lorsqu'un utilisateur est créé dans auth.users
      // 
      // Si vous n'avez pas encore créé le trigger, veuillez exécuter le script SQL
      // dans le fichier supabase/migrations/20250611_create_profile_trigger.sql
      //
      // Note : Les données first_name et last_name sont déjà incluses dans les metadata
      // de l'utilisateur et seront utilisées par le trigger
      
      if (authData.user) {
        // 3. Créer un abonnement freemium par défaut
        try {
          // Au lieu de créer l'abonnement directement depuis le frontend,
          // nous allons utiliser l'API Gateway qui a les permissions nécessaires
          // pour effectuer ces modifications sans être bloqué par le RLS
          
          // Nous attendrons que l'utilisateur confirme son email
          // L'abonnement freemium sera créé lors de la première connexion
          
          // En attendant, nous pouvons créer une entrée dans une table de journalisation
          // pour indiquer que l'utilisateur souhaite s'inscrire au plan freemium
          try {
            const { error: logError } = await supabase
              .from('signup_logs')
              .insert({
                user_id: authData.user.id,
                email: email,
                desired_plan: 'freemium',
                created_at: new Date().toISOString()
              })
              
            if (logError && logError.code !== '42P01') { // Ignore si la table n'existe pas encore
              console.log('Note: Table signup_logs non trouvée. Ceci est normal si vous ne l\'avez pas encore créée.')
            }
          } catch (logErr) {
            // Ignorer cette erreur non critique
            console.log('Impossible de journaliser l\'inscription', logErr)
          }
        } catch (subscriptionError) {
          console.error('Erreur lors de la création de l\'abonnement:', subscriptionError)
          // On ne lance pas d'erreur ici pour ne pas bloquer l'inscription
        }
      }
      
      setMode('login')
      alert('Vérifiez votre email pour confirmer votre inscription.')
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l\'inscription.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) throw error
      alert('Vérifiez votre email pour réinitialiser votre mot de passe.')
      setMode('login')
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-blue-600">AutoInvoice</h1>
        <h2 className="mt-2 text-center text-2xl font-bold text-gray-900">
          {mode === 'login' && 'Connectez-vous à votre compte'}
          {mode === 'signup' && 'Créez votre compte'}
          {mode === 'forgot' && 'Réinitialiser votre mot de passe'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}
          
          {verificationMessage && (
            <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
              {verificationMessage}
            </div>
          )}

          {mode === 'login' && (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Mot de passe
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </div>
            </form>
          )}

          {mode === 'signup' && (
            <form className="space-y-4" onSubmit={handleSignup}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    Prénom
                  </label>
                  <div className="mt-1">
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Nom
                  </label>
                  <div className="mt-1">
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Mot de passe
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Création du compte...' : 'Créer un compte'}
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form className="space-y-6" onSubmit={handleForgotPassword}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Envoi...' : 'Réinitialiser le mot de passe'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {mode === 'login' ? "Vous n'avez pas de compte ?" : 'Déjà inscrit ?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
