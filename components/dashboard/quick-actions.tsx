'use client';

import { Card } from '@/components/ui/card';
import { 
  Upload, 
  History, 
  CreditCard, 
  LinkIcon
} from 'lucide-react';
import Link from 'next/link';

const actions = [
  {
    title: 'Upload Document',
    description: 'Start enhancing a new document',
    icon: Upload,
    href: '/upload',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  {
    title: 'Import from Canva',
    description: 'Import designs directly from Canva',
    icon: LinkIcon,
    href: '/upload?tab=canva',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
  {
    title: 'View History',
    description: 'Browse your enhancement history',
    icon: History,
    href: '#history',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950',
    onClick: () => {
      document.getElementById('enhancement-history')?.scrollIntoView({ 
        behavior: 'smooth' 
      });
    },
  },
  {
    title: 'Manage Subscription',
    description: 'View plans and usage',
    icon: CreditCard,
    href: '/settings/billing',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        const isInternalLink = action.href.startsWith('#');
        
        const cardContent = (
          <Card 
            className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
            onClick={action.onClick}
          >
            <div className="p-6">
              <div className={`inline-flex p-3 rounded-lg ${action.bgColor} mb-4`}>
                <Icon className={`h-6 w-6 ${action.color}`} />
              </div>
              <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                {action.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {action.description}
              </p>
            </div>
          </Card>
        );

        if (isInternalLink) {
          return <div key={action.title}>{cardContent}</div>;
        }

        return (
          <Link key={action.title} href={action.href}>
            {cardContent}
          </Link>
        );
      })}
    </div>
  );
}