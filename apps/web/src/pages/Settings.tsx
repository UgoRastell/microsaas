import React, { useState, useEffect } from 'react'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

interface UserProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  organization_id?: string
  avatar_url?: string
  settings?: any
  role?: string
}

interface NotificationSettings {
  email_invoices: boolean
  email_reminders: boolean
  email_marketing: boolean
}

const Settings = () => {
  const supabase = useSupabaseClient()
  const user = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_invoices: true,
    email_reminders: false,
    email_marketing: false
  })

  // Champs du formulaire de profil
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    organization_id: '',
    email: ''
  })

  useEffect(() => {
    if (user) {
      loadUserProfile()
    }
  }, [user])

  const loadUserProfile = async () => {
    try {
      setLoading(true)
      
      if (!user) return

      // Charger le profil de l'utilisateur
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setProfile(data)
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          organization_id: data.organization_id || '',
          email: user.email || ''
        })
      } else {
        setFormData({
          ...formData,
          email: user.email || ''
        })
      }

      // Charger les préférences de notification (exemple)
      // Cette partie est simulée car ces données ne sont pas dans le schéma
      // Dans un cas réel, vous stockeriez ces préférences dans le champ settings
      const notificationSettings = data?.settings?.notifications || {};
      setNotifications({
        email_invoices: notificationSettings.email_invoices || true,
        email_reminders: notificationSettings.email_reminders || false,
        email_marketing: notificationSettings.email_marketing || false
      })
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error)
      toast.error('Impossible de charger votre profil')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setNotifications({
      ...notifications,
      [name]: checked
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    try {
      setUpdating(true)

      // Préparation des settings avec les préférences de notification
      const settings = {
        ...profile?.settings,
        notifications: {
          email_invoices: notifications.email_invoices,
          email_reminders: notifications.email_reminders,
          email_marketing: notifications.email_marketing
        }
      };

      // Mettre à jour le profil
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: formData.email, // Ajouter l'email pour respecter la contrainte NOT NULL
          first_name: formData.first_name,
          last_name: formData.last_name,
          organization_id: formData.organization_id,
          settings: settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      if (error) throw error
      
      toast.success('Paramètres mis à jour avec succès')
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error)
      toast.error('Erreur lors de la mise à jour du profil')
    } finally {
      setUpdating(false)
    }
  }
  
  return (
    <div className="container mx-auto max-w-7xl">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
            Paramètres
          </h1>
        </div>
      </div>

      {/* Affichage du chargement */}
      {loading ? (
        <div className="py-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-500">Chargement de vos paramètres...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Section principale - informations de profil */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Informations de profil
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Gérez vos informations personnelles et professionnelles
                </p>
              </div>
              
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    {/* Email (lecture seule) */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Adresse email
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={formData.email}
                        readOnly
                        className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-500 sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">Pour changer votre email, contactez le support.</p>
                    </div>

                    {/* Prénom */}
                    <div>
                      <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                        Prénom
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        id="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    {/* Nom */}
                    <div>
                      <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                        Nom
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        id="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    {/* Organisation */}
                    <div>
                      <label htmlFor="organization_id" className="block text-sm font-medium text-gray-700">
                        Organisation
                      </label>
                      <input
                        type="text"
                        name="organization_id"
                        id="organization_id"
                        value={formData.organization_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <button
                      type="submit"
                      disabled={updating}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Section latérale - paramètres de notification et sécurité */}
          <div>
            {/* Préférences de notification */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Préférences de notification
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Gérez vos préférences de notification par email
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="email_invoices"
                        name="email_invoices"
                        type="checkbox"
                        checked={notifications.email_invoices}
                        onChange={handleNotificationChange}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="email_invoices" className="font-medium text-gray-700">Factures</label>
                      <p className="text-gray-500">Recevoir des notifications par email pour les nouvelles factures.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="email_reminders"
                        name="email_reminders"
                        type="checkbox"
                        checked={notifications.email_reminders}
                        onChange={handleNotificationChange}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="email_reminders" className="font-medium text-gray-700">Rappels</label>
                      <p className="text-gray-500">Recevoir des rappels pour les factures impayées.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="email_marketing"
                        name="email_marketing"
                        type="checkbox"
                        checked={notifications.email_marketing}
                        onChange={handleNotificationChange}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="email_marketing" className="font-medium text-gray-700">Marketing</label>
                      <p className="text-gray-500">Recevoir des actualités et offres promotionnelles.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sécurité */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Sécurité
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Gérez vos paramètres de sécurité
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => navigate('/reset-password')}
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Changer de mot de passe
                  </button>
                  
                  <div>
                    <p className="text-sm text-gray-500 mt-2">
                      Pour des raisons de sécurité, nous vous recommandons de changer régulièrement votre mot de passe.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
