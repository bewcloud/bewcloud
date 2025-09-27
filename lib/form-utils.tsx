export interface FormField {
  name: string;
  label: string;
  value?: string | null;
  overrideValue?: string;
  description?: string;
  placeholder?: string;
  type:
    | 'text'
    | 'email'
    | 'tel'
    | 'url'
    | 'date'
    | 'datetime-local'
    | 'number'
    | 'range'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'hidden'
    | 'password';
  step?: string;
  max?: string;
  min?: string;
  rows?: string;
  options?: {
    label: string;
    value: string;
  }[];
  checked?: boolean;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  extraClasses?: string;
}

export function getFormDataField(formData: FormData, field: string) {
  return ((formData.get(field) || '') as string).trim();
}

export function getFormDataFieldArray(formData: FormData, field: string) {
  return ((formData.getAll(field) || []) as string[]).map((value) => value.trim());
}

export function generateFieldHtml(
  field: FormField,
  formData: FormData,
) {
  let value = field.overrideValue ||
    (field.multiple ? getFormDataFieldArray(formData, field.name) : getFormDataField(formData, field.name)) ||
    field.value;

  if (typeof field.overrideValue !== 'undefined') {
    value = field.overrideValue;
  }

  if (field.type === 'hidden') {
    return generateInputHtml(field, value);
  }

  return (
    <fieldset class={`block mb-4 ${field.extraClasses || ''}`}>
      <label class='text-slate-300 block pb-1' for={`field_${field.name}`}>{field.label}</label>
      {generateInputHtml(field, value)}
      {field.description
        ? (
          <aside class={`text-sm text-slate-400 p-2 ${field.type === 'checkbox' ? 'inline' : ''}`}>
            {field.description}
          </aside>
        )
        : null}
    </fieldset>
  );
}

function generateInputHtml(
  {
    name,
    placeholder,
    type,
    options,
    step,
    max,
    min,
    rows,
    checked,
    multiple,
    disabled,
    required,
    readOnly,
  }: FormField,
  value?: string | string[] | null,
) {
  const additionalAttributes: Record<string, string | number | boolean> = {};

  if (typeof step !== 'undefined') {
    additionalAttributes.step = parseInt(step, 10);
  }
  if (typeof max !== 'undefined') {
    additionalAttributes.max = parseInt(max, 10);
  }
  if (typeof min !== 'undefined') {
    additionalAttributes.min = parseInt(min, 10);
  }
  if (typeof rows !== 'undefined') {
    additionalAttributes.rows = parseInt(rows, 10);
  }
  if (checked === true && type === 'checkbox' && value) {
    additionalAttributes.checked = true;
  }
  if (multiple === true) {
    additionalAttributes.multiple = true;
  }
  if (required === true) {
    additionalAttributes.required = true;
  }
  if (disabled === true) {
    additionalAttributes.disabled = true;
  }
  if (readOnly === true) {
    additionalAttributes.readonly = true;
  }

  if (type === 'select') {
    return (
      <select class='mt-1 input-field' id={`field_${name}`} name={name} {...additionalAttributes}>
        {options?.map((option) => (
          <option
            value={option.value}
            selected={option.value === value || (multiple && (value || [])?.includes(option.value))}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'textarea') {
    return (
      <textarea
        class='mt-1 input-field'
        id={`field_${name}`}
        name={name}
        rows={6}
        placeholder={placeholder}
        {...additionalAttributes}
      >
        {(value as string) || ''}
      </textarea>
    );
  }

  if (type === 'checkbox') {
    return (
      <input id={`field_${name}`} name={name} type={type} value={value as string || ''} {...additionalAttributes} />
    );
  }

  if (type === 'password') {
    return (
      <input
        class='mt-1 input-field'
        id={`field_${name}`}
        name={name}
        type={type}
        placeholder={placeholder || ''}
        value=''
        {...additionalAttributes}
      />
    );
  }

  return (
    <input
      class='mt-1 input-field'
      id={`field_${name}`}
      name={name}
      type={type}
      placeholder={placeholder || ''}
      value={value as string || ''}
      {...additionalAttributes}
    />
  );
}
