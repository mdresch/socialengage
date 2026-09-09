import { Metadata } from 'next';
import { OutboundPostsView } from './OutboundPostsView';

export const metadata: Metadata = {
  title: 'Outbound Publishing & Scheduling | SocialEngage',
  description: 'Manage and monitor outbound social media publishing queues and scheduled posts.',
};

export default function OutboundPostsPage() {
  return <OutboundPostsView />;
}
