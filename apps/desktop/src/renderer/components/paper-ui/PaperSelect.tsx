import {Label, ListBox, Select} from '@heroui/react';

type Option = {id: string; label: string; disabled?: boolean};

/** Small application composition; the installed HeroUI owns selection, portal and keyboard behavior. */
export function PaperSelect({label, value, options, onChange, disabled = false, testId, hideLabel = false}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
  hideLabel?: boolean;
}) {
  const empty = '__paper_empty__';
  return <Select aria-label={label} selectedKey={value || empty} isDisabled={disabled}
    onSelectionChange={key => onChange(key === empty || key === null ? '' : String(key))}>
    {!hideLabel && <Label>{label}</Label>}
    <Select.Trigger data-testid={testId}><Select.Value/><Select.Indicator/></Select.Trigger>
    <Select.Popover>
      <ListBox disabledKeys={options.filter(option => option.disabled).map(option => option.id || empty)}>
        {options.map(option => <ListBox.Item key={option.id || empty} id={option.id || empty} textValue={option.label}
          data-option-id={option.id}>
          <Label>{option.label}</Label><ListBox.ItemIndicator/>
        </ListBox.Item>)}
      </ListBox>
    </Select.Popover>
  </Select>;
}
