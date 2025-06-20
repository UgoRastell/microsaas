import React, { useState, useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useForm } from 'react-hook-form'

// Types
interface Customer {
  id: string
  email: string
  company: string | null
  vat: string | null
  created_at: string
}

interface CustomerFormData {
  email: string
  company: string
  vat: string
}

const Customers = () => {
  const supabase = useSupabaseClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)

  // React Hook Form
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CustomerFormData>()

  // Chargement des clients
  const loadCustomers = async () => {
    setLoading(true)
    try {
      // Grâce aux politiques RLS, seuls les clients de l'utilisateur connecté seront retournés
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Vérifier que les données sont bien filtrées
      console.log(`${data?.length || 0} clients chargés via RLS`)
      setCustomers(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  // Ajout d'un client
  const onSubmitCustomer = async (data: CustomerFormData) => {
    try {
      // Récupérer l'ID de l'utilisateur actuel
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError

      if (!userData || !userData.user) {
        throw new Error('Utilisateur non authentifié')
      }

      const userId = userData.user.id

      if (editingCustomerId) {
        // Mise à jour du client
        const { error } = await supabase
          .from('customers')
          .update({
            email: data.email,
            company: data.company || null,
            vat: data.vat || null
          })
          .eq('id', editingCustomerId)

        if (error) throw error
      } else {
        // Création d'un nouveau client
        const { error } = await supabase
          .from('customers')
          .insert([{
            email: data.email,
            company: data.company || null,
            vat: data.vat || null,
            user_id: userId // Associer le client à l'utilisateur actuel
          }])

        if (error) throw error
      }

      // Réinitialisation et rechargement
      reset()
      setIsAddingCustomer(false)
      setEditingCustomerId(null)
      loadCustomers()
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du client:', error)
      alert('Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.')
    }
  }

  // Suppression d'un client
  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      loadCustomers()
    } catch (error) {
      console.error('Erreur lors de la suppression du client:', error)
      alert('Une erreur est survenue lors de la suppression. Le client a peut-être des factures associées.')
    }
  }

  // Édition d'un client
  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomerId(customer.id)
    setValue('email', customer.email)
    setValue('company', customer.company || '')
    setValue('vat', customer.vat || '')
    setIsAddingCustomer(true)
  }

  return (
    <div className="container mx-auto max-w-7xl">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
            Clients
          </h1>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => {
              reset()
              setEditingCustomerId(null)
              setIsAddingCustomer(!isAddingCustomer)
            }}
            className="ml-3 btn btn-primary"
          >
            {isAddingCustomer ? 'Annuler' : 'Ajouter un client'}
          </button>
        </div>
      </div>

      {/* Formulaire d'ajout/édition */}
      {isAddingCustomer && (
        <div className="bg-white shadow sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {editingCustomerId ? 'Modifier le client' : 'Ajouter un nouveau client'}
            </h3>
            <div className="mt-5">
              <form onSubmit={handleSubmit(onSubmitCustomer)} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1">
                    <input
                      type="email"
                      id="email"
                      className="input"
                      {...register('email', { required: "L'email est requis" })}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div>
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

                <div>
                  <label htmlFor="vat" className="block text-sm font-medium text-gray-700">
                    Numéro de TVA
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="vat"
                      className="input"
                      placeholder="FR12345678900"
                      {...register('vat')}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      reset()
                      setIsAddingCustomer(false)
                      setEditingCustomerId(null)
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editingCustomerId ? 'Mettre à jour' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Liste des clients */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            Liste des clients
          </h2>
        </div>
        <div className="bg-white overflow-hidden">
          {loading ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-gray-500">Chargement des clients...</p>
            </div>
          ) : customers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entreprise
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      N° TVA
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.company || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.vat || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500">Aucun client à afficher.</p>
              <button
                onClick={() => setIsAddingCustomer(true)}
                className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Ajouter votre premier client
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Customers
