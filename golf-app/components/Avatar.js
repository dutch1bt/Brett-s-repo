export default function Avatar({ name, avatarUrl, size = 'md', className = '' }) {
  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-green-700 ${className}`}
      />
    );
  }

  // Color based on name for consistent avatar colors
  const colors = [
    'bg-green-700', 'bg-emerald-700', 'bg-teal-700',
    'bg-cyan-700', 'bg-blue-700', 'bg-indigo-700',
    'bg-purple-700', 'bg-fuchsia-700',
  ];
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

  return (
    <div
      className={`${sizeClasses[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-green-700 flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
