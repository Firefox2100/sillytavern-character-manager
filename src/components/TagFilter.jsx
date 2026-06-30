import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/i18nContext.js'

export function TagFilter({ tags, selectedTags, onTagsChange }) {
  const { t } = useI18n()
  const filterRef = useRef(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedTagSet = useMemo(
    () => new Set([...selectedTags.include, ...selectedTags.exclude]),
    [selectedTags],
  )

  const visibleTags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return tags.filter((tag) => {
      if (selectedTagSet.has(tag)) {
        return false
      }

      return !normalizedQuery || tag.toLowerCase().includes(normalizedQuery)
    })
  }, [query, selectedTagSet, tags])

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

  function addTag(tag, mode) {
    onTagsChange({
      include:
        mode === 'include'
          ? [...selectedTags.include, tag]
          : selectedTags.include.filter((selectedTag) => selectedTag !== tag),
      exclude:
        mode === 'exclude'
          ? [...selectedTags.exclude, tag]
          : selectedTags.exclude.filter((selectedTag) => selectedTag !== tag),
    })
    setQuery('')
    setIsOpen(true)
  }

  function removeTag(tag) {
    onTagsChange({
      include: selectedTags.include.filter((selectedTag) => selectedTag !== tag),
      exclude: selectedTags.exclude.filter((selectedTag) => selectedTag !== tag),
    })
  }

  function clearTags() {
    onTagsChange({ include: [], exclude: [] })
    setQuery('')
    setIsOpen(true)
  }

  const hasSelectedTags =
    selectedTags.include.length > 0 || selectedTags.exclude.length > 0

  return (
    <div className="filter-control" ref={filterRef}>
      <label className="filter-label" htmlFor="tag-filter">
        {t('tagFilter')}
      </label>

      {hasSelectedTags ? (
        <div className="selected-filter-list">
          {selectedTags.include.map((tag) => (
            <FilterChip
              key={`include-${tag}`}
              label={tag}
              modeLabel={t('includeTag')}
              onRemove={() => removeTag(tag)}
            />
          ))}
          {selectedTags.exclude.map((tag) => (
            <FilterChip
              key={`exclude-${tag}`}
              label={tag}
              modeLabel={t('excludeTag')}
              isNegative
              onRemove={() => removeTag(tag)}
            />
          ))}
        </div>
      ) : null}

      <div className="combobox">
        <input
          id="tag-filter"
          type="text"
          className={hasSelectedTags ? '' : 'is-full-width'}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="tag-filter-options"
          autoComplete="off"
          value={query}
          placeholder={t('tagFilterPlaceholder')}
          onFocus={() => {
            setQuery('')
            setIsOpen(true)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
            }
          }}
        />
        {hasSelectedTags ? (
          <button type="button" onClick={clearTags}>
            {t('clearFilter')}
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="combobox-options tag-filter-options" id="tag-filter-options">
          {visibleTags.length > 0 ? (
            visibleTags.map((tag) => (
              <div className="tag-option" key={tag}>
                <span>{tag}</span>
                <div>
                  <button type="button" onClick={() => addTag(tag, 'include')}>
                    {t('includeTag')}
                  </button>
                  <button type="button" onClick={() => addTag(tag, 'exclude')}>
                    {t('excludeTag')}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>{t('noTagsFound')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function FilterChip({ label, modeLabel, isNegative = false, onRemove }) {
  return (
    <button
      className={`filter-chip ${isNegative ? 'is-negative' : ''}`}
      type="button"
      onClick={onRemove}
    >
      <span>{modeLabel}</span>
      {label}
    </button>
  )
}
