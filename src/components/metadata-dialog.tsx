import { ArrowLeft, Globe, Loader2, Search, Square } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useSettings } from '@/hooks/use-settings';
import {
  buildReview,
  creditRoleLabel,
  isEmptyUpdate,
  type MetadataReview,
  reviewFieldLabel,
  reviewToUpdate,
} from '@/lib/metadata-review';
import { hasFiche } from '@/lib/library-filter';
import { INITIAL_LOOKUP, lookupReducer } from '@/lib/metadata-lookup';
import { initialLookupQuery, initialRuleState, offeredRules, queryFromRule, rememberRule } from '@/lib/lookup-query';
import { cn, formatLanguage } from '@/lib/utils';
import { fileNameTemplateError } from '@/shared/file-name-template';
import { CREDIT_ROLES, type CreditRole, type LibraryEntry } from '@/shared/library';
import {
  METADATA_SOURCE_LABELS,
  type MetadataApiSource,
  type MetadataCandidate,
  type MetadataQuery,
  pageSourceOf,
} from '@/shared/metadata';
import { formatPersonName } from '@/shared/title-parsing';

/** How to look the book up: in the public APIs, or from the link of a page of a supported site. */
type Mode = 'api' | 'site';

/** The APIs that are ticked per search once enabled in the settings, in display order. */
const API_SOURCES: MetadataApiSource[] = ['comicvine', 'googlebooks'];

const INPUT_CLASS =
  'h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Looks a library entry up, lets the user pick the right book among the results (each shows its
 * source), then accept, edit or refuse each proposed change before writing it. Nothing is searched
 * on opening: the user picks how (the enabled public APIs, or the link of a page of Bédéthèque,
 * BDfugue or Nautiljon, which skips the results and goes straight to the review), ticks the
 * options, starts the search and can stop it. Saving also updates the `.nfo` and the cover.
 */
