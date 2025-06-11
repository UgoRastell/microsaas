import { useState, useEffect } from 'react'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { useForm } from 'react-hook-form'

// Types pour le formulaire
interface ProfileFormData {
  fullName: string
  company: string
  address: string
  postalCode: string
  city: string
  country: string
  phone: string
  taxNumber: string
  bankName: string
  iban: string
  bic: string
}

const Settings = () => {
  const supabase = useSupabaseClient()
  const user = useUser()
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // React Hook Form
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>()

  // Chargement du profil utilisateur
  const loadProfile = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      if (data) {
        // Remplissage du formulaire avec les données existantes
        reset({
          fullName: data.full_name || '',
          company: data.company || '',
          address: data.address || '',
          postalCode: data.postal_code || '',
          city: data.city || '',
          country: data.country || '',
          phone: data.phone || '',
          taxNumber: data.tax_number || '',
          bankName: data.bank_name || '',
          iban: data.iban || '',
          bic: data.bic || ''
        })
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  // Soumission du formulaire
  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return
    
    setLoading(true)
    setSaveSuccess(false)
    
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: data.fullName,
          company: data.company,
          address: data.address,
          postal_code: data.postalCode,
          city: data.city,
          country: data.country,
          phone: data.phone,
          tax_number: data.taxNumber,
          bank_name: data.bankName,
          iban: data.iban,
          bic: data.bic,
          updated_at: new Date().toISOString()
        })
      
      if (error) throw error
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du profil:', error)
      alert('Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.')
    } finally {
      setLoading(false)
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

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            Informations de facturation
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Ces informations apparaîtront sur vos factures.
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          {loading && !user ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-gray-500">Chargement des paramètres...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Message de succès */}
              {saveSuccess && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Vos paramètres ont été enregistrés avec succès.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Nom complet
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="fullName"
                      className="input"
                      {...register('fullName', { required: "Le nom est requis" })}
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                    Entreprise
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="company"
                      className="input"
                      {...register('company')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Adresse
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="address"
                      className="input"
                      {...register('address')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
                    Code postal
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="postalCode"
                      className="input"
                      {...register('postalCode')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    Ville
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="city"
                      className="input"
                      {...register('city')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Pays
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="country"
                      className="input"
                      {...register('country')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Téléphone
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="phone"
                      className="input"
                      {...register('phone')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="taxNumber" className="block text-sm font-medium text-gray-700">
                    Numéro de TVA
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="taxNumber"
                      className="input"
                      {...register('taxNumber')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <h3 className="text-lg font-medium text-gray-900">Informations bancaires</h3>
                  <p className="text-sm text-gray-500">
                    Ces informations apparaîtront sur vos factures pour recevoir les paiements.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">
                    Banque
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="bankName"
                      className="input"
                      {...register('bankName')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="iban" className="block text-sm font-medium text-gray-700">
                    IBAN
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="iban"
                      className="input"
                      {...register('iban')}
                    />
                  </div>
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="bic" className="block text-sm font-medium text-gray-700">
                    BIC
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="bic"
                      className="input"
                      {...register('bic')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
