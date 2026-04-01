"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LogOut, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  actions?: React.ReactNode;
}

export function AppHeader({ actions }: AppHeaderProps) {
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const isInventory = pathname === "/inventory";
  const isMcpAccess = pathname === "/settings/mcp-access";

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4 lg:gap-6">
            <Link href="/dashboard">
              <Image
                src="/brand/betterpatchtool-logo-a-light.svg"
                alt="BetterPatchTool"
                width={210}
                height={48}
                priority
                className="h-auto w-[150px] dark:hidden sm:w-[180px] lg:w-[210px]"
              />
              <Image
                src="/brand/betterpatchtool-logo-a-dark.svg"
                alt="BetterPatchTool"
                width={210}
                height={48}
                priority
                className="hidden h-auto w-[150px] dark:block sm:w-[180px] lg:w-[210px]"
              />
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              <Button variant="ghost" size="sm" asChild className={cn(isDashboard && "bg-muted")}>
                <Link href="/dashboard">Projects</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className={cn(isInventory && "bg-muted")}>
                <Link href="/inventory">Inventory</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className={cn(isMcpAccess && "bg-muted")}>
                <Link href="/settings/mcp-access">MCP Access</Link>
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-2 lg:flex">{actions}</div>
            <ThemeSwitcher buttonClassName="h-10 w-10 sm:h-9 sm:w-9" />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-9 sm:w-9"
              onClick={() => void signOut()}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 lg:hidden"
                  title="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm px-4">
                <SheetHeader className="pt-3 text-left">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  <SheetClose asChild>
                    <Button variant={isDashboard ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                      <Link href="/dashboard">Projects</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant={isInventory ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                      <Link href="/inventory">Inventory</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant={isMcpAccess ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                      <Link href="/settings/mcp-access">MCP Access</Link>
                    </Button>
                  </SheetClose>
                </div>
                {actions && <div className="mt-6 border-t pt-4">{actions}</div>}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
