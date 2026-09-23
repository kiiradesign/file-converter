import type { ConversionJob, ConvertSettings, FileEntry } from '../types'
import { isDesktop } from '../platform'
import { convertImageDesktop } from './desktop'
import { convertImageWeb } from './web/image'
import { canDecodeInBrowser } from './formats'

const MAX_CONCURRENCY = 4

type JobListener = (job: ConversionJob) => void

class JobQueue {
  private queue: ConversionJob[] = []
  private active = 0
  private listeners = new Set<JobListener>()
  private byId = new Map<string, ConversionJob>()

  subscribe(fn: JobListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  get(id: string): ConversionJob | undefined {
    return this.byId.get(id)
  }

  private emit(job: ConversionJob) {
    this.byId.set(job.id, job)
    for (const fn of this.listeners) fn({ ...job })
  }

  enqueue(
    job: Omit<ConversionJob, 'status' | 'progress'> & {
      status?: ConversionJob['status']
      progress?: number
    },
  ): ConversionJob {
    const full: ConversionJob = {
      ...job,
      status: job.status ?? 'queued',
      progress: job.progress ?? 0,
    }
    this.byId.set(full.id, full)
    this.queue.push(full)
    this.emit(full)
    this.pump()
    return full
  }

  private pump() {
    while (this.active < MAX_CONCURRENCY && this.queue.length > 0) {
      const next = this.queue.shift()!
      void this.run(next)
    }
  }

  private async run(job: ConversionJob) {
    this.active++
    const running = { ...job, status: 'running' as const, progress: 0.05 }
    this.emit(running)

    try {
      // Source lookup is provided via closure on the job runner below.
      await this.executor?.(running, (progress) => {
        this.emit({ ...running, status: 'running', progress })
      })
    } catch (err) {
      this.emit({
        ...running,
        status: 'error',
        progress: 1,
        error: err instanceof Error ? err.message : 'Conversion failed',
      })
    } finally {
      this.active--
      this.pump()
    }
  }

  executor:
    | ((
        job: ConversionJob,
        onProgress: (p: number) => void,
      ) => Promise<void>)
    | null = null
}

export const jobQueue = new JobQueue()

export async function runConversion(
  source: FileEntry,
  settings: ConvertSettings,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  if (!canDecodeInBrowser(source.extension)) {
    throw new Error(`Cannot decode .${source.extension} in this runtime`)
  }
  const convert = isDesktop() ? convertImageDesktop : convertImageWeb
  return convert(source.objectUrl, settings, onProgress, source.extension)
}
