import { AuthorFilter } from './AuthorFilter.jsx'
import { CharacterCard } from './CharacterCard.jsx'
import { EmptyState } from './EmptyState.jsx'
import { SearchInput } from './SearchInput.jsx'
import { TagFilter } from './TagFilter.jsx'
import { useI18n } from '../i18n/i18nContext.js'

export function CharacterListPage({
  characters,
  isCheckingSession,
  isLoading,
  authorOptions,
  selectedAuthorId,
  onAuthorChange,
  tagOptions,
  selectedTags,
  onTagsChange,
  onCharacterOpen,
  searchTerm,
  onSearchChange,
}) {
  const { t } = useI18n()
  const showCards = !isCheckingSession && !isLoading && characters.length > 0
  const showEmptyState = !isCheckingSession && !isLoading && characters.length === 0

  return (
    <section className="workspace" aria-label={t('pageTitle')}>
      <aside className="filter-panel" aria-label={t('filters')}>
        <div className="panel-heading">
          <h2>{t('filters')}</h2>
          <span>{characters.length}</span>
        </div>
        <div className="filter-stack">
          <AuthorFilter
            authors={authorOptions}
            selectedAuthorId={selectedAuthorId}
            onAuthorChange={onAuthorChange}
          />
          <TagFilter
            tags={tagOptions}
            selectedTags={selectedTags}
            onTagsChange={onTagsChange}
          />
        </div>
      </aside>

      <section className="content-panel">
        <div className="list-toolbar">
          <SearchInput value={searchTerm} onChange={onSearchChange} />
          <p>{t('cardCount', { count: characters.length })}</p>
        </div>

        {isCheckingSession ? (
          <StatusPanel
            title={t('checkingSessionTitle')}
            message={t('checkingSessionMessage')}
          />
        ) : null}

        {isLoading ? (
          <StatusPanel
            title={t('loadingCardsTitle')}
            message={t('loadingCardsMessage')}
          />
        ) : null}

        {showCards ? (
          <div className="character-grid">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                detailPath={getCharacterDetailPath(character.id, character.versionId)}
                onOpen={onCharacterOpen}
              />
            ))}
          </div>
        ) : null}

        {showEmptyState ? (
          <EmptyState searchTerm={searchTerm} />
        ) : null}
      </section>
    </section>
  )
}

function getCharacterDetailPath(characterId, versionId) {
  return versionId
    ? `/characters/${characterId}/versions/${versionId}`
    : `/characters/${characterId}`
}

function StatusPanel({ title, message }) {
  return (
    <div className="status-panel">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  )
}
