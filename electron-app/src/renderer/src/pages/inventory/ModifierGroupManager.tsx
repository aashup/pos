import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Edit2, Trash2, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { modifierGroupsApi } from '../../api/modifierGroups'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { ModifierGroup, Modifier } from '../../types'

export default function ModifierGroupManager() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [search, setSearch] = useState('')
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null)
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '' })
  const [showModifierForm, setShowModifierForm] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null)
  const [modifierFormData, setModifierFormData] = useState({
    name: '',
    price: 0,
    sort_order: 0,
  })

  // Fetch modifier groups
  const { data: groups = [], isLoading, refetch } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: async () => {
      const res = await modifierGroupsApi.list({ per_page: 1000 })
      return (res.data?.data ?? []) as ModifierGroup[]
    },
  })

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(search.toLowerCase())
  )

  // Save group mutation
  const saveGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      if (editingGroup) {
        return modifierGroupsApi.update(editingGroup.id, data)
      } else {
        return modifierGroupsApi.create({
          ...data,
          is_active: true,
        })
      }
    },
    onSuccess: () => {
      toast.success(editingGroup ? 'Group updated' : 'Group created')
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] })
      setShowGroupForm(false)
      setEditingGroup(null)
      setGroupFormData({ name: '', description: '' })
    },
    onError: () => {
      toast.error(editingGroup ? 'Failed to update group' : 'Failed to create group')
    },
  })

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => modifierGroupsApi.delete(id),
    onSuccess: () => {
      toast.success('Group deleted')
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] })
    },
    onError: () => {
      toast.error('Failed to delete group')
    },
  })

  // Save modifier mutation
  const saveModifierMutation = useMutation({
    mutationFn: async (data: { name: string; price: number; sort_order: number }) => {
      if (!selectedGroupId) return
      if (editingModifier) {
        return modifierGroupsApi.updateModifier(selectedGroupId, editingModifier.id, data)
      } else {
        return modifierGroupsApi.createModifier(selectedGroupId, {
          ...data,
          is_active: true,
        })
      }
    },
    onSuccess: () => {
      toast.success(editingModifier ? 'Modifier updated' : 'Modifier created')
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] })
      setShowModifierForm(false)
      setEditingModifier(null)
      setModifierFormData({ name: '', price: 0, sort_order: 0 })
    },
    onError: () => {
      toast.error(editingModifier ? 'Failed to update modifier' : 'Failed to create modifier')
    },
  })

  // Delete modifier mutation
  const deleteModifierMutation = useMutation({
    mutationFn: (modifierId: string) => {
      if (!selectedGroupId) return Promise.reject()
      return modifierGroupsApi.deleteModifier(selectedGroupId, modifierId)
    },
    onSuccess: () => {
      toast.success('Modifier deleted')
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] })
    },
    onError: () => {
      toast.error('Failed to delete modifier')
    },
  })

  const handleCreateGroup = () => {
    setEditingGroup(null)
    setGroupFormData({ name: '', description: '' })
    setShowGroupForm(true)
  }

  const handleEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group)
    setGroupFormData({ name: group.name, description: group.description || '' })
    setShowGroupForm(true)
  }

  const handleDeleteGroup = (id: string) => {
    if (confirm('Delete this modifier group? This action cannot be undone.')) {
      deleteGroupMutation.mutate(id)
    }
  }

  const handleSaveGroup = () => {
    if (!groupFormData.name.trim()) {
      toast.error('Group name is required')
      return
    }
    saveGroupMutation.mutate(groupFormData)
  }

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId)
    setShowModifierForm(false)
    setEditingModifier(null)
    setModifierFormData({ name: '', price: 0, sort_order: 0 })
  }

  const handleCreateModifier = () => {
    if (!selectedGroupId) return
    setEditingModifier(null)
    setModifierFormData({ name: '', price: 0, sort_order: 0 })
    setShowModifierForm(true)
  }

  const handleEditModifier = (modifier: Modifier) => {
    setEditingModifier(modifier)
    setModifierFormData({
      name: modifier.name,
      price: Number(modifier.price),
      sort_order: modifier.sort_order || 0,
    })
    setShowModifierForm(true)
  }

  const handleDeleteModifier = (modifierId: string) => {
    if (confirm('Delete this modifier?')) {
      deleteModifierMutation.mutate(modifierId)
    }
  }

  const handleSaveModifier = () => {
    if (!modifierFormData.name.trim()) {
      toast.error('Modifier name is required')
      return
    }
    saveModifierMutation.mutate(modifierFormData)
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      {/* Header */}
      <header className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory/items')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">Modifier Groups</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            New Group
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Groups List */}
        <div
          className={cn(
            'w-1/3 border-r flex flex-col',
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
          )}
        >
          {/* Search */}
          <div
            className={cn('px-3 py-2 border-b shrink-0', isDark ? 'border-gray-800' : 'border-gray-100')}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups..."
              className={cn(
                'w-full px-2 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                isDark
                  ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500'
                  : 'border-gray-200 bg-white text-gray-900'
              )}
            />
          </div>

          {/* Groups */}
          <div className={cn('flex-1 overflow-y-auto', isDark ? 'divide-gray-800' : 'divide-gray-100')}>
            {isLoading ? (
              <div className={cn('flex items-center justify-center h-20 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Loading…
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className={cn('flex items-center justify-center h-20 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                No groups found
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => handleSelectGroup(group.id)}
                  className={cn(
                    'px-3 py-2 border-b cursor-pointer transition-colors',
                    selectedGroupId === group.id
                      ? isDark
                        ? 'bg-orange-900 border-orange-700'
                        : 'bg-orange-50 border-orange-200'
                      : isDark
                        ? 'hover:bg-gray-800 border-gray-800'
                        : 'hover:bg-gray-50 border-gray-100'
                  )}
                >
                  <p className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>
                    {group.name}
                  </p>
                  <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {group.modifiers?.length ?? 0} modifiers
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Details Panel */}
        <div className={cn('flex-1 flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
          {selectedGroup ? (
            <>
              {/* Group Header */}
              <div
                className={cn(
                  'px-4 py-3 border-b shrink-0',
                  isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={cn('text-base font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>
                      {selectedGroup.name}
                    </h2>
                    {selectedGroup.description && (
                      <p className={cn('text-xs mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedGroup.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditGroup(selectedGroup)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(selectedGroup.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modifiers List */}
              <div className="flex-1 overflow-y-auto">
                {!selectedGroup.modifiers || selectedGroup.modifiers.length === 0 ? (
                  <div
                    className={cn(
                      'flex flex-col items-center justify-center h-40 text-sm',
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    )}
                  >
                    <p>No modifiers yet</p>
                    <button
                      onClick={handleCreateModifier}
                      className="text-orange-500 hover:text-orange-400 text-xs mt-2"
                    >
                      Add first modifier →
                    </button>
                  </div>
                ) : (
                  <div className={cn('divide-y', isDark ? 'divide-gray-800' : 'divide-gray-100')}>
                    {selectedGroup.modifiers.map((modifier) => (
                      <div
                        key={modifier.id}
                        className={cn(
                          'px-4 py-3 flex items-center justify-between',
                          isDark ? 'hover:bg-gray-900' : 'hover:bg-gray-50'
                        )}
                      >
                        <div className="flex-1">
                          <p className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>
                            {modifier.name}
                          </p>
                          <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                            ₹{Number(modifier.price).toFixed(2)} • Order: {modifier.sort_order}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEditModifier(modifier)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteModifier(modifier.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Modifier Button */}
              <div className={cn('px-4 py-3 border-t shrink-0', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
                <button
                  onClick={handleCreateModifier}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 rounded-lg font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add Modifier
                </button>
              </div>
            </>
          ) : (
            <div
              className={cn(
                'flex items-center justify-center h-full text-sm',
                isDark ? 'text-gray-500' : 'text-gray-400'
              )}
            >
              Select a group to manage modifiers
            </div>
          )}
        </div>
      </div>

      {/* Group Form Modal */}
      {showGroupForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={cn(
              'rounded-lg shadow-xl w-full max-w-md',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
              <h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                {editingGroup ? 'Edit Group' : 'New Group'}
              </h3>
              <button
                onClick={() => {
                  setShowGroupForm(false)
                  setEditingGroup(null)
                }}
                className={cn('p-1 rounded', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Name
                </label>
                <input
                  type="text"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="e.g., Toppings, Sauce Level, etc."
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500'
                      : 'border-gray-200 bg-white text-gray-900'
                  )}
                />
              </div>

              <div>
                <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Description (optional)
                </label>
                <textarea
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500'
                      : 'border-gray-200 bg-white text-gray-900'
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-4 border-t" style={{ borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
              <button
                onClick={() => {
                  setShowGroupForm(false)
                  setEditingGroup(null)
                }}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                  isDark
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroup}
                disabled={saveGroupMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
              >
                {saveGroupMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifier Form Modal */}
      {showModifierForm && selectedGroupId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={cn(
              'rounded-lg shadow-xl w-full max-w-md',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
              <h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                {editingModifier ? 'Edit Modifier' : 'New Modifier'}
              </h3>
              <button
                onClick={() => {
                  setShowModifierForm(false)
                  setEditingModifier(null)
                }}
                className={cn('p-1 rounded', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Name
                </label>
                <input
                  type="text"
                  value={modifierFormData.name}
                  onChange={(e) => setModifierFormData({ ...modifierFormData, name: e.target.value })}
                  placeholder="e.g., Extra Cheese, Medium Spice"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500'
                      : 'border-gray-200 bg-white text-gray-900'
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modifierFormData.price}
                    onChange={(e) => setModifierFormData({ ...modifierFormData, price: Number(e.target.value) })}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-gray-200'
                        : 'border-gray-200 bg-white text-gray-900'
                    )}
                  />
                </div>

                <div>
                  <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modifierFormData.sort_order}
                    onChange={(e) => setModifierFormData({ ...modifierFormData, sort_order: Number(e.target.value) })}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-gray-200'
                        : 'border-gray-200 bg-white text-gray-900'
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-4 border-t" style={{ borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
              <button
                onClick={() => {
                  setShowModifierForm(false)
                  setEditingModifier(null)
                }}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                  isDark
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModifier}
                disabled={saveModifierMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
              >
                {saveModifierMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
