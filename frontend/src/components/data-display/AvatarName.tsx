import { initials } from '@/lib/format';

export function AvatarName({ name, subtitle = '', tone = '' }: { name: string; subtitle?: string; tone?: string }) {
  return <span className="avatar-name"><span className={`mini-avatar ${tone}`}>{initials(name)}</span><span><strong className="cell-main">{name}</strong><small className="cell-sub">{subtitle}</small></span></span>;
}
