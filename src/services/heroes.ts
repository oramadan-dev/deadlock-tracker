import { HeroesApi } from 'deadlock_api_client/apis/heroes-api'
import type { Hero } from 'deadlock_api_client/models/hero'

export type HeroSummary = Pick<Hero, 'id' | 'name' | 'images'>

const heroesApi = new HeroesApi()

export async function listHeroes(signal: AbortSignal): Promise<HeroSummary[]> {
  const { data } = await heroesApi.listHeroes(
    { language: 'english', onlyActive: true },
    { signal, timeout: 15000 },
  )
  return data
}