export function MetadataDialog({
  entry,
  onClose,
  onApplied,
}: {
  entry: LibraryEntry;
  onClose: () => void;
  onApplied: (entry: LibraryEntry) => void;
}) {
  const { t } = useTranslation(['metadata', 'common']);
  const { settings, update } = useSettings();
  const [mode, setMode] = useState<Mode>('api');
  // A book with no information yet starts from its file name: a rule can read it into the fields,
  // and the last rule used that fits is applied at once.
  const needsRule = !hasFiche(entry);
  const [initial] = useState(() =>
    needsRule
      ? initialRuleState(entry, settings?.fileNameRules ?? [])
      : { rule: '', query: initialLookupQuery(entry) },
  );
  const [query, setQuery] = useState<MetadataQuery>(initial.query);
  const [pageUrl, setPageUrl] = useState('');
  const rules = offeredRules(settings?.fileNameRules ?? [], settings?.libraryFileName ?? '');
  const [rule, setRule] = useState(initial.rule);
  const [ruleMisses, setRuleMisses] = useState(false);
  const ruleError = rule === '' ? null : fileNameTemplateError(rule);
  const applyRule = () => {
    const found = queryFromRule(entry, rule);
    setRuleMisses(found === null);
    if (!found) return;
    setQuery(found);
    update('fileNameRules', rememberRule(settings?.fileNameRules ?? [], rule));
  };
  const enabledSources = API_SOURCES.filter((source) =>
    source === 'comicvine' ? settings?.comicVineEnabled : settings?.googleBooksEnabled,
  );
  const [unticked, setUnticked] = useState<Set<MetadataApiSource>>(new Set());
  // Bédéthèque has no key to enable: its box is always there, starting as the setting says.
  const [bedethequeChoice, setBedethequeChoice] = useState<boolean | null>(null);
  const bedethequeTicked = bedethequeChoice ?? settings?.bedethequeSearchByDefault ?? false;
  const sources: MetadataApiSource[] = [
    ...enabledSources.filter((source) => !unticked.has(source)),
    ...(bedethequeTicked ? (['bedetheque'] as const) : []),
  ];
  const [picking, setPicking] = useState(false);
  // Nothing is searched until the user asks: the dialog opens on the options. Only the awaited search
  // may update the dialog, so an earlier, slower answer never shows stale results; stopping a search
  // (or closing the dialog) abandons it.
  const [{ step }, dispatch] = useReducer(lookupReducer, INITIAL_LOOKUP);
  const [applying, setApplying] = useState(false);
  const searchCount = useRef(0);
  // Closing the dialog gives up what it is waiting for: the requests to the sites are aborted, not just ignored.
  useEffect(() => () => void window.tankobon.metadata.cancel(), []);
  const stop = () => {
    dispatch({ type: 'reset' });
    void window.tankobon.metadata.cancel();
  };

  const runSearch = async () => {
    const id = ++searchCount.current;
    dispatch({ type: 'searchStarted', id });
    if (mode === 'site') {
      const result = await window.tankobon.metadata.fromPage(pageUrl.trim());
      dispatch({
        type: 'searchDone',
        id,
        step:
          result.status === 'ok'
            ? { kind: 'review', candidates: [result.candidate], review: buildReview(entry, result.candidate) }
            : { kind: 'error', message: result.message },
      });
      return;
    }
    const result = await window.tankobon.metadata.search({ ...query, sources });
    dispatch({
      type: 'searchDone',
      id,
      step:
        result.status === 'ok'
          ? { kind: 'results', candidates: result.candidates, errors: result.errors }
          : { kind: 'error', message: result.message },
    });
  };

  const canSearch = mode === 'site' ? pageSourceOf(pageUrl) !== null : query.text.trim() !== '' && sources.length > 0;

  // A line of a Bédéthèque series list has no credits yet: the album's own page is read when it is picked.
  const pick = async (candidate: MetadataCandidate) => {
    if (candidate.source !== 'bedetheque' || candidate.credits.length > 0 || !candidate.sourceUrl) {
      dispatch({ type: 'picked', review: buildReview(entry, candidate) });
      return;
    }
    setPicking(true);
    const result = await window.tankobon.metadata.fromPage(candidate.sourceUrl);
    setPicking(false);
    dispatch({ type: 'picked', review: buildReview(entry, result.status === 'ok' ? result.candidate : candidate) });
  };

  const apply = async (review: MetadataReview) => {
    const update = reviewToUpdate(entry, review);
    if (isEmptyUpdate(update)) {
      onClose();
      return;
    }
    setApplying(true);
    const updated = await window.tankobon.metadata.apply(entry.id, update);
    setApplying(false);
    if (updated) onApplied(updated);
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('title')}
      description={entry.path}
      className="max-w-3xl"
    >
      <div role="tablist" className="flex gap-1">
        {(['api', 'site'] as const).map((value) => (
          <Button
            key={value}
            role="tab"
            aria-selected={mode === value}
            type="button"
            size="sm"
            variant={mode === value ? 'secondary' : 'ghost'}
            disabled={step.kind === 'searching'}
            onClick={() => {
              setMode(value);
              dispatch({ type: 'reset' });
            }}
          >
            {value === 'api' ? <Search /> : <Globe />}
            {t(value === 'api' ? 'modeApi' : 'modeSite')}
          </Button>
        ))}
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSearch && step.kind !== 'searching') void runSearch();
        }}
      >
        {mode === 'api' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label={t('queryLabel')}
                placeholder={t('queryPlaceholder')}
                className={cn(INPUT_CLASS, 'min-w-48 flex-1')}
                value={query.text}
                onChange={(event) => setQuery({ ...query, text: event.target.value })}
              />
              <input
                aria-label={t('volumeLabel')}
                placeholder={t('volumePlaceholder')}
                className={cn(INPUT_CLASS, 'w-24')}
                value={query.volume ?? ''}
                onChange={(event) => setQuery({ ...query, volume: event.target.value || null })}
              />
            </div>
            {needsRule && (
              <div className="flex flex-col gap-1 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">{t('ruleHint')}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={t('ruleLabel')}
                    placeholder={t('rulePlaceholder')}
                    list="file-name-rules"
                    className={cn(INPUT_CLASS, 'min-w-48 flex-1 font-mono')}
                    value={rule}
                    onChange={(event) => {
                      setRule(event.target.value);
                      setRuleMisses(false);
                    }}
                  />
                  <datalist id="file-name-rules">
                    {rules.map((previous) => (
                      <option key={previous} value={previous} />
                    ))}
                  </datalist>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rule === '' || ruleError !== null}
                    onClick={applyRule}
                  >
                    {t('applyRule')}
                  </Button>
                </div>
                {ruleError && <p className="text-xs text-destructive">{t('ruleInvalid')}</p>}
                {ruleMisses && <p className="text-xs text-destructive">{t('ruleNoMatch')}</p>}
              </div>
            )}
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <legend className="sr-only">{t('sourcesLabel')}</legend>
              <span className="text-muted-foreground">{t('sourcesLabel')}</span>
              {enabledSources.length === 0 && <span className="text-muted-foreground">{t('noApiEnabled')}</span>}
              {enabledSources.map((source) => (
                <label key={source} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!unticked.has(source)}
                    onChange={(event) =>
                      setUnticked((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.delete(source);
                        else next.add(source);
                        return next;
                      })
                    }
                  />
                  {METADATA_SOURCE_LABELS[source]}
                </label>
              ))}
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={bedethequeTicked}
                  onChange={(event) => setBedethequeChoice(event.target.checked)}
                />
                {METADATA_SOURCE_LABELS.bedetheque}
              </label>
            </fieldset>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <input
              aria-label={t('pageUrlLabel')}
              placeholder={t('pageUrlPlaceholder')}
              className={cn(INPUT_CLASS, 'w-full')}
              value={pageUrl}
              onChange={(event) => setPageUrl(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('pageSitesHint')}</p>
          </div>
        )}
        <div className="flex gap-2">
          {step.kind === 'searching' ? (
            <Button type="button" size="sm" variant="outline" onClick={stop}>
              <Square />
              {t('stop')}
            </Button>
          ) : (
            <Button type="submit" size="sm" variant="outline" disabled={!canSearch}>
              {mode === 'site' ? <Globe /> : <Search />}
              {t(mode === 'site' ? 'readPage' : 'search')}
            </Button>
          )}
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {step.kind === 'searching' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {mode === 'site' ? t('readingPage') : t('searching')}
          </p>
        )}
        {step.kind === 'error' && <p className="text-sm whitespace-pre-line text-destructive">{step.message}</p>}
        {step.kind === 'results' && (
          <CandidateList
            candidates={step.candidates}
            errors={step.errors}
            disabled={picking}
            onPick={(candidate) => void pick(candidate)}
          />
        )}
        {step.kind === 'review' && (
          <ReviewForm review={step.review} onChange={(review) => dispatch({ type: 'reviewChanged', review })} />
        )}
      </div>

      {step.kind === 'review' && (
        <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'backToResults' })}>
            <ArrowLeft />
            {t('otherResults')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('common:cancel')}
            </Button>
            <Button size="sm" onClick={() => void apply(step.review)} disabled={applying}>
              {t('apply')}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function candidateHeading(candidate: MetadataCandidate, t: TFunction<'metadata'>): string {
  const series = [candidate.series, candidate.volume && `#${candidate.volume}`].filter(Boolean).join(' ');
  return [series, candidate.title].filter(Boolean).join(' — ') || t('untitled');
}

function CandidateList({
  candidates,
  errors,
  disabled,
  onPick,
}: {
  candidates: MetadataCandidate[];
  errors: string[];
  disabled: boolean;
  onPick: (candidate: MetadataCandidate) => void;
}) {
  const { t } = useTranslation('metadata');
  return (
    <div className="flex flex-col gap-2">
      {errors.map((error) => (
        <p key={error} className="text-sm text-destructive">
          {error}
        </p>
      ))}
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {candidates.map((candidate) => (
            <li key={`${candidate.source}-${candidate.sourceId}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(candidate)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
              >
                {candidate.coverUrl ? (
                  <img src={candidate.coverUrl} alt="" className="h-16 w-11 shrink-0 rounded-sm object-cover" />
                ) : (
                  <div className="h-16 w-11 shrink-0 rounded-sm bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{candidateHeading(candidate, t)}</span>
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {METADATA_SOURCE_LABELS[candidate.source]}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[candidate.releaseDate, formatLanguage(candidate.language)].filter(Boolean).join(' · ')}
                  </p>
                  {candidate.credits.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[...new Set(candidate.credits.map(formatPersonName))].join(', ')}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewForm({ review, onChange }: { review: MetadataReview; onChange: (review: MetadataReview) => void }) {
  const { t } = useTranslation('metadata');
  const setField = (index: number, patch: Partial<MetadataReview['fields'][number]>) =>
    onChange({ ...review, fields: review.fields.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const setCredit = (index: number, patch: Partial<MetadataReview['credits'][number]>) =>
    onChange({ ...review, credits: review.credits.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  return (
    <div className="flex flex-col gap-4">
      {review.fields.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 pb-1 font-normal">
                <span className="sr-only">{t('accept')}</span>
              </th>
              <th className="pb-1 font-normal">{t('field')}</th>
              <th className="pb-1 font-normal">{t('current')}</th>
              <th className="pb-1 font-normal">{t('proposed')}</th>
            </tr>
          </thead>
          <tbody>
            {review.fields.map((row, index) => (
              <tr key={row.field} className={cn(!row.accepted && 'text-muted-foreground')}>
                <td className="py-1">
                  <input
                    type="checkbox"
                    aria-label={t('acceptField', { field: reviewFieldLabel(row.field) })}
                    checked={row.accepted}
                    onChange={(event) => setField(index, { accepted: event.target.checked })}
                  />
                </td>
                <td className="py-1 pr-2 whitespace-nowrap">{reviewFieldLabel(row.field)}</td>
                <td className="max-w-48 truncate py-1 pr-2" title={row.current ?? undefined}>
                  {row.current ?? '—'}
                </td>
                <td className="py-1">
                  <input
                    aria-label={t('proposedValue', { field: reviewFieldLabel(row.field) })}
                    className={cn(INPUT_CLASS, 'w-full')}
                    value={row.proposed}
                    // Editing a value means the user wants it.
                    onChange={(event) => setField(index, { proposed: event.target.value, accepted: true })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{t('authors')}</h3>
        {review.credits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noAuthors')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {review.credits.map((credit, index) => (
              <li key={credit.key} className={cn('flex items-center gap-2', !credit.accepted && 'opacity-60')}>
                <input
                  type="checkbox"
                  aria-label={t(credit.origin === 'current' ? 'keepAuthor' : 'addAuthor', { name: formatPersonName(credit) })}
                  checked={credit.accepted}
                  onChange={(event) => setCredit(index, { accepted: event.target.checked })}
                />
                <input
                  aria-label={t('firstName')}
                  placeholder={t('firstName')}
                  className={cn(INPUT_CLASS, 'w-36')}
                  value={credit.firstName}
                  onChange={(event) => setCredit(index, { firstName: event.target.value })}
                />
                <input
                  aria-label={t('lastName')}
                  placeholder={t('lastName')}
                  className={cn(INPUT_CLASS, 'w-40')}
                  value={credit.lastName}
                  onChange={(event) => setCredit(index, { lastName: event.target.value })}
                />
                <select
                  aria-label={t('role')}
                  className={cn(INPUT_CLASS, 'w-32')}
                  value={credit.role}
                  onChange={(event) => setCredit(index, { role: event.target.value as CreditRole })}
                >
                  {CREDIT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {creditRoleLabel(role)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  {credit.origin === 'current' ? t('currentTag') : t('proposedTag')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
