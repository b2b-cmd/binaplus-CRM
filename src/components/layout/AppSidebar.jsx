import { NavLink, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar'
import { Avatar, AvatarFallback } from '../ui/avatar'
import Icon from '../Icon'
import Logo from '../Logo'
import { NAV_GROUPS, USER_TYPE_LABEL } from './nav-data'
import { usePermissionStore } from '../../stores/permissionStore'

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?'

/* App sidebar on the template's Sidebar primitive: collapsible, with a real
   mobile drawer and keyboard shortcut, instead of the hand-rolled <aside>.
   side="right" because the app is RTL. */
export default function AppSidebar() {
  const { user, rep, signOut, isManager } = useAuthStore()
  const { isMobile, setOpenMobile } = useSidebar()
  const can = usePermissionStore(s => s.can)
  const loc = useLocation()
  const manager = isManager()
  const name = rep?.full_name || user?.email

  const isActive = (item) =>
    item.end ? loc.pathname === item.path : loc.pathname === item.path || loc.pathname.startsWith(item.path + '/')

  const close = () => { if (isMobile) setOpenMobile(false) }

  return (
    <Sidebar side="left" collapsible="icon">
      <SidebarHeader className="h-16 justify-center px-4">
        <Logo size={1.45} light />
        <span className="text-sidebar-foreground/60 truncate text-xs group-data-[collapsible=icon]:hidden">
          ניהול פניות ולידים
        </span>
      </SidebarHeader>

      <SidebarContent>
        {/* A group disappears entirely once every item in it is hidden, so a
            sales rep does not see an empty "ידע" heading. `guide` has no
            permission row - it is help text everyone may read. */}
        {NAV_GROUPS
          .filter(g => !g.managerOnly || manager)
          .map(g => ({ ...g, items: g.items.filter(i => !i.resource || i.resource === 'guide' || can(i.resource, 'view')) }))
          .filter(g => g.items.length)
          .map((group, i) => (
          <SidebarGroup key={group.title ?? i}>
            {group.title && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                      <NavLink to={item.path} end={item.end} onClick={close}>
                        <Icon name={item.icon} size={17} />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground rounded-lg text-xs font-semibold">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start leading-tight">
                <span className="truncate text-sm font-medium">{name}</span>
                <span className="text-sidebar-foreground/60 truncate text-xs">
                  {USER_TYPE_LABEL[rep?.user_type] || ''}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="התנתקות">
              <LogOut className="size-4" />
              <span>התנתקות</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
