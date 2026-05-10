import axios, { AxiosError } from 'axios'
import toast from 'react-hot-toast'

function getBaseUrl(): string {
  const serverUrl = localStorage.getItem('serverUrl') || 'http://127.0.0.1:8000'
  return `${serverUrl}/api/v1`
}

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl()

  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

interface ApiValidationError {
  message: string
  errors?: Record<string, string[]>
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiValidationError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.hash = '/login'
      return Promise.reject(error)
    }

    const data = error.response?.data

    if (data?.errors) {
      const messages = Object.values(data.errors).flat()
      toast.error(messages.join('\n'), { duration: 5000 })
    } else if (data?.message) {
      toast.error(data.message, { duration: 4000 })
    } else if (error.message === 'Network Error') {
      // Silently ignore — offline banner will indicate status
    } else {
      toast.error('Something went wrong. Please try again.', { duration: 4000 })
    }

    return Promise.reject(error)
  },
)

export default api
