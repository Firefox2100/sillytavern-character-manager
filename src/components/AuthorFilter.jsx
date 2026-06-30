import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/i18nContext.js'

export function AuthorFilter({ authors, selectedAuthorId, onAuthorChange }) {
  const { t } = useI18n()
  const filterRef = useRef(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedAuthor = authors.find((author) => author.id === selectedAuthorId)
  const visibleAuthors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return authors
    }

    return authors.filter((author) =>
      author.name.toLowerCase().includes(normalizedQuery),
    )
  }, [authors, query])

  useEffect(() => {
    function handleDocumentMouseDown(event) {
      if (!filterRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
    }
  }, [])

  function selectAuthor(author) {
    onAuthorChange(author.id)
    setQuery(author.name)
    setIsOpen(false)
  }

  function clearAuthor() {
    onAuthorChange('')
    setQuery('')
    setIsOpen(true)
  }

  return (
    <div className="filter-control" ref={filterRef}>
      <label className="filter-label" htmlFor="author-filter">
        {t('authorFilter')}
      </label>
      <div className="combobox">
        <input
          id="author-filter"
          type="text"
          className={selectedAuthorId ? '' : 'is-full-width'}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="author-filter-options"
          autoComplete="off"
          value={isOpen ? query : selectedAuthor?.name ?? query}
          placeholder={t('authorFilterPlaceholder')}
          onFocus={() => {
            setQuery('')
            setIsOpen(true)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            onAuthorChange('')
            setIsOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
            }
          }}
        />
        {selectedAuthorId ? (
          <button type="button" onClick={clearAuthor}>
            {t('clearFilter')}
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          className="combobox-options"
          id="author-filter-options"
          role="listbox"
        >
          {visibleAuthors.length > 0 ? (
            visibleAuthors.map((author) => (
              <button
                key={author.id}
                type="button"
                role="option"
                aria-selected={author.id === selectedAuthorId}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectAuthor(author)}
              >
                {author.name}
              </button>
            ))
          ) : (
            <p>{t('noAuthorsFound')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
