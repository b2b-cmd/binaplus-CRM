import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import AppLayout from './components/layout/AppLayout'
import Logo from './components/Logo'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Tickets from './pages/Tickets'
import TicketDetail from './pages/TicketDetail'
import People from './pages/People'
import PersonDetail from './pages/PersonDetail'
import Opportunities from './pages/Opportunities'
import OpportunityDetail from './pages/OpportunityDetail'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Payments from './pages/Payments'
import PaymentDetail from './pages/PaymentDetail'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cycles from './pages/Cycles'
import Lessons from './pages/Lessons'
import Modules from './pages/Modules'
import ModuleDetail from './pages/ModuleDetail'
import LessonDetail from './pages/LessonDetail'
import CycleDetail from './pages/CycleDetail'
import Attendance from './pages/Attendance'
import Knowledge from './pages/Knowledge'
import Tasks from './pages/Tasks'
import Reps from './pages/Reps'
import RepDetail from './pages/RepDetail'
import Duplicates from './pages/Duplicates'
import Guide from './pages/Guide'
import Settings from './pages/Settings'
import PermissionsPage from './pages/Permissions'
import { CoreAdminContext } from 'ra-core'
import RequirePermission from './components/RequirePermission'
import { usePermissionStore } from './stores/permissionStore'
import { dataProvider, authProvider, i18nProvider, raStore } from './lib/ra/providers'
import ApiDocsPage from './pages/ApiDocsPage'

function Loading() {
  return (
    <div className="center-screen">
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 18 }}><Logo size={2.4} light /></div>
        <div className="spinner light" />
      </div>
    </div>
  )
}

export default function App() {
  const { user, rep, loading, initialize, isAdmin } = useAuthStore()
  const loadPermissions = usePermissionStore(s => s.loadFor)
  const setAdmin = usePermissionStore(s => s.setAdmin)
  const impersonating = usePermissionStore(s => s.impersonating)

  useEffect(() => { initialize() }, [])

  // Permissions follow the signed-in rep, unless a manager is viewing as
  // someone else - then the impersonation store already holds their rows.
  useEffect(() => {
    setAdmin(isAdmin())
    if (rep && !impersonating) loadPermissions(rep)
  }, [rep?.id, impersonating?.id])

  if (loading) return <Loading />
  if (!user) return (
    <HashRouter>
      <Routes><Route path="*" element={<LoginPage />} /></Routes>
    </HashRouter>
  )

  return (
    <HashRouter>
      {/* ra-core context only: our router, layout and authStore stay in charge.
          This is what lets components/admin (DataTable, filters, saved queries,
          inputs) work inside our own pages during the incremental migration. */}
      <CoreAdminContext
        dataProvider={dataProvider}
        authProvider={authProvider}
        i18nProvider={i18nProvider}
        store={raStore}
      >
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<RequirePermission resource="dashboard"><Dashboard /></RequirePermission>} />
          <Route path="tickets" element={<RequirePermission resource="tickets"><Tickets /></RequirePermission>} />
          <Route path="tickets/:id" element={<RequirePermission resource="tickets"><TicketDetail /></RequirePermission>} />
          <Route path="people" element={<RequirePermission resource="people"><People /></RequirePermission>} />
          <Route path="people/:id" element={<RequirePermission resource="people"><PersonDetail /></RequirePermission>} />
          <Route path="opportunities" element={<RequirePermission resource="opportunities"><Opportunities /></RequirePermission>} />
          <Route path="opportunities/:id" element={<RequirePermission resource="opportunities"><OpportunityDetail /></RequirePermission>} />
          <Route path="orders" element={<RequirePermission resource="orders"><Orders /></RequirePermission>} />
          <Route path="orders/:id" element={<RequirePermission resource="orders"><OrderDetail /></RequirePermission>} />
          <Route path="payments" element={<RequirePermission resource="payments"><Payments /></RequirePermission>} />
          <Route path="payments/:id" element={<RequirePermission resource="payments"><PaymentDetail /></RequirePermission>} />
          <Route path="products" element={<RequirePermission resource="products"><Products /></RequirePermission>} />
          <Route path="products/:id" element={<RequirePermission resource="products"><ProductDetail /></RequirePermission>} />
          <Route path="cycles" element={<RequirePermission resource="cycles"><Cycles /></RequirePermission>} />
          <Route path="cycles/:id" element={<RequirePermission resource="cycles"><CycleDetail /></RequirePermission>} />
          <Route path="lessons" element={<RequirePermission resource="lessons"><Lessons /></RequirePermission>} />
          <Route path="modules" element={<RequirePermission resource="lessons"><Modules /></RequirePermission>} />
          <Route path="modules/:id" element={<RequirePermission resource="lessons"><ModuleDetail /></RequirePermission>} />
          <Route path="lessons/:id" element={<RequirePermission resource="lessons"><LessonDetail /></RequirePermission>} />
          <Route path="attendance" element={<RequirePermission resource="attendance"><Attendance /></RequirePermission>} />
          <Route path="knowledge" element={<RequirePermission resource="knowledge_base"><Knowledge /></RequirePermission>} />
          <Route path="guide" element={<Guide />} />
          <Route path="tasks" element={<RequirePermission resource="tasks"><Tasks /></RequirePermission>} />
          <Route path="reps" element={<RequirePermission resource="users"><Reps /></RequirePermission>} />
          <Route path="permissions" element={<RequirePermission resource="users"><PermissionsPage /></RequirePermission>} />
          <Route path="reps/:id" element={<RequirePermission resource="users"><RepDetail /></RequirePermission>} />
          <Route path="duplicates" element={<RequirePermission resource="users"><Duplicates /></RequirePermission>} />
          <Route path="settings" element={<RequirePermission resource="settings"><Settings /></RequirePermission>} />
          <Route path="api-docs" element={<RequirePermission resource="settings"><ApiDocsPage /></RequirePermission>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
      </CoreAdminContext>
    </HashRouter>
  )
}
