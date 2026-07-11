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
  const { user, loading, initialize } = useAuthStore()
  useEffect(() => { initialize() }, [])

  if (loading) return <Loading />
  if (!user) return (
    <HashRouter>
      <Routes><Route path="*" element={<LoginPage />} /></Routes>
    </HashRouter>
  )

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="people" element={<People />} />
          <Route path="people/:id" element={<PersonDetail />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="opportunities/:id" element={<OpportunityDetail />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="payments" element={<Payments />} />
          <Route path="payments/:id" element={<PaymentDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="cycles" element={<Cycles />} />
          <Route path="cycles/:id" element={<CycleDetail />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="modules" element={<Modules />} />
          <Route path="modules/:id" element={<ModuleDetail />} />
          <Route path="lessons/:id" element={<LessonDetail />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="guide" element={<Guide />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="reps" element={<Reps />} />
          <Route path="reps/:id" element={<RepDetail />} />
          <Route path="duplicates" element={<Duplicates />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
