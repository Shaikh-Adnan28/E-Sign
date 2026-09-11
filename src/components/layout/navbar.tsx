"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { Search, Bell, Plus, HelpCircle, User as UserIcon, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "./breadcrumbs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials } from "@/lib/utils"

export interface NavbarProps {
  title?: string
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function Navbar({ user }: NavbarProps) {
  const userName = user?.name || "User"
  const userEmail = user?.email || "user@esign.com"
  const userInitials = getInitials(userName)

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-6">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-4">
        <Breadcrumbs />
      </div>

      {/* Center: Command-style Search Bar */}
      <div className="hidden md:flex flex-1 max-w-sm mx-6">
        <div className="relative w-full flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search documents..."
            className="w-full h-8 pl-9 pr-12 text-xs bg-slate-100/80 border border-slate-200/80 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] focus:bg-white transition-all"
          />
          <div className="absolute right-2.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-semibold text-slate-400 shadow-2xs">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right: Notification, Help & CTA */}
      <div className="flex items-center gap-2.5">
        {/* Help Icon */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100/80"
          title="Help & Documentation"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100/80"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#1A56DB] ring-2 ring-white" />
        </Button>

        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 rounded-full p-0 bg-[#1A56DB]/10 text-[#1A56DB] hover:bg-[#1A56DB]/20 border border-blue-200/60"
            >
              <span className="text-xs font-bold">{userInitials}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none text-slate-900">{userName}</p>
                <p className="text-[11px] leading-none text-slate-500 truncate">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="cursor-pointer text-xs">
                <UserIcon className="mr-2 h-3.5 w-3.5" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="cursor-pointer text-xs">
                <Settings className="mr-2 h-3.5 w-3.5" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 cursor-pointer text-xs"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary CTA: + Send document */}
        <Button
          asChild
          size="sm"
          className="h-8 bg-[#1A56DB] hover:bg-[#1A56DB]/90 text-white font-medium text-xs shadow-sm shadow-blue-500/20 px-3 transition-all"
        >
          <Link href="/dashboard/send">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>Send document</span>
          </Link>
        </Button>
      </div>
    </header>
  )
}