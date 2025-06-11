import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'

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

interface Customer {
  id: string
  email: string
  company: string
}

interface InvoiceStats {
  total: number
  paid: number
  overdue: number
  pending: number
}

const Dashboard = () => {
  const supabase = useSupabaseClient()
  const user = useUser()
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats>({
    total: 0,
    paid: 0,
    overdue: 0,
    pending: 0
  })
  const [loading, setLoading] = useState(true)

  // Fonction pour charger les factures récentes
  const loadRecentInvoices = async () => {
    try {
      // Dans un vrai scénario, nous aurions déjà une table organizations 
      // et nous filtrerions par organization_id
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*, customers(company, email)')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error

      // Format des données pour l'affichage
      const formattedInvoices = invoices.map((invoice: any) => ({
        ...invoice,
        customer_name: invoice.customers?.company || invoice.customers?.email || 'Client inconnu'
      }))

      setRecentInvoices(formattedInvoices)
      
      // Calculer les statistiques
      if (invoices) {
        const { data: allInvoices, error: statsError } = await supabase
          .from('invoices')
          .select('status, total')

        if (statsError) throw statsError

        const stats = {
          total: allInvoices.length,
          paid: allInvoices.filter(inv => inv.status === 'paid').length,
          overdue: allInvoices.filter(inv => inv.status === 'overdue').length,
          pending: allInvoices.filter(inv => inv.status === 'sent').length
        }

        setStats(stats)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadRecentInvoices()
    }
  }, [user])

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

  return (
    <div className="container mx-auto max-w-7xl">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
            Tableau de bord
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total des factures</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {loading ? '...' : stats.total}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Payées</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">
              {loading ? '...' : stats.paid}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">En attente</dt>
            <dd className="mt-1 text-3xl font-semibold text-blue-600">
              {loading ? '...' : stats.pending}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">En retard</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">
              {loading ? '...' : stats.overdue}
            </dd>
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            Factures récentes
          </h2>
          <Link to="/invoices" className="text-blue-600 hover:text-blue-800 text-sm">
            Voir toutes les factures
          </Link>
        </div>
        <div className="bg-white overflow-hidden">
          {loading ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-gray-500">Chargement des factures...</p>
            </div>
          ) : recentInvoices.length > 0 ? (
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
                      Montant
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentInvoices.map((invoice) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[invoice.status]}`}>
                          {statusLabels[invoice.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500">Aucune facture récente à afficher.</p>
              <Link to="/invoices/new" className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                Créer votre première facture
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
