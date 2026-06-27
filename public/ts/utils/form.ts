import { escapeHtml, html } from '/public/ts/utils/misc.ts';

export interface FormField {
  name: string;
  label: string;
  value?: string | string[] | null;
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
    | 'password'
    | 'file';
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
  extraAttributes?: string;
  extraInputAttributes?: string;
  extraClasses?: string;
  signupFormStep?: number;
}

export function getFormDataField(formData: FormData, field: string) {
  return ((formData.get(field) || '') as string).trim();
}

export function getFormDataFieldArray(formData: FormData, field: string) {
  return ((formData.getAll(field) || []) as string[]).map((value) => value.trim());
}

export function generateFieldHtml(field: FormField, formData: FormData) {
  let value = typeof field.overrideValue !== 'undefined'
    ? field.overrideValue
    : (field.multiple ? getFormDataFieldArray(formData, field.name) : getFormDataField(formData, field.name)) ||
      field.value;

  if (typeof field.overrideValue === 'undefined' && field.multiple && Array.isArray(value) && value.length === 0) {
    value = field.value;
  }

  if (field.type === 'hidden') {
    return html`
      ${generateInputHtml(field, value)}
    `;
  }

  return html`
    <fieldset
      class="block mb-4 ${field.extraClasses || ''}"
      ${field.extraAttributes || ''}
    >
      <label
        class="text-slate-300 block pb-1"
        for="field_${field.name}"
      >${field.label.replaceAll('\n', '<br />')}</label>
      ${generateInputHtml(field, value)} ${field.description
        ? html`
          <aside
            class="text-sm text-slate-400 p-2 ${field.type === 'checkbox' ? 'inline' : ''}"
          >
            ${field.description}
          </aside>
        `
        : ''}
    </fieldset>
  `;
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
    rows = '6',
    checked,
    multiple,
    disabled,
    required,
    readOnly,
    extraInputAttributes,
  }: FormField,
  value?: string | string[] | null,
) {
  const stepAttribute = step && `step="${step}"`;
  const maxAttribute = max && `max="${max}"`;
  const minAttribute = min && `min="${min}"`;
  const checkedAttribute = checked && type === 'checkbox' && value && 'checked';
  const multipleAttribute = multiple && 'multiple';
  const requiredAttritbute = required && 'required';
  const disabledAttribute = disabled && 'disabled';
  const readOnlyAttritubte = readOnly && 'readonly';

  const additionalAttributes = [
    stepAttribute,
    maxAttribute,
    minAttribute,
    checkedAttribute,
    multipleAttribute,
    requiredAttritbute,
    disabledAttribute,
    readOnlyAttritubte,
  ].filter(Boolean).join(' ');

  if (type === 'select') {
    return html`
      <select
        ${additionalAttributes}
        ${extraInputAttributes || ''}
        class="mt-1 input-field"
        id="field_${name}"
        name="${name}"
      >
        ${options
          ?.map(
            (option) =>
              html`
                <option
                  value="${option.value}"
                  ${option.value === value || (multiple && (value || [])?.includes(option.value)) ? 'selected' : ''}
                >
                  ${option.label}
                </option>
              `,
          )
          .join('\n')}
      </select>
    `;
  }

  if (type === 'hidden') {
    return html`
      <input
        ${additionalAttributes}
        ${extraInputAttributes || ''}
        id="field_${name}"
        name="${name}"
        type="${type}"
        value="${escapeHtml((value as string) || '')}"
        readonly
      />
    `;
  }

  if (type === 'textarea') {
    return html`
      <textarea
        ${additionalAttributes}
        ${extraInputAttributes || ''}
        class="mt-1 input-field"
        id="field_${name}"
        name="${name}"
        rows="${rows}"
        placeholder="${placeholder || ''}"
      >${escapeHtml((value as string) || '')}</textarea>
    `;
  }

  if (type === 'checkbox') {
    return html`
      <input
        ${additionalAttributes}
        ${extraInputAttributes || ''}
        id="field_${name}"
        name="${name}"
        type="${type}"
        value="${escapeHtml((value as string) || '')}"
      />
    `;
  }

  if (type === 'password') {
    return html`
      <input
        ${additionalAttributes}
        ${extraInputAttributes || ''}
        class="mt-1 input-field"
        id="field_${name}"
        name="${name}"
        type="${type}"
        placeholder="${placeholder || ''}"
        value=""
      />
    `;
  }

  if (type === 'file') {
    return html`
      <input
        ${additionalAttributes}
        ${extraInputAttributes || ''}
        class="mt-1 input-field"
        id="field_${name}"
        name="${name}"
        type="${type}"
        placeholder="${placeholder || ''}"
        value=""
      />
    `;
  }

  return html`
    <input
      ${additionalAttributes}
      ${extraInputAttributes || ''}
      class="mt-1 input-field"
      id="field_${name}"
      name="${name}"
      type="${type}"
      placeholder="${placeholder || ''}"
      value="${escapeHtml((value as string) || '')}"
    />
  `;
}
