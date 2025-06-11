import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useForm, useFieldArray } from 'react-hook-form'

// Types
interface Customer {
  id: string
  email: string
  company: string | null
  vat: string | null
}

interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  price: number
  amount: number
}

interface InvoiceFormData {
  customer_id: string
  due_date: string
  status: string
  notes: string
  items: InvoiceItem[]
}

const EditInvoice = () => {
  const { id } = useParams<{ id: string }>()
  const supabase = useSupabaseClient()
  const navigate = useNavigate()
  
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState<number | null>(null)
  
  // React Hook Form
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<InvoiceFormData>({
    defaultValues: {
      items: [{ description: '', quantity: 1, price: 0, amount: 0 }]
    }
  })
  
  // Field array for invoice items
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  })

  // Watch items to calculate totals
  const watchItems = watch('items')
  
  // Calculate amount for each item and total
  useEffect(() => {
    if (watchItems) {
      let total = 0
      
      watchItems.forEach((item, index) => {
        const quantity = parseFloat(item.quantity.toString()) || 0
        const price = parseFloat(item.price.toString()) || 0
        const amount = quantity * price
        
        // Update amount in form
        setValue(`items.${index}.amount`, amount)
        
        total += amount
      })
    }
  }, [watchItems, setValue])

  // Load invoice data and customers
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load customers
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .order('email')
        
        if (customersError) throw customersError
        setCustomers(customersData || [])
        
        // Load invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', id)
          .single()
        
        if (invoiceError) throw invoiceError
        
        if (!invoice) {
          throw new Error('Facture non trouvée')
        }
        
        // Load invoice items
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', id)
          .order('created_at', { ascending: true })
        
        if (itemsError) throw itemsError
        
        // Set form values
        setInvoiceNumber(invoice.number)
        setValue('customer_id', invoice.customer_id)
        setValue('status', invoice.status)
        setValue('notes', invoice.notes || '')
        
        if (invoice.due_date) {
          // Format date as YYYY-MM-DD for input[type="date"]
          setValue('due_date', new Date(invoice.due_date).toISOString().split('T')[0])
        }
        
        // Set items or use default empty one
        if (items && items.length > 0) {
          setValue('items', items)
        }
        
      } catch (error: any) {
        console.error('Erreur lors du chargement:', error)
        alert('Erreur lors du chargement: ' + error.message)
        navigate('/invoices')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [id, supabase, setValue, navigate])
  
  const onSubmit = async (data: InvoiceFormData) => {
    try {
      setSubmitting(true)
      
      // Calculate total
      let total = 0
      data.items.forEach(item => {
        total += parseFloat(item.amount.toString() || '0')
      })
      
      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          customer_id: data.customer_id,
          status: data.status,
          due_date: data.due_date || null,
          notes: data.notes || null,
          total
        })
        .eq('id', id)
      
      if (invoiceError) throw invoiceError
      
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id)
      
      if (deleteError) throw deleteError
      
      // Insert new items
      const itemsToInsert = data.items.map(item => ({
        invoice_id: id,
        description: item.description,
        quantity: parseFloat(item.quantity.toString() || '1'),
        price: parseFloat(item.price.toString() || '0'),
        amount: parseFloat(item.amount.toString() || '0')
      }))
      
      const { error: insertError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)
      
      if (insertError) throw insertError
      
      // Navigate to view invoice page
      navigate(`/invoices/${id}`)
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error)
      alert('Erreur lors de la mise à jour: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }
  
  const addItem = () => {
    append({ description: '', quantity: 1, price: 0, amount: 0 })
  }
  
  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-3 text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">
          Modifier la facture #{invoiceNumber}
        </h1>
        <button
          onClick={() => navigate(`/invoices/${id}`)}
          className="btn btn-outline"
        >
          Annuler
        </button>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer selection */}
              <div>
                <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Client*
                </label>
                <select
                  id="customer_id"
                  className="form-select"
                  {...register('customer_id', { required: 'Le client est requis' })}
                >
                  <option value="">Sélectionnez un client</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.email} {customer.company ? `(${customer.company})` : ''}
                    </option>
                  ))}
                </select>
                {errors.customer_id && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.customer_id.message}
                  </p>
                )}
              </div>
              
              {/* Due date */}
              <div>
                <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date d'échéance
                </label>
                <input
                  type="date"
                  id="due_date"
                  className="form-input"
                  {...register('due_date')}
                />
              </div>
              
              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Statut*
                </label>
                <select
                  id="status"
                  className="form-select"
                  {...register('status', { required: 'Le statut est requis' })}
                >
                  <option value="En attente">En attente</option>
                  <option value="Payée">Payée</option>
                  <option value="Annulée">Annulée</option>
                </select>
                {errors.status && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.status.message}
                  </p>
                )}
              </div>
              
              {/* Notes */}
              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  className="form-textarea"
                  {...register('notes')}
                ></textarea>
              </div>
            </div>
          </div>
          
          {/* Invoice items */}
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Articles</h2>
            
            <div className="mb-4">
              <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-700">
                <div className="col-span-6">Description</div>
                <div className="col-span-2">Quantité</div>
                <div className="col-span-2">Prix unitaire (€)</div>
                <div className="col-span-2">Montant (€)</div>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <div className="col-span-6">
                    <input
                      type="text"
                      className="form-input"
                      {...register(`items.${index}.description` as const, {
                        required: 'Description requise'
                      })}
                    />
                    {errors.items?.[index]?.description && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      {...register(`items.${index}.quantity` as const, {
                        required: 'Requis',
                        valueAsNumber: true,
                        min: { value: 0.01, message: '> 0' }
                      })}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      {...register(`items.${index}.price` as const, {
                        required: 'Requis',
                        valueAsNumber: true,
                        min: { value: 0, message: '>= 0' }
                      })}
                    />
                  </div>
                  
                  <div className="col-span-1">
                    <input
                      type="number"
                      step="0.01"
                      className="form-input bg-gray-100"
                      readOnly
                      {...register(`items.${index}.amount` as const)}
                    />
                  </div>
                  
                  <div className="col-span-1 text-center">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addItem}
                className="mt-4 flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un article
              </button>
            </div>
            
            {/* Total */}
            <div className="mt-6 text-right">
              <div className="text-lg font-bold">
                Total: {watchItems.reduce((sum, item) => sum + (parseFloat(item.amount?.toString() || '0') || 0), 0).toFixed(2)} €
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-gray-50 border-t text-right">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditInvoice
