import { useI18n } from '../i18n/i18nContext.js'

export function CharacterCard({ character, detailPath, onOpen }) {
  const { t } = useI18n()
  const author =
    character.author ??
    (character.authorId
      ? t('authorById', { id: character.authorId })
      : t('unknownAuthor'))

  return (
    <article className="character-card">
      <a
        className="character-card-link"
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
      <div className="character-card-body">
        <div className="character-card-heading">
          <h3>{character.name}</h3>
          <p>{t('byAuthor', { author })}</p>
        </div>
        {character.tags.length > 0 ? (
          <ul className="tag-list" aria-label={t('tagsLabel', { name: character.name })}>
            {character.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : (
          <p className="no-tags">{t('noTags')}</p>
        )}
      </div>
      </a>
    </article>
  )
}
