import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and subscription</p>
      </div>
      
      <Tabs defaultValue="billing" className="w-full">
        <TabsList className="w-full justify-start mb-8">
          <Link href="/app/settings/billing">
            <TabsTrigger value="billing">Billing & Subscription</TabsTrigger>
          </Link>
          <Link href="/app/settings/profile">
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </Link>
          <Link href="/app/settings/api">
            <TabsTrigger value="api">API Keys</TabsTrigger>
          </Link>
        </TabsList>
        
        <div className="mt-6">
          {children}
        </div>
      </Tabs>
    </div>
  );
}