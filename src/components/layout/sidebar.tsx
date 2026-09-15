"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  FileText,
  Copy,
  Users,
  Layers,
  Activity,
  BarChart2,
  Settings,
  FileSignature,
  LogOut,
  Menu,
  ChevronDown,
  HelpCircle,
  Sparkles,
  Building2,
  User as UserIcon,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, getInitials } from "@/lib/utils"

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: string
}

const mainNavItems: NavItem[] = [
  { label: "Home", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Documents", icon: FileText, href: "/dashboard/documents" },
  { label: "Templates", icon: Copy, href: "/dashboard/templates" },
  { label: "Public Forms", icon: Globe, href: "/dashboard/public-forms" },
  { label: "Bulk Send", icon: Layers, href: "/dashboard/bulk-send" },
  { label: "Contacts", icon: Users, href: "/dashboard/contacts" },
]

const workspaceNavItems: NavItem[] = [
  { label: "Activity", icon: Activity, href: "/dashboard/activity" },
  { label: "Reports", icon: BarChart2, href: "/dashboard/reports" },
]

const bottomNavItems: NavItem[] = [
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
]

export interface SidebarProps {
  className?: string
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function Sidebar({ className, user }: SidebarProps) {
  const pathname = usePathname()

  const userName = user?.name || "User"
  const userEmail = user?.email || "user@esign.com"
  const userInitials = getInitials(userName)

  const isNavActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/"
    }
    return pathname === href || pathname?.startsWith(`${href}/`)
  }

  const renderNavGroup = (items: NavItem[]) => (
    <div className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon
        const active = isNavActive(item.href)

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "group relative flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ease-in-out",
              active
                ? "bg-[#EFF6FF] text-[#1A56DB] font-semibold"
                : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-[#1A56DB]" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span className="truncate">{item.label}</span>
            </div>
            {item.badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {item.badge}
              </span>
            )}
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#1A56DB] rounded-r-full" />
            )}
          </Link>
        )
      })}
    </div>
  )

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-800 border-r border-slate-200/80">
      {/* Brand Header & Workspace Selector */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5 px-2 py-1 mb-3">
          <div className="h-8 w-8 rounded-lg bg-[#1A56DB] flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
            <FileSignature className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-slate-900 leading-tight tracking-tight">
              ESign
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Agreement Platform</span>
          </div>
        </div>

        {/* Workspace Dropdown */}
        <button className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate leading-tight">
                Personal Workspace
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-400 font-medium">Free Plan</span>
              </div>
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
        </button>
      </div>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-thin">
        {/* MAIN */}
        <div>
          <p className="px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
            Main
          </p>
          {renderNavGroup(mainNavItems)}
        </div>

        {/* WORKSPACE */}
        <div>
          <p className="px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
            Workspace
          </p>
          {renderNavGroup(workspaceNavItems)}
        </div>

        {/* Usage Card */}
        <div className="mx-1 p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#1A56DB]" /> Usage
            </span>
            <span className="text-[11px] font-medium text-slate-500">3 / 10 docs</span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#1A56DB] rounded-full w-[30%]" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs font-semibold text-[#1A56DB] border-blue-200 hover:bg-blue-50/80 hover:text-blue-700 bg-white"
          >
            Upgrade Plan
          </Button>
        </div>
      </div>

      {/* Bottom Area */}
      <div className="p-3 border-t border-slate-100 space-y-1">
        {renderNavGroup(bottomNavItems)}

        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 rounded-lg transition-colors">
          <HelpCircle className="h-4 w-4 text-slate-400" />
          <span>Help & Support</span>
        </button>

        {/* User Profile */}
        <div className="pt-2 mt-1 border-t border-slate-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100/80 transition-colors text-left group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-[#1A56DB]/10 text-[#1A56DB] font-semibold text-xs flex items-center justify-center shrink-0 border border-blue-200/50">
                    {userInitials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-900 truncate leading-snug">
                      {userName}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate leading-none">
                      {userEmail}
                    </span>
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" side="right" sideOffset={10}>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 cursor-pointer"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn("hidden lg:block w-[240px] h-screen shrink-0 sticky top-0", className)}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed top-3 left-3 z-40 h-9 w-9 bg-white border border-slate-200 shadow-sm"
          >
            <Menu className="h-5 w-5 text-slate-700" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0 border-r border-slate-200">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  )
}