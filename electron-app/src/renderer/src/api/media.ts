import { api } from './client'
import type { MediaItem } from '../types'

export const mediaApi = {
  // Upload image (multipart/form-data)
  upload(file: File, entityType: 'item' | 'item_variant' | 'combo' | 'modifier_group', entityId: string, isPrimary: boolean = false) {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('entity_type', entityType)
    formData.append('entity_id', entityId)
    formData.append('is_primary', String(isPrimary))

    return api.post<{ data: MediaItem }>('/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Get images for entity
  getByEntity(entityType: 'item' | 'item_variant' | 'combo' | 'modifier_group', entityId: string) {
    return api.get<{ data: MediaItem[] }>('/media', {
      params: { entity_type: entityType, entity_id: entityId },
    })
  },

  // Set as primary image
  setPrimary(id: string) {
    return api.patch<{ data: MediaItem }>(`/media/${id}`, { is_primary: true })
  },

  // Delete image
  delete(id: string) {
    return api.delete(`/media/${id}`)
  },
}
