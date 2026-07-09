/**
 * useJobs — estado global de la cola de trabajos.
 *
 * Se suscribe al evento JOBS_EVENT_UPDATED del backend: cada snapshot de
 * trabajo se fusiona en un mapa id→Job. Toda pantalla que muestre progreso
 * consume este contexto (una única suscripción IPC para toda la app).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { Job, JobRequest } from '@shared/types'

interface JobsContextValue {
  jobs: Job[]
  enqueue: (request: JobRequest) => Promise<Job>
  cancel: (id: string) => Promise<void>
  clearFinished: () => Promise<void>
}

const JobsContext = createContext<JobsContextValue>({
  jobs: [],
  enqueue: async () => {
    throw new Error('JobsProvider ausente')
  },
  cancel: async () => {},
  clearFinished: async () => {}
})

export function JobsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [jobMap, setJobMap] = useState<Map<string, Job>>(new Map())

  useEffect(() => {
    // Estado inicial + suscripción a cambios.
    void window.api.listJobs().then((list) => {
      setJobMap(new Map(list.map((j) => [j.id, j])))
    })
    const unsubscribe = window.api.onJobUpdated((job) => {
      setJobMap((prev) => {
        const next = new Map(prev)
        next.set(job.id, job)
        return next
      })
    })
    return unsubscribe
  }, [])

  const enqueue = useCallback((request: JobRequest) => window.api.enqueueJob(request), [])
  const cancel = useCallback((id: string) => window.api.cancelJob(id), [])
  const clearFinished = useCallback(async () => {
    await window.api.clearFinishedJobs()
    const list = await window.api.listJobs()
    setJobMap(new Map(list.map((j) => [j.id, j])))
  }, [])

  const jobs = useMemo(
    () => [...jobMap.values()].sort((a, b) => b.createdAt - a.createdAt),
    [jobMap]
  )

  return (
    <JobsContext.Provider value={{ jobs, enqueue, cancel, clearFinished }}>
      {children}
    </JobsContext.Provider>
  )
}

export function useJobs(): JobsContextValue {
  return useContext(JobsContext)
}
