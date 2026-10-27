import { AppShell } from '@/components/student/app-shell';

/**
 * The community is readable without an account - a question shared on
 * WhatsApp must open for whoever taps the link. Actions ask to log in.
 */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
