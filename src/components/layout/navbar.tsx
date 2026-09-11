import { auth } from "@/lib/auth"
import Link from "next/link"
import { Bell, Search, Plus, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export async function Navbar() {
  const session = await auth()
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User"
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 gap-4">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center min-w-0">
        <Breadcrumbs />
      </div>

      {/* Middle: Search input (hidden on small screens) */}
      <div className="hidden md:flex items-center flex-1 max-w-xs mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search documents..."
            className="pl-9 pr-8 h-9 text-xs bg-slate-50/70 border-slate-200/80 focus:bg-white focus:border-[#1A56DB] transition-all rounded-lg"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Actions (Notifications, Profile, Primary CTA) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Help Icon */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8.5 w-8.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
          title="Help & Support"
        >
          <span className="text-xs font-semibold">?</span>
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8.5 w-8.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </Button>

        <div className="h-4 w-px bg-slate-200 my-auto" />

        {/* Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8.5 w-8.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs p-0 border border-blue-200/60"
            >
              {userInitials}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold leading-none text-slate-900">{userName}</p>
                <p className="text-[11px] leading-none text-slate-500 truncate">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="cursor-pointer">
                <User className="mr-2 h-3.5 w-3.5" />
                <span>Account settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              asChild
            >
              <Link href="/api/auth/signout">
                <LogOut className="mr-2 h-3.5 w-3.5" />
                <span>Sign out</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary CTA: + Send document */}
        <Button
          asChild
          size="sm"
          className="h-8.5 px-3.5 bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs shadow-blue-500/20 whitespace-nowrap shrink-0 transition-all"
        >
          <Link href="/dashboard/send" className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Send document</span>
          </Link>
        </Button>
      </div>
    </header>
  )
}