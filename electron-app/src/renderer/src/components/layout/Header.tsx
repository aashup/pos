import { ArrowLeft, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'

interface HeaderAction {
  icon: React.ElementType
  label: string
  onClick: () => void
  className?: string
}

interface HeaderProps {
  title: string
  onBack?: () => void
  actions?: HeaderAction[]
  showThemeToggle?: boolean
  showBackButton?: boolean
}

export default function Header({ title, onBack, actions = [], showThemeToggle = true, showBackButton = true }: HeaderProps) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  const handleBack = onBack ? onBack : () => navigate(-1)

  return (
    <header className={cn('h-12 flex items-center justify-between px-4 shrink-0', isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border-b border-gray-200')}>
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button onClick={handleBack} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} title="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <span className="font-bold text-orange-400 text-sm">{title} LALA</span>
      </div>

      <div className="flex items-center gap-3">
        {actions.map((action, idx) => {
          const Icon = action.icon
          return (
            <button
              key={idx}
              onClick={action.onClick}
              className={cn('flex items-center gap-1', isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900', action.className)}
              title={action.label}
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label && <span className="text-xs">{action.label}</span>}
            </button>
          )
        })}

        {showThemeToggle && (
          <button
            onClick={toggleTheme}
            className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          Aas</button>
        )}
      </div>
    </header>
  )
}
