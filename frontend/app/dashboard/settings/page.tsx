import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // Automatically route users straight to the Profile settings tab
  redirect('/dashboard/settings/profile');
}