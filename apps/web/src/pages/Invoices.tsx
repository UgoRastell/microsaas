import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

// Types pour nos données
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

interface Invoice {
  id: string
  number: number
  customer_id: string
  total: number
  status: InvoiceStatus
  due_date: string
  created_at: string
  customer_name?: string
}

const Invoices = () => {
  const supabase = useSupabaseClient()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFilter, setCurrentFilter] = useState<InvoiceStatus | 'all'>('all')

  // Chargement des factures
  const loadInvoices = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('invoices')
        .select('*, customers(company, email)')
        .order('created_at', { ascending: false })
      
      // Filtrage par statut si nécessaire
      if (currentFilter !== 'all') {
        query = query.eq('status', currentFilter)
      }
      
      const { data, error } = await query
      
      if (error) throw error

      // Format des données pour l'affichage
      const formattedInvoices = data?.map((invoice: any) => ({
        ...invoice,
        customer_name: invoice.customers?.company || invoice.customers?.email || 'Client inconnu'
      }))

      setInvoices(formattedInvoices || [])
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [currentFilter])

  // Suppression d'une facture
  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) return

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      loadInvoices()
    } catch (error) {
      console.error('Erreur lors de la suppression de la facture:', error)
      alert('Une erreur est survenue lors de la suppression.')
    }
  }

  // Classe CSS pour chaque statut
  const statusClasses = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800'
  }

  // Libellé français pour chaque statut
  const statusLabels = {
    draft: 'Brouillon',
    sent: 'Envoyée',
    paid: 'Payée',
    overdue: 'En retard'
  }

  // Format de la date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('fr-FR').format(date)
  }

  // Options de filtrage
  const filterOptions = [
    { value: 'all', label: 'Toutes' },
    { value: 'draft', label: 'Brouillons' },
    { value: 'sent', label: 'Envoyées' },
    { value: 'paid', label: 'Payées' },
    { value: 'overdue', label: 'En retard' }
  ]

  return (
    <div className="container mx-auto max-w-7xl">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
            Factures
          </h1>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            to="/invoices/new"
            className="ml-3 btn btn-primary"
          >
            Nouvelle facture
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 shadow rounded-lg mb-6">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-700 mr-2 self-center">Filtrer:</span>
          {filterOptions.map(option => (
            <button
              key={option.value}
              className={`px-3 py-1 text-sm rounded-full ${
                currentFilter === option.value 
                  ? 'bg-blue-100 text-blue-800 font-medium' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
              onClick={() => setCurrentFilter(option.value as any)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des factures */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="bg-white overflow-hidden">
          {loading ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-gray-500">Chargement des factures...</p>
            </div>
          ) : invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      N°
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date d'émission
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date d'échéance
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <Link to={`/invoices/${invoice.id}`}>
                          #{invoice.number || '---'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invoice.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[invoice.status]}`}>
                          {statusLabels[invoice.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <Link
                            to={`/invoices/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Voir
                          </Link>
                          <Link
                            to={`/invoices/${invoice.id}/edit`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Modifier
                          </Link>
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id)}
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
              <p className="text-gray-500">Aucune facture à afficher.</p>
              <Link
                to="/invoices/new"
                className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Créer votre première facture
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Invoices
