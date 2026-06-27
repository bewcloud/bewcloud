import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
export default function AddEventModal({
  isOpen,
  initialStartDate,
  initiallyAllDay,
  calendars,
  onClickSave,
  onClose
}) {
  const newEvent = useSignal(null);
  useEffect(() => {
    if (!isOpen) {
      newEvent.value = null;
    } else {
      const startDate = new Date(initialStartDate || new Date());
      startDate.setUTCMinutes(0);
      startDate.setUTCSeconds(0);
      startDate.setUTCMilliseconds(0);
      const endDate = new Date(startDate);
      endDate.setUTCHours(startDate.getUTCHours() + 1);
      if (initiallyAllDay) {
        startDate.setUTCHours(9);
        endDate.setUTCHours(18);
      }
      newEvent.value = {
        uid: 'new',
        url: '',
        title: '',
        calendarId: calendars[0].uid,
        startDate: startDate,
        endDate: endDate,
        isAllDay: initiallyAllDay || false,
        organizerEmail: '',
        transparency: 'opaque'
      };
    }
  }, [isOpen]);
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${newEvent.value ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-96 max-w-lg bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, "New Event"), h("section", {
    class: "py-5 my-2 border-y border-slate-500"
  }, h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "event_title"
  }, "Title"), h("input", {
    class: "input-field",
    type: "text",
    name: "event_title",
    id: "event_title",
    value: newEvent.value?.title || '',
    onInput: event => newEvent.value = {
      ...newEvent.value,
      title: event.currentTarget.value
    },
    placeholder: "Dentist"
  })), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "event_calendar"
  }, "Calendar"), h("section", {
    class: "flex items-center justify-between"
  }, h("select", {
    class: "input-field mr-2 w-5/6!",
    name: "event_calendar",
    id: "event_calendar",
    value: newEvent.value?.calendarId || '',
    onChange: event => newEvent.value = {
      ...newEvent.value,
      calendarId: event.currentTarget.value
    }
  }, calendars.map(calendar => h("option", {
    key: calendar.uid,
    value: calendar.uid
  }, calendar.displayName))), h("span", {
    class: `w-5 h-5 block rounded-full`,
    style: {
      backgroundColor: calendars.find(calendar => calendar.uid === newEvent.value?.calendarId)?.calendarColor
    },
    title: calendars.find(calendar => calendar.uid === newEvent.value?.calendarId)?.calendarColor
  }))), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "event_start_date"
  }, "Start date"), h("input", {
    class: "input-field",
    type: "datetime-local",
    name: "event_start_date",
    id: "event_start_date",
    value: newEvent.value?.startDate ? new Date(newEvent.value.startDate).toISOString().substring(0, 16) : '',
    onInput: event => newEvent.value = {
      ...newEvent.value,
      startDate: new Date(event.currentTarget.value)
    }
  }), h("aside", {
    class: "text-sm text-slate-400 p-2 "
  }, "Dates are set in the default calendar timezone, controlled by Radicale.")), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "event_end_date"
  }, "End date"), h("input", {
    class: "input-field",
    type: "datetime-local",
    name: "event_end_date",
    id: "event_end_date",
    value: newEvent.value?.endDate ? new Date(newEvent.value.endDate).toISOString().substring(0, 16) : '',
    onInput: event => newEvent.value = {
      ...newEvent.value,
      endDate: new Date(event.currentTarget.value)
    }
  }), h("aside", {
    class: "text-sm text-slate-400 p-2 "
  }, "Dates are set in the default calendar timezone, controlled by Radicale.")), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "event_is_all_day"
  }, "All-day?"), h("input", {
    type: "checkbox",
    name: "event_is_all_day",
    id: "event_is_all_day",
    value: "true",
    checked: newEvent.value?.isAllDay,
    onChange: event => newEvent.value = {
      ...newEvent.value,
      isAllDay: event.currentTarget.checked
    }
  }))), h("footer", {
    class: "flex justify-between"
  }, h("button", {
    type: "button",
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClickSave(newEvent.value)
  }, "Save"), h("button", {
    type: "button",
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClose()
  }, "Close"))));
}