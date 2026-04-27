import Select from 'react-select';

const styles = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderColor: state.isFocused ? '#0d8b8b' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #0d8b8b' : 'none',
    '&:hover': { borderColor: '#0d8b8b' },
    fontSize: '0.875rem',
  }),
  menu: base => ({ ...base, zIndex: 50, fontSize: '0.875rem' }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0d8b8b' : state.isFocused ? '#e0f2f1' : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
  }),
};

export default function SearchableSelect({ options = [], value, onChange, placeholder, isDisabled, isClearable = true }) {
  const opts = options.map(o => (typeof o === 'string' ? { label: o, value: o } : o));
  const selected = value === undefined || value === null || value === ''
    ? null
    : opts.find(o => o.value === value) || { label: String(value), value };
  return (
    <Select
      options={opts}
      value={selected}
      onChange={opt => onChange(opt ? opt.value : '')}
      placeholder={placeholder || 'Select...'}
      isClearable={isClearable}
      isDisabled={isDisabled}
      styles={styles}
    />
  );
}
