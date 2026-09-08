import {
  BriefcaseBusiness,
  Users,
  Building2,
  FileCheck2,
  Scale,
  ShieldCheck,
} from 'lucide-react';
export function ServiceIcon({ name }: { name?: string }) {
  const Icon =
    (
      {
        briefcase: BriefcaseBusiness,
        users: Users,
        building: Building2,
        document: FileCheck2,
        shield: ShieldCheck,
      } as Record<string, typeof Scale>
    )[name || ''] || Scale;
  return <Icon size={26} strokeWidth={1.4} />;
}
