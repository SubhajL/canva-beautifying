import { BetaMessageCenter } from '@/components/beta/BetaMessageCenter';

export default function BetaAnnouncementsPage() {
  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Beta Program Updates</h1>
        <p className="text-muted-foreground">
          Stay informed about the latest features, updates, and announcements for the Canva Beautifying beta program.
        </p>
      </div>

      <BetaMessageCenter />
    </div>
  );
}