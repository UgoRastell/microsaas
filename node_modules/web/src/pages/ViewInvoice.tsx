import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

// Helper function for date formatting
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR')
}

// Types
interface Customer {
  id: string
  email: string
  company: string | null
  vat: string | null
}

interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  price: number
  amount: number
}

interface Invoice {
  id: string
  number: number
  customer_id: string
  customer: Customer
  total: number
  status: string
  due_date: string
  notes: string | null
  created_at: string
  items: InvoiceItem[]
}

const ViewInvoice = () => {
  const { id } = useParams<{ id: string }>()
  const supabase = useSupabaseClient()
  const navigate = useNavigate()
  
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch invoice with customer info
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select(`
            *,
            customer:customer_id (
              id, email, company, vat
            )
          `)
          .eq('id', id)
          .single()

        if (invoiceError) throw invoiceError
        
        if (!invoiceData) {
          throw new Error('Facture non trouvée')
        }

        // Fetch invoice items
        const { data: itemsData, error: itemsError } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', id)
          .order('created_at', { ascending: true })

        if (itemsError) throw itemsError

        // Combine invoice with its items
        setInvoice({
          ...invoiceData,
          items: itemsData || []
        })
      } catch (err: any) {
        console.error('Erreur lors du chargement de la facture:', err)
        setError(err.message || 'Erreur lors du chargement de la facture')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadInvoice()
    }
  }, [id, supabase])

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      return
    }

    try {
      setLoading(true)
      
      // Delete invoice items first due to foreign key constraint
      const { error: itemsDeleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id)

      if (itemsDeleteError) throw itemsDeleteError

      // Then delete the invoice
      const { error: invoiceDeleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)

      if (invoiceDeleteError) throw invoiceDeleteError

      // Navigate back to invoices list
      navigate('/invoices')
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err)
      alert('Erreur lors de la suppression: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'payée':
      case 'payé':
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'en attente':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'annulée':
      case 'annulé':
      case 'canceled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-3 text-gray-500">Chargement de la facture...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error || 'Facture non trouvée'}</p>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Link to="/invoices" className="btn btn-outline">
            Retour aux factures
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Header with buttons */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Facture #{invoice.number}</h1>
        <div className="flex space-x-3">
          <Link to={`/invoices/${id}/edit`} className="btn btn-primary">
            Modifier
          </Link>
          <button 
            onClick={handleDelete}
            className="btn btn-danger"
            disabled={loading}
          >
            Supprimer
          </button>
          <Link to="/invoices" className="btn btn-outline">
            Retour
          </Link>
        </div>
      </div>

      {/* Invoice details */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header info */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Client</h2>
              <p className="mt-2 text-gray-700">{invoice.customer?.email}</p>
              {invoice.customer?.company && (
                <p className="text-gray-700">{invoice.customer.company}</p>
              )}
              {invoice.customer?.vat && (
                <p className="text-gray-700">TVA: {invoice.customer.vat}</p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-lg font-medium text-gray-900">Détails</h2>
              <p className="mt-2 text-gray-700">
                Date de création: {formatDate(invoice.created_at)}
              </p>
              {invoice.due_date && (
                <p className="text-gray-700">
                  Date d'échéance: {formatDate(invoice.due_date)}
                </p>
              )}
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Articles</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantité
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix unitaire
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {item.price.toFixed(2)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {item.amount.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  Total
                </th>
                <th className="px-6 py-4 text-right text-base font-bold text-gray-900">
                  {invoice.total.toFixed(2)} €
                </th>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="p-6 border-t">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewInvoice
