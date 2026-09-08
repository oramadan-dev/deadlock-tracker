import { useEffect, useRef, useState } from 'react'
import type { listRanks } from '../../services/statistics'

type RankRange = { minRank: number, maxRank: number }
type RankSelectorProps = RankRange & {
  ranks: Awaited<ReturnType<typeof listRanks>>
  onChange: (range: RankRange) => void
}

export function RankSelector({ minRank, maxRank, ranks, onChange }: RankSelectorProps) {
  const [draftRanks, setDraftRanks] = useState({ minRank, maxRank })
  const [committedRanks, setCommittedRanks] = useState({ minRank, maxRank })
  if (committedRanks.minRank !== minRank || committedRanks.maxRank !== maxRank) {
    setCommittedRanks({ minRank, maxRank })
    setDraftRanks({ minRank, maxRank })
  }
  const rankButton = useRef<HTMLButtonElement>(null)
  const rankPopup = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const popup = rankPopup.current
    function position() {
      const button = rankButton.current
      if (!popup || !button || !popup.matches(':popover-open')) return
      const rect = button.getBoundingClientRect()
      const height = popup.offsetHeight
      const top = rect.bottom + 8 + height <= window.innerHeight - 8 ? rect.bottom + 8 : Math.max(8, rect.top - height - 8)
      popup.style.top = top + 'px'
      popup.style.left = Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - popup.offsetWidth - 8)) + 'px'
    }
    popup?.addEventListener('toggle', position)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      popup?.removeEventListener('toggle', position)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [])
  function commitRanks() { onChange(draftRanks) }
  const rankInputEvents = {
    onPointerDown: (event: React.PointerEvent<HTMLInputElement>) => event.currentTarget.setPointerCapture(event.pointerId),
    onPointerUp: commitRanks,
    onPointerCancel: () => setDraftRanks({ minRank, maxRank }),
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commitRanks()
    },
    onBlur: commitRanks,
  }
  const rankName = (tier: number) => ranks.find((rank) => rank.tier === tier)?.name ?? 'Tier ' + tier
  let rankSummary = rankName(minRank)
  if (minRank !== maxRank) {
    rankSummary += maxRank === 11 ? '+' : '–' + rankName(maxRank)
  }

  return (
    <>
      <button
        ref={rankButton}
        type="button"
        className="theme-toggle"
        popoverTarget="rank-popup"
        aria-label={'Edit average match rank: ' + rankSummary}>
        {rankSummary} <span aria-hidden="true">▾</span>
      </button>
      <div
        ref={rankPopup}
        id="rank-popup"
        className="rank-popup"
        popover="auto"
        aria-label="Average match rank">
        <fieldset className="rank-filter">
          <legend className="visually-hidden">Average match rank</legend>
          <div className="rank-labels">
            <span>
              {ranks.find((rank) => rank.tier === draftRanks.minRank)?.name ?? 'Tier ' + draftRanks.minRank}
            </span>
            <span>
              {ranks.find((rank) => rank.tier === draftRanks.maxRank)?.name ?? 'Tier ' + draftRanks.maxRank}
            </span>
          </div>
          <div className="rank-slider">
            <div className="rank-slider-track">
              <div className="rank-notches" aria-hidden="true">
                {ranks.map((rank) => <i key={rank.tier} style={{ left: (rank.tier - 1) * 10 + '%' }} />)}
              </div>
              <span style={{ left: (draftRanks.minRank - 1) * 10 + '%', right: (11 - draftRanks.maxRank) * 10 + '%' }} />
            </div>
            <input
              {...rankInputEvents}
              type="range"
              min="1"
              max="11"
              step="1"
              value={draftRanks.minRank}
              aria-label="From rank"
              aria-valuetext={ranks.find((rank) => rank.tier === draftRanks.minRank)?.name}
              disabled={!ranks.length}
              style={{ zIndex: draftRanks.minRank === 11 ? 3 : 1 }}
              onChange={(event) => setDraftRanks({ ...draftRanks, minRank: Math.min(Number(event.target.value), draftRanks.maxRank) })} />
            <input
              {...rankInputEvents}
              type="range"
              min="1"
              max="11"
              step="1"
              value={draftRanks.maxRank}
              aria-label="To rank"
              aria-valuetext={ranks.find((rank) => rank.tier === draftRanks.maxRank)?.name}
              disabled={!ranks.length}
              onChange={(event) => setDraftRanks({ ...draftRanks, maxRank: Math.max(Number(event.target.value), draftRanks.minRank) })} />
          </div>
          <div className="rank-icons">
            {ranks.map((rank) => <span key={rank.tier} title={rank.name} style={{ left: (rank.tier - 1) * 10 + '%' }}>
              <img
                src={rank.images.large ?? rank.images.chalk_webp ?? rank.images.chalk ?? undefined}
                alt={rank.name}
                width="36"
                height="36" />
            </span>)}
          </div>
        </fieldset>
      </div>
    </>
  )
}
