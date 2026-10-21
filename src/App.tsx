import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { VaultProvider } from './context/VaultContext'
import { AppsProvider } from './context/AppsContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { ErrorScreen, LoadingScreen, LoginScreen, NoAccessScreen } from './pages/Gate'
import { BoardPage } from './pages/Board'
import { TablePage } from './pages/TablePage'
import { AppDetailPage } from './pages/AppDetail'
import { AppFormPage } from './pages/AppForm'
import { VaultPage } from './pages/VaultPage'
import { UsersPage } from './pages/UsersPage'
import { AuditPage } from './pages/AuditPage'
import type { ReactNode } from 'react'

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/" replace />
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <BoardPage /> },
      { path: '/tabela', element: <TablePage /> },
      { path: '/apps/nova', element: <AppFormPage /> },
      { path: '/apps/:id', element: <AppDetailPage /> },
      { path: '/apps/:id/editar', element: <AppFormPage /> },
      { path: '/cofre', element: <VaultPage /> },
      { path: '/utilizadores', element: <AdminOnly><UsersPage /></AdminOnly> },
      { path: '/auditoria', element: <AdminOnly><AuditPage /></AdminOnly> },
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
