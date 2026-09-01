import { Metadata } from 'next';
import { InboxView } from './InboxView';

export const metadata: Metadata = {
  title: 'Social Care Inbox | SocialEngage',
  description: 'Triage, prioritize, and reply to social mentions in real time.',
};

export default function InboxPage() {
  return <InboxView />;
}
