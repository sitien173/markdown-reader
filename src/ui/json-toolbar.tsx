import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Toggle } from '../components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { useT } from '../i18n';
import type { JsonIndent, JsonLayout, JsonViewOptions } from '../lib/json-document';

export interface JsonToolbarProps {
  kind: 'json' | 'jsonc';
  options: JsonViewOptions;
  unescaped: boolean;
  canUnescape: boolean;
  disabled: boolean;
  parses?: boolean;
  onChange(options: JsonViewOptions): void;
  onUnescape(): void;
  onRevert(): void;
  onDownload(): void;
}

export function JsonToolbar({
  kind,
  options,
  unescaped,
  canUnescape,
  disabled,
  parses = true,
  onChange,
  onUnescape,
  onRevert,
  onDownload,
}: JsonToolbarProps) {
  const t = useT();

  const indentDisabled = disabled || options.layout !== 'beautify' || (unescaped && !parses);
  const transformDisabled = disabled || (unescaped && !parses);

  const indentOptions = [
    { value: '2', label: t('json.indent2') },
    { value: '4', label: t('json.indent4') },
    { value: 'tab', label: t('json.indentTab') },
  ];

  return (
    <div className="json-toolbar" data-slot="json-toolbar" role="toolbar" aria-label={t('json.toolbar')}>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        disabled={transformDisabled}
        value={[options.layout]}
        onValueChange={(next) => {
          if (next[0]) {
            onChange({ ...options, layout: next[0] as JsonLayout });
          }
        }}
        aria-label={t('json.layout')}
      >
        <ToggleGroupItem value="original" aria-label={t('json.original')}>
          {t('json.original')}
        </ToggleGroupItem>
        <ToggleGroupItem value="beautify" aria-label={t('json.beautify')}>
          {t('json.beautify')}
        </ToggleGroupItem>
        <ToggleGroupItem value="minify" aria-label={t('json.minify')}>
          {t('json.minify')}
        </ToggleGroupItem>
      </ToggleGroup>

      <Select
        value={String(options.indent)}
        items={indentOptions}
        disabled={indentDisabled}
        onValueChange={(next) => {
          if (next) {
            const indent: JsonIndent = next === 'tab' ? 'tab' : (Number(next) as 2 | 4);
            onChange({ ...options, indent });
          }
        }}
      >
        <SelectTrigger size="sm" aria-label={t('json.indent')} disabled={indentDisabled}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {indentOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Toggle
        variant="outline"
        size="sm"
        pressed={options.sortKeys}
        disabled={transformDisabled}
        title={t('json.sortKeysDescription')}
        aria-label={t('json.sortKeys')}
        onPressedChange={(pressed) => {
          onChange({
            ...options,
            sortKeys: pressed,
            stripComments: pressed ? true : options.stripComments,
          });
        }}
      >
        {t('json.sortKeys')}
      </Toggle>

      {kind === 'jsonc' && (
        <Toggle
          variant="outline"
          size="sm"
          pressed={options.sortKeys || options.stripComments}
          disabled={transformDisabled || options.sortKeys}
          aria-label={t('json.stripComments')}
          onPressedChange={(pressed) => {
            onChange({ ...options, stripComments: pressed });
          }}
        >
          {t('json.stripComments')}
        </Toggle>
      )}

      <Toggle
        variant="outline"
        size="sm"
        pressed={options.escape}
        disabled={disabled}
        aria-label={t('json.escape')}
        onPressedChange={(pressed) => {
          onChange({ ...options, escape: pressed });
        }}
      >
        {t('json.escape')}
      </Toggle>

      {(canUnescape || unescaped) && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={unescaped ? onRevert : onUnescape}
          aria-label={unescaped ? t('json.revert') : t('json.unescape')}
        >
          {unescaped ? t('json.revert') : t('json.unescape')}
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={onDownload} aria-label={t('json.download')}>
        {t('json.download')}
      </Button>
    </div>
  );
}
