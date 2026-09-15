"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"


export function Breadcrumbs() {
  const pathname = usePathname()
  
  // Remove empty segments and filter out dynamic route segments
  const segments = pathname
    .split("/")
    .filter((segment) => segment && !segment.startsWith("(") && !segment.startsWith("["))

  // Map segments to readable titles
  const breadcrumbItems = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`
    const isLast = index === segments.length - 1
    
    // Format segment name
    let title = segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
    
    // Special cases
    if (segment === "dashboard") title = "Dashboard"
    if (segment === "documents") title = "Documents"
    if (segment === "templates") title = "Templates"
    if (segment === "contacts") title = "Contacts"
    if (segment === "activity") title = "Activity"
    if (segment === "settings") title = "Settings"
    if (segment === "send") title = "Send Document"
    if (segment === "editor") title = "Editor"

    return {
      title,
      href: isLast ? undefined : href, // Last item is not clickable
      isLast,
    }
  })

  // If no segments, show just home
  if (breadcrumbItems.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Home className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">Dashboard</span>
      </div>
    )
  }

  return (
    <nav className="flex items-center gap-2" aria-label="Breadcrumb">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-gray-300" />
          {item.isLast ? (
            <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
              {item.title}
            </span>
          ) : (
            <Link
              href={item.href!}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors truncate max-w-[150px]"
            >
              {item.title}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}