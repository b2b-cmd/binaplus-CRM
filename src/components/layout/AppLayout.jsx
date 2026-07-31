import { Outlet, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '../ui/sidebar'
import { Separator } from '../ui/separator'
import AppSidebar from './AppSidebar'
import ThemeToggle from './ThemeToggle'
import GlobalSearch from '../GlobalSearch'
import Notifications from '../Notifications'
import Toaster from '../Toaster'
import { titleForPath } from './nav-data'

/* App shell on the template's Sidebar/Inset primitives.

   Replaces the hand-rolled .app/.sidebar/.main/.topbar markup: this version
   collapses to icons, has a real mobile drawer, a keyboard shortcut, and a
   sticky header - none of which the previous shell had. */
export default function AppLayout() {
  const loc = useLocation()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-1 h-5" />
          <h1 className="truncate text-lg font-bold">{titleForPath(loc.pathname)}</h1>
          <div className="ms-auto flex items-center gap-2">
            <GlobalSearch />
            <Notifications />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 pb-16 md:p-6">
          <Outlet />
        </main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  )
}
