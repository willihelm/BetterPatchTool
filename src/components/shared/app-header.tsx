"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { LogOut } from "lucide-react";
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

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard">
            <Image
              src="/brand/betterpatchtool-logo-a-light.svg"
              alt="BetterPatchTool"
              width={210}
              height={48}
              priority
              className="dark:hidden"
            />
            <Image
              src="/brand/betterpatchtool-logo-a-dark.svg"
              alt="BetterPatchTool"
              width={210}
              height={48}
              priority
              className="hidden dark:block"
            />
          </Link>
          <nav className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(pathname === "/dashboard" && "bg-muted")}
            >
              <Link href="/dashboard">Projects</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(pathname === "/inventory" && "bg-muted")}
            >
              <Link href="/inventory">Inventory</Link>
            </Button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {actions}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void signOut()}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
