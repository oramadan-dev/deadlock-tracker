import { useState, type ReactNode } from 'react'
import type { SteamProfile, loadRank } from '../../services/players'
import type { listRanks } from '../../services/statistics'
import { formatPlayerNumber, formatPlayerKda, steamProfileUrl, summarizePlayer } from '../../player'
import { PercentageBar } from '../DataDisplay/PercentageBar'

type PlayerProfileProps = {
  accountId: number
  person: SteamProfile | undefined
  rankData: Awaited<ReturnType<typeof loadRank>> | null
  rankInfo: Awaited<ReturnType<typeof listRanks>>[number] | undefined
}

export function PlayerProfile({ accountId, person, rankData, rankInfo }: PlayerProfileProps) {
  const [copyMessage, setCopyMessage] = useState('')
  function copyAccountId() {
    navigator.clipboard.writeText(String(accountId)).then(
      () => setCopyMessage('Copied'),
      () => setCopyMessage('Couldn’t copy; select the account ID instead.'),
    )
  }


  return (
    <header className="player-profile">
      {person && <img
        src={person.avatarfull}
        alt=""
        width="72"
        height="72"
        onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}
      <div>
        <h1 id="player-title">
          {person?.personaname || 'Account ' + accountId}
        </h1>
        <div className="player-identity">
          <span>Account {accountId}
          </span>
          <button
            className="theme-toggle"
            onClick={copyAccountId}>Copy ID</button>
          <a href={steamProfileUrl(accountId)} target="_blank" rel="noreferrer">Steam profile</a>
          <span role="status">
            {copyMessage}
          </span>
        </div>
      </div>
      <div className="player-rank">
        {rankInfo && <img src={rankInfo.images.large ?? rankInfo.images.chalk ?? undefined} alt="" width="52" height="52" />}
        <span>Latest recorded rank
          <strong>
            {rankData?.badge ? (rankInfo?.name ?? 'Tier ' + rankData.rank) + ' ' + rankData.subrank : 'Unranked / unavailable'}
          </strong>
        </span>
      </div>
    </header>
  )
}

type PlayerSummaryProps = { summary: ReturnType<typeof summarizePlayer> | null }

export function PlayerSummary({ summary }: PlayerSummaryProps) {
  if (!summary) return null

  const summaryItems: { label: string, value: ReactNode }[] = [
    { label: 'Recorded games', value: summary.games.toLocaleString() }, { label: 'Wins / losses', value: `${summary.wins} / ${summary.losses}` },
    { label: 'Win rate', value: <PercentageBar value={summary.winRate} label="Player win rate" /> },
    { label: 'Average K / D / A', value: formatPlayerKda(summary.kda) }, { label: 'Aggregate KDA', value: formatPlayerNumber(summary.aggregate) },
  ]

  return (
    <>
      <dl className="player-summary">
        {summaryItems.map((item) => <div key={item.label}>
          <dt>
            {item.label}
          </dt>
          <dd>
            {item.value}
          </dd>
        </div>)}
      </dl>
      <p className="statistics-note">Aggregate KDA = (total kills + total assists) / total deaths. Wins and losses reflect API scoring; other outcomes may not count toward either.</p>
    </>
  )
}
