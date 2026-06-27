import { useSignal } from '@preact/signals';
import { CALENDAR_COLOR_OPTIONS, getColorAsHex } from '/public/ts/utils/calendar.ts';
export default function Calendars({
  initialCalendars
}) {
  const isAdding = useSignal(false);
  const isDeleting = useSignal(false);
  const isSaving = useSignal(false);
  const calendars = useSignal(initialCalendars);
  const openCalendar = useSignal(null);
  async function onClickAddCalendar() {
    if (isAdding.value) {
      return;
    }
    const name = (prompt(`What's the **name** for the new calendar?`) || '').trim();
    if (!name) {
      alert('A name is required for a new calendar!');
      return;
    }
    isAdding.value = true;
    try {
      const requestBody = {
        name
      };
      const response = await fetch(`/api/calendar/add`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to add calendar! ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to add calendar!');
      }
      calendars.value = [...result.newCalendars];
    } catch (error) {
      console.error(error);
    }
    isAdding.value = false;
  }
  async function onClickDeleteCalendar(calendarId) {
    if (confirm('Are you sure you want to delete this calendar and all its events?')) {
      if (isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        const requestBody = {
          calendarId
        };
        const response = await fetch(`/api/calendar/delete`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to delete calendar! ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to delete calendar!');
        }
        calendars.value = [...result.newCalendars];
      } catch (error) {
        console.error(error);
      }
      isDeleting.value = false;
    }
  }
  async function onClickSaveOpenCalendar() {
    if (isSaving.value) {
      return;
    }
    if (!openCalendar.value?.uid) {
      alert('A calendar is required to update one!');
      return;
    }
    if (!openCalendar.value?.displayName) {
      alert('A name is required to update the calendar!');
      return;
    }
    if (!openCalendar.value?.calendarColor) {
      alert('A color is required to update the calendar!');
      return;
    }
    isSaving.value = true;
    try {
      const requestBody = {
        id: openCalendar.value.uid,
        name: openCalendar.value.displayName,
        color: openCalendar.value.calendarColor,
        isVisible: openCalendar.value.isVisible
      };
      const response = await fetch(`/api/calendar/update`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to update calendar!');
      }
      calendars.value = [...result.newCalendars];
    } catch (error) {
      console.error(error);
    }
    isSaving.value = false;
    openCalendar.value = null;
  }
  return h(Fragment, null, h("section", {
    class: "flex flex-row items-center justify-between mb-4"
  }, h("a", {
    href: "/calendar",
    class: "mr-2"
  }, "View calendar"), h("section", {
    class: "flex items-center"
  }, h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2",
    type: "button",
    title: "Add new calendar",
    onClick: () => onClickAddCalendar()
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Add new calendar",
    class: `white ${isAdding.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  })))), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h("table", {
    class: "w-full border-collapse bg-gray-900 text-left text-sm text-white shadow-sm rounded-md"
  }, h("thead", null, h("tr", null, h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium"
  }, "Name"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium"
  }, "Color"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium"
  }, "Visible?"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium w-20"
  }))), h("tbody", {
    class: "divide-y divide-slate-600 border-t border-slate-600"
  }, calendars.value.map(calendar => h("tr", {
    class: "bg-slate-700 hover:bg-slate-600 group"
  }, h("td", {
    class: "flex gap-3 px-6 py-4 font-medium"
  }, calendar.displayName), h("td", {
    class: "px-6 py-4 text-slate-200"
  }, h("span", {
    class: `w-5 h-5 inline-block rounded-full cursor-pointer`,
    title: calendar.calendarColor,
    style: {
      backgroundColor: calendar.calendarColor
    },
    onClick: () => openCalendar.value = {
      ...calendar
    }
  })), h("td", {
    class: "px-6 py-4"
  }, calendar.isVisible ? 'Yes' : 'No'), h("td", {
    class: "px-6 py-4"
  }, h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100",
    onClick: () => onClickDeleteCalendar(calendar.uid)
  }, h("img", {
    src: "/public/images/delete.svg",
    class: "red drop-shadow-md",
    width: 24,
    height: 24,
    alt: "Delete calendar",
    title: "Delete calendar"
  }))))), calendars.value.length === 0 ? h("tr", null, h("td", {
    class: "flex gap-3 px-6 py-4 font-normal",
    colspan: 4
  }, h("div", {
    class: "text-md"
  }, h("div", {
    class: "font-medium text-slate-400"
  }, "No calendars to show")))) : null)), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isDeleting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Deleting...") : null, isSaving.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Saving...") : null, !isDeleting.value && !isSaving.value ? h(Fragment, null, "\xA0") : null)), h("section", {
    class: `fixed ${openCalendar.value ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${openCalendar.value ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, "Edit Calendar"), h("section", {
    class: "py-5 my-2 border-y border-slate-500"
  }, h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "calendar_name"
  }, "Name"), h("input", {
    class: "input-field",
    type: "text",
    name: "calendar_name",
    id: "calendar_name",
    value: openCalendar.value?.displayName || '',
    onInput: event => openCalendar.value = {
      ...openCalendar.value,
      displayName: event.currentTarget.value
    },
    placeholder: "Personal"
  })), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "calendar_color"
  }, "Color"), h("section", {
    class: "flex items-center justify-between"
  }, h("select", {
    class: "input-field mr-2 w-5/6!",
    name: "calendar_color",
    id: "calendar_color",
    value: openCalendar.value?.calendarColor || '',
    onChange: event => openCalendar.value = {
      ...openCalendar.value,
      calendarColor: event.currentTarget.value
    }
  }, CALENDAR_COLOR_OPTIONS.map(color => h("option", {
    key: color,
    value: getColorAsHex(color),
    selected: openCalendar.value?.calendarColor === getColorAsHex(color)
  }, color))), h("span", {
    class: `w-5 h-5 block rounded-full`,
    style: {
      backgroundColor: openCalendar.value?.calendarColor
    },
    title: openCalendar.value?.calendarColor
  }))), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "calendar_is_visible"
  }, "Visible?"), h("input", {
    type: "checkbox",
    name: "calendar_is_visible",
    id: "calendar_is_visible",
    value: "true",
    checked: openCalendar.value?.isVisible,
    onChange: event => openCalendar.value = {
      ...openCalendar.value,
      isVisible: event.currentTarget.checked
    }
  }))), h("footer", {
    class: "flex justify-between"
  }, h("button", {
    type: "button",
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClickSaveOpenCalendar()
  }, "Save"), h("button", {
    type: "button",
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => openCalendar.value = null
  }, "Close"))));
}