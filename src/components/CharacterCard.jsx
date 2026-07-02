import { useI18n } from '../i18n/i18nContext.js'

export function CharacterCard({
  character,
  detailPath,
  onAuthorFilter,
  onOpen,
  onTagFilter,
}) {
  const { t } = useI18n()
  const author =
    character.author ??
    (character.authorId
      ? t('authorById', { id: character.authorId })
      : t('unknownAuthor'))

  return (
    <article className="character-card">
      <a
        className="character-media-link"
        href={detailPath}
        onClick={(event) => {
          event.preventDefault()
          onOpen(character)
        }}
      >
      {character.imageUrl ? (
        <img
          className="character-image"
          src={character.imageUrl}
          alt={t('portraitAlt', { name: character.name })}
          loading="lazy"
        />
      ) : (
        <div className="character-image character-image-placeholder">
          {t('noCardImage')}
        </div>
      )}
      </a>
      <div className="character-card-body">
        <div className="character-card-heading">
          <a
            className="character-title-link"
            href={detailPath}
            onClick={(event) => {
              event.preventDefault()
              onOpen(character)
            }}
          >
            <h3>{character.name}</h3>
          </a>
          <p>
            {character.authorId ? (
              <button
                className="inline-filter-button"
                type="button"
                onClick={() => onAuthorFilter(character)}
              >
                {t('byAuthor', { author })}
              </button>
            ) : (
              t('byAuthor', { author })
            )}
          </p>
        </div>
        {character.tags.length > 0 ? (
          <ul className="tag-list" aria-label={t('tagsLabel', { name: character.name })}>
            {character.tags.map((tag) => (
              <li key={tag}>
                <button type="button" onClick={() => onTagFilter(tag)}>
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-tags">{t('noTags')}</p>
        )}
      </div>
    </article>
  )
}
