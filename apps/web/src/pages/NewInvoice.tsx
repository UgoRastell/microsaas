import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

// Types nécessaires pour la gestion des factures
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'
type Customer = {
  id: string
  company: string
  email: string
}

interface InvoiceItem {
  description: string
  quantity: number
  price: number
}

const NewInvoice = () => {
  const navigate = useNavigate()
  const supabase = useSupabaseClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, price: 0 }])
  
  // État du formulaire
  const [formData, setFormData] = useState({
    customer_id: '',
    due_date: '',
    status: 'draft' as InvoiceStatus,
    notes: ''
  })
  
  // Chargement des clients
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, company, email')
          .order('company', { ascending: true })
        
        if (error) throw error
        
        setCustomers(data || [])
      } catch (error) {
        console.error('Erreur lors du chargement des clients:', error)
      }
    }
    
    fetchCustomers()
  }, [supabase])
  
  // Calcul du total de la facture
  const calculateTotal = () => {
    return items.reduce((total, item) => {
      return total + (item.quantity * item.price)
    }, 0)
  }
  
  // Gestion du formulaire
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  // Gestion des items
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items]
    
    if (field === 'quantity' || field === 'price') {
      newItems[index][field] = parseFloat(value as string) || 0
    } else {
      newItems[index][field] = value as string
    }
    
    setItems(newItems)
  }
  
  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, price: 0 }])
  }
  
  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items]
      newItems.splice(index, 1)
      setItems(newItems)
    }
  }
  
  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.customer_id) {
      alert("Veuillez sélectionner un client")
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Récupération du numéro de facture (incrément)
      const { data: maxInvoiceNumber } = await supabase
        .from('invoices')
        .select('number')
        .order('number', { ascending: false })
        .limit(1)
        .single()
      
      const nextInvoiceNumber = maxInvoiceNumber ? maxInvoiceNumber.number + 1 : 1001
      
      // Création de la facture
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert([
          {
            customer_id: formData.customer_id,
            due_date: formData.due_date || null,
            status: formData.status,
            total: calculateTotal(),
            notes: formData.notes,
            number: nextInvoiceNumber
          }
        ])
        .select()
      
      if (error) throw error
      
      if (invoice && invoice.length > 0) {
        // Création des lignes de facture
        const invoiceItems = items.map(item => ({
          invoice_id: invoice[0].id,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          amount: item.quantity * item.price
        }))
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems)
          
        if (itemsError) throw itemsError
        
        navigate('/invoices')
      }
    } catch (error) {
      console.error('Erreur lors de la création de la facture:', error)
      alert("Une erreur est survenue lors de la création de la facture")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="container mx-auto max-w-7xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
          Nouvelle facture
        </h1>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        {/* Informations générales */}
        <div className="mb-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700">
              Client *
            </label>
            <select
              id="customer_id"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="">Sélectionnez un client</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.company || customer.email}
                </option>
              ))}
            </select>
          </div>
          
          <div className="sm:col-span-3">
            <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
              Date d'échéance
            </label>
            <input
              type="date"
              name="due_date"
              id="due_date"
              value={formData.due_date}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <div className="sm:col-span-3">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Statut
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyée</option>
              <option value="paid">Payée</option>
              <option value="overdue">En retard</option>
            </select>
          </div>
        </div>
        
        {/* Articles de la facture */}
        <div className="mt-8 mb-6">
          <h2 className="text-lg font-medium text-gray-900">Articles</h2>
          <div className="mt-4 border-t border-b border-gray-200">
            <div className="flex py-3 text-sm font-medium text-gray-500">
              <div className="flex-1">Description</div>
              <div className="w-24 text-center">Quantité</div>
              <div className="w-32 text-center">Prix unitaire</div>
              <div className="w-32 text-center">Montant</div>
              <div className="w-10"></div>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="flex py-3 items-center border-t border-gray-200">
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder="Description de l'article"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="w-24 px-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="w-32 px-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="w-32 px-2 text-right font-medium">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.quantity * item.price)}
                </div>
                <div className="w-10 text-center">
                  <button 
                    type="button" 
                    onClick={() => removeItem(index)} 
                    className="text-red-500 hover:text-red-700"
                    disabled={items.length === 1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            
            <div className="py-3 border-t border-gray-200">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Ajouter un article
              </button>
            </div>
          </div>
        </div>
        
        {/* Total */}
        <div className="flex justify-end mb-6">
          <div className="w-72">
            <div className="flex justify-between py-2 text-sm font-medium">
              <span>Total HT</span>
              <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateTotal())}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-gray-200 text-base font-medium">
              <span>Total TTC</span>
              <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateTotal())}</span>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        <div className="mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          ></textarea>
        </div>
        
        {/* Boutons d'action */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Création en cours...' : 'Créer la facture'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewInvoice
