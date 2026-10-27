import { useMemo, useState } from 'react'
import { AuthorFilter } from './AuthorFilter.jsx'
import { CharacterCard } from './CharacterCard.jsx'
import { EmptyState } from './EmptyState.jsx'
import { SearchInput } from './SearchInput.jsx'
import { TagFilter } from './TagFilter.jsx'
import { useI18n } from '../i18n/i18nContext.js'

const DEFAULT_PAGE_SIZE = 15

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
  onAuthorShortcut,
  onCharacterOpen,
  onTagShortcut,
  searchTerm,
  onSearchChange,
}) {
  const { t } = useI18n()
  const [currentPage, setCurrentPage] = useState(1)
  const showCards = !isCheckingSession && !isLoading && characters.length > 0
  const showEmptyState = !isCheckingSession && !isLoading && characters.length === 0
  const pageCount = Math.max(1, Math.ceil(characters.length / DEFAULT_PAGE_SIZE))
  const activePage = Math.min(currentPage, pageCount)
  const visibleCharacters = useMemo(() => {
    const startIndex = (activePage - 1) * DEFAULT_PAGE_SIZE
    return characters.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE)
  }, [activePage, characters])
  const rangeStart = characters.length === 0
    ? 0
    : (activePage - 1) * DEFAULT_PAGE_SIZE + 1
  const rangeEnd = Math.min(activePage * DEFAULT_PAGE_SIZE, characters.length)

  function updateFilter(callback, value) {
    setCurrentPage(1)
    callback(value)
  }

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
            onAuthorChange={(value) => updateFilter(onAuthorChange, value)}
          />
          <TagFilter
            tags={tagOptions}
            selectedTags={selectedTags}
            onTagsChange={(value) => updateFilter(onTagsChange, value)}
          />
        </div>
      </aside>

      <section className="content-panel">
        <div className="list-toolbar">
          <SearchInput
            value={searchTerm}
            onChange={(value) => updateFilter(onSearchChange, value)}
          />
          <p>{t('cardRange', {
            start: rangeStart,
            end: rangeEnd,
            count: characters.length,
          })}</p>
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
            {visibleCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                detailPath={getCharacterDetailPath(character.id, character.versionId)}
                onAuthorFilter={onAuthorShortcut}
                onOpen={onCharacterOpen}
                onTagFilter={onTagShortcut}
              />
            ))}
          </div>
        ) : null}

        {showCards && pageCount > 1 ? (
          <nav className="pagination" aria-label={t('paginationLabel')}>
            <button
              type="button"
              disabled={activePage === 1}
              onClick={() => setCurrentPage(activePage - 1)}
            >
              {t('previousPage')}
            </button>
            <p aria-live="polite">
              {t('pagePosition', { page: activePage, count: pageCount })}
            </p>
            <button
              type="button"
              disabled={activePage === pageCount}
              onClick={() => setCurrentPage(activePage + 1)}
            >
              {t('nextPage')}
            </button>
          </nav>
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
    <div className="status-panel" role="status" aria-live="polite">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  )
}
