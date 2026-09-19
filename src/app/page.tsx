import { redirect } from 'next/navigation';

export default function Home() {
  redirect(process.env.DEALER_APP_URL ? '/dealer' : '/apps/enclosure-designer');
}
