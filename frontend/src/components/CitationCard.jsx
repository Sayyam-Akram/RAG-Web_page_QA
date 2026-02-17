export default function CitationCard({ source }) {
    const { title, url, file, page } = source
    const pageLabel = page !== '' && page != null ? ` — p.${page}` : ''

    return (
        <div className="citation-card">
            <span>📎</span>
            {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                    {title}{pageLabel}
                </a>
            ) : (
                <span>{title}{pageLabel}</span>
            )}
        </div>
    )
}
