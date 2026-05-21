import { useNavigate } from 'react-router-dom'
import { X, TableIcon, ChefHat, ClipboardList, PauseCircle, Package, BarChart2, FileText, Settings, Printer, Info, Users } from 'lucide-react'
import { ipc } from '../../bridge/ipc'
import { cn } from '../../lib/utils'

interface NavigationDrawerProps {
  open: boolean
  onClose: () => void
  isDark: boolean
}

export default function NavigationDrawer({ open, onClose, isDark }: NavigationDrawerProps) {
  const navigate = useNavigate()

  if (!open) return null

  const go = (path: string) => { onClose(); navigate(path) }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className={cn('fixed left-0 top-0 h-full w-64 z-50 flex flex-col shadow-2xl', isDark ? 'bg-gray-900 text-white border-r border-gray-800' : 'bg-white text-gray-900 border-r border-gray-200')}>
        <div className={cn('flex items-center justify-between p-4 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}>
          <span className="font-bold text-orange-400">Navigation</span>
          <button onClick={onClose} className={cn('', isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className={cn('flex-1 p-3 space-y-1', isDark ? 'bg-gray-900' : 'bg-white')}>
          <DrawerLink icon={TableIcon}    label="Table Map"       onClick={() => go('/pos/tables')} isDark={isDark} />
          <DrawerLink icon={ChefHat}      label="Kitchen Window"  onClick={() => { onClose(); ipc.window.openKitchen() }} isDark={isDark} />
          <DrawerLink icon={ClipboardList} label="Order History"  onClick={() => go('/pos/orders')} isDark={isDark} />
          <DrawerLink icon={PauseCircle}  label="Held Orders"     onClick={() => go('/pos/hold')} isDark={isDark} />
          <div className={cn('my-2 border-t', isDark ? 'border-gray-800' : 'border-gray-200')} />
          <div className={cn('my-2 border-t', isDark ? 'border-gray-800' : 'border-gray-200')} />
          <DrawerLink icon={BarChart2} label="Sales Summary"  onClick={() => go('/reports/sales')} isDark={isDark} />
          <DrawerLink icon={FileText}  label="Item-Wise Sales" onClick={() => go('/reports/items')} isDark={isDark} />
          <DrawerLink icon={BarChart2} label="Day Close"      onClick={() => go('/reports/day-close')} isDark={isDark} />
          <DrawerLink icon={FileText}  label="GST Summary"    onClick={() => go('/reports/gst')} isDark={isDark} />
          <div className={cn('my-2 border-t', isDark ? 'border-gray-800' : 'border-gray-200')} />
          <DrawerLink icon={Package}  label="Items"            onClick={() => go('/settings/items')} isDark={isDark} />
          <DrawerLink icon={Users}    label="Customers"        onClick={() => go('/settings/customers')} isDark={isDark} />
          <DrawerLink icon={Settings} label="Table Manager"    onClick={() => go('/settings/tables')} isDark={isDark} />
          <DrawerLink icon={Printer}  label="Printer Settings" onClick={() => go('/settings/printer')} isDark={isDark} />
          <DrawerLink icon={Info}     label="Device Info"      onClick={() => go('/settings/device')} isDark={isDark} />
        </nav>
        <div className={cn('p-4 border-t', isDark ? 'border-gray-800' : 'border-gray-200')}>
          <p className={cn('text-xs text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>Zazzy POS v1.0.0</p>
        </div>
      </div>
    </>
  )
}

function DrawerLink({ icon: Icon, label, onClick, isDark }: { icon: React.ElementType; label: string; onClick: () => void; isDark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left', isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900')}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  )
}
