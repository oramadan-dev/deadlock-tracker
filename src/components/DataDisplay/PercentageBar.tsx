type PercentageBarProps = {
  value: number | null
  label: string
  formattedValue?: string
  title?: string
}

export function PercentageBar({ value, label, formattedValue, title }: PercentageBarProps) {
  if (value === null) return <>—</>
  const percent = Math.max(0, Math.min(100, value * 100))
  const valueText = formattedValue ?? percent.toFixed(1) + '%'

  return (
    <span
      className="percentage-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      title={title}
    >
      <span className="percentage-fill" style={{ width: percent + '%' }} />
      <span className="percentage-label percentage-label-filled" aria-hidden="true">
        {valueText}
      </span>
      <span className="percentage-label percentage-label-remainder" aria-hidden="true">
        {(100 - percent).toFixed(1)}%
      </span>
    </span>
  )
}

