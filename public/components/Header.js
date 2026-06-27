import { capitalizeWord } from '/public/ts/utils/misc.ts';
export default function Header({
  route,
  user,
  enabledApps
}) {
  const activeClass = 'bg-slate-800 text-white rounded-md px-3 py-2 text-sm font-medium';
  const defaultClass = 'text-slate-300 hover:bg-slate-700 hover:text-white rounded-md px-3 py-2 text-sm font-medium';
  const mobileActiveClass = 'bg-slate-800 text-white block rounded-md px-3 py-2 text-base font-medium';
  const mobileDefaultClass = 'text-slate-300 hover:bg-slate-700 hover:text-white block rounded-md px-3 py-2 text-base font-medium';
  const iconWidthAndHeightInPixels = 20;
  const potentialMenuItems = enabledApps.map(app => ({
    url: `/${app}`,
    label: capitalizeWord(app)
  }));
  const menuItems = potentialMenuItems.filter(Boolean);
  if (user && !route.startsWith('/file-share')) {
    const activeMenu = menuItems.find(menu => route.startsWith(menu.url));
    let pageLabel = activeMenu?.label || '404 - Page not found';
    if (route.startsWith('/news/feeds')) {
      pageLabel = 'News feeds';
    }
    if (route.startsWith('/settings')) {
      pageLabel = 'Settings';
    }
    if (route.startsWith('/expenses')) {
      pageLabel = 'Budgets & Expenses';
    }
    if (route.startsWith('/contacts')) {
      pageLabel = 'Contacts';
    }
    if (route.startsWith('/calendar')) {
      pageLabel = 'Calendar';
    }
    return h(Fragment, null, h("nav", {
      class: "bg-slate-950"
    }, h("div", {
      class: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    }, h("div", {
      class: "flex h-16 items-center justify-between"
    }, h("div", {
      class: "flex items-center"
    }, h("div", {
      class: "shrink-0"
    }, h("a", {
      href: "/"
    }, h("img", {
      class: "h-12 w-12 drop-shadow-md",
      src: "/public/images/logomark.svg",
      alt: "a stylized blue cloud"
    }))), h("div", {
      class: "hidden md:block"
    }, h("div", {
      class: "ml-10 flex items-center space-x-4"
    }, menuItems.map(menu => h("a", {
      href: menu.url,
      class: route.startsWith(menu.url) ? activeClass : defaultClass
    }, h("img", {
      src: `/public/images${menu.url}${'.svg'}`,
      alt: menu.label,
      title: menu.label,
      width: iconWidthAndHeightInPixels,
      height: iconWidthAndHeightInPixels,
      class: "white"
    })))))), h("div", {
      class: "ml-4 flex items-center md:ml-6"
    }, h("div", {
      class: "ml-10 flex items-center space-x-4"
    }, h("span", {
      class: "mx-2 text-white text-sm"
    }, user.email), h("a", {
      href: "/settings",
      class: route.startsWith('/settings') ? activeClass : defaultClass
    }, h("img", {
      src: "/public/images/settings.svg",
      alt: "Settings",
      title: "Settings",
      width: iconWidthAndHeightInPixels,
      height: iconWidthAndHeightInPixels,
      class: "white"
    })), h("a", {
      href: "/logout",
      class: defaultClass
    }, h("img", {
      src: "/public/images/logout.svg",
      alt: "Logout",
      title: "Logout",
      width: iconWidthAndHeightInPixels,
      height: iconWidthAndHeightInPixels,
      class: "white"
    })))))), h("div", {
      class: "md:hidden",
      id: "mobile-menu"
    }, h("div", {
      class: "space-y-1 px-2 pb-3 pt-2 sm:px-3"
    }, menuItems.map(menu => h("a", {
      href: menu.url,
      class: route.startsWith(menu.url) ? mobileActiveClass : mobileDefaultClass
    }, menu.label))))), h("header", {
      class: "bg-gray-900 shadow-md"
    }, h("div", {
      class: "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
    }, h("h1", {
      class: "text-3xl font-bold tracking-tight text-white"
    }, pageLabel))));
  }
  return h("header", {
    class: "px-4 pt-8 pb-2 max-w-3xl mx-auto flex flex-col items-center justify-center"
  }, h("a", {
    href: "/"
  }, h("img", {
    class: "mt-6 mb-2 drop-shadow-md",
    src: "/public/images/logo-white.svg",
    width: "250",
    height: "50",
    alt: "the bewCloud logo: a stylized logo"
  })));
}