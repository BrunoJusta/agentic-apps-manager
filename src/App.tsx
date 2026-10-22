import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { VaultProvider } from './context/VaultContext'
import { AppsProvider } from './context/AppsContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { ErrorScreen, LoadingScreen, LoginScreen, NoAccessScreen } from './pages/Gate'
import { AppsPage } from './pages/Board'
import { FinishedPage } from './pages/FinishedPage'
import { AppDetailPage } from './pages/AppDetail'
import { AppFormPage } from './pages/AppForm'
import { RequestDetailPage } from './pages/RequestDetail'
import { VaultPage } from './pages/VaultPage'
import { UsersPage } from './pages/UsersPage'
import type { ReactNode } from 'react'

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/" replace />
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <AppsPage /> },
      { path: '/production-portfolio', element: <FinishedPage /> },
      { path: '/tabela', element: <Navigate to="/?vista=tabela" replace /> },
      { path: '/apps/nova', element: <AppFormPage /> },
      { path: '/apps/:id', element: <AppDetailPage /> },
      { path: '/apps/:id/editar', element: <AppFormPage /> },
      { path: '/apps/:id/pedidos/:reqId', element: <RequestDetailPage /> },
      { path: '/credentials-vault', element: <VaultPage /> },
      { path: '/cofre', element: <Navigate to="/credentials-vault" replace /> },
      { path: '/finalizadas', element: <Navigate to="/production-portfolio" replace /> },
      { path: '/utilizadores', element: <Navigate to="/access-control" replace /> },
      { path: '/access-control', element: <AdminOnly><UsersPage /></AdminOnly> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

function Gate() {
  const { status } = useAuth()
  if (status === 'loading') return <LoadingScreen />
  if (status === 'signed-out') return <LoginScreen />
  if (status === 'no-access') return <NoAccessScreen />
  if (status === 'error') return <ErrorScreen />
  return (
    <VaultProvider>
      <AppsProvider>
        <RouterProvider router={router} />
      </AppsProvider>
    </VaultProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}
