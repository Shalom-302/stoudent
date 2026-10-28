'use client';

import {
  Award,
  Boxes,
  FlaskConical,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Shield,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Logo } from '@/components/brand/logo';
import { NotificationBell } from '@/components/community/notification-bell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';
import { useIsAdmin } from '@/features/auth/use-admin';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  authOnly?: boolean;
  /** Other paths that light this tab up (the Lab tab owns the whole lab area). */
  also?: string[];
}

/** The virtual lab lives under one tab; its own pages get a secondary bar. */
const LAB_NAV: NavItem[] = [
  { href: '/dashboard', label: 'MyLab', icon: LayoutDashboard },
  { href: '/world', label: 'Monde 3D', icon: Boxes },
  { href: '/labs', label: 'Laboratoires', icon: FlaskConical },
  { href: '/progress', label: 'Progression', icon: TrendingUp },
  { href: '/achievements', label: 'Badges', icon: Award },
];

const NAV: NavItem[] = [
  { href: '/questions', label: 'Questions', icon: MessageCircleQuestion },
  { href: '/bibliotheque', label: 'Bibliothèque', icon: Library },
  {
    href: '/dashboard',
    label: 'Lab',
    icon: FlaskConical,
    authOnly: true,
    also: LAB_NAV.map((item) => item.href),
  },
  { href: '/profile', label: 'Profil', icon: User, authOnly: true },
  { href: '/signmanager', label: 'SignManager', icon: Shield, adminOnly: true },
];

/**
 * Persistent chrome for STOUDENT: community tabs, plus the "Lab" tab
 * whose pages get their own secondary bar. Also renders for visitors, who can
 * read questions and resources before signing up.
 *
 * Above `lg` the destinations sit inline. Below it they move into a sheet that
 * opens from the right - a horizontally scrolling row of seven items is not
 * navigation, it is a hiding place.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = React.useState(false);

  const items = NAV.filter((item) => (!item.adminOnly || isAdmin) && (!item.authOnly || user));

  // Any navigation closes the sheet; leaving it open over the new page is the
  // classic mobile-menu bug.
  React.useEffect(() => setOpen(false), [pathname]);

  // While the sheet is open it owns the viewport: no scrolling underneath,
  // and Escape closes it.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isActive = (href: string) => {
    const item = NAV.find((entry) => entry.href === href);
    return [href, ...(item?.also ?? [])].some(matches);
  };
  const inLab = LAB_NAV.some((item) => matches(item.href));
  const displayName = user?.pseudo ?? user?.email ?? user?.phone ?? '';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href={user ? '/questions' : '/'} className="shrink-0" aria-label="STOUDENT">
            <Logo />
          </Link>

          <nav aria-label="Navigation principale" className="hidden min-w-0 flex-1 lg:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
                      isActive(item.href)
                        ? 'bg-ink-900 text-white'
                        : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                      item.adminOnly && !isActive(item.href) && 'text-accent-600',
                    )}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user && <NotificationBell />}
            {user ? (
              <>
                <span className="hidden max-w-[18ch] truncate text-xs text-ink-500 xl:inline">
                  {displayName}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void logout()}
                  aria-label="Se déconnecter"
                  className="hidden lg:inline-flex"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Connexion</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Rejoindre</Link>
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Ouvrir le menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col border-l border-ink-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-900">
                Menu
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                        isActive(item.href)
                          ? 'bg-ink-900 text-white'
                          : 'text-ink-700 hover:bg-ink-50',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                      {item.adminOnly && (
                        <span
                          className={cn(
                            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
                            isActive(item.href)
                              ? 'bg-white/15 text-white'
                              : 'bg-accent-100 text-accent-600',
                          )}
                        >
                          admin
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-ink-100 p-3">
              {user ? (
                <>
                  <p className="mb-2 truncate px-1 text-xs text-ink-500">{displayName}</p>
                  <Button variant="outline" className="w-full" onClick={() => void logout()}>
                    <LogOut className="h-4 w-4" />
                    Se déconnecter
                  </Button>
                </>
              ) : (
                <div className="grid gap-2">
                  <Button asChild>
                    <Link href="/register">Rejoindre STOUDENT</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/login">Connexion</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {inLab && (
        <nav aria-label="Navigation du labo" className="border-b border-ink-200 bg-ink-50">
          <ul className="mx-auto flex w-full max-w-[1400px] gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {LAB_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={matches(item.href) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    matches(item.href)
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-600 hover:bg-white hover:text-ink-900',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex-1">{children}</div>
    </div>
  );
}
