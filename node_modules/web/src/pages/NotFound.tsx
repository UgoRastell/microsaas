import { Link } from 'react-router-dom'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-blue-600">AutoInvoice</h1>
        <div className="text-center mt-6">
          <h2 className="text-5xl font-bold text-gray-900">404</h2>
          <p className="mt-2 text-2xl font-medium text-gray-600">Page non trouvée</p>
          <p className="mt-3 text-base text-gray-500">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Retourner à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotFound
