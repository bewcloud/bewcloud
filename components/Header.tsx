import { OptionalApp, User } from '/lib/types.ts';

interface Data {
  route: string;
  user?: User | null;
  enabledApps: OptionalApp[];
}

interface MenuItem {
  url: string;
  label: string;
}

export default function Header({ route, user, enabledApps }: Data) {
  const activeClass = 'bg-slate-800 text-white rounded-md px-3 py-2 text-sm font-medium';
  const defaultClass = 'text-slate-300 hover:bg-slate-700 hover:text-white rounded-md px-3 py-2 text-sm font-medium';

  const mobileActiveClass = 'bg-slate-800 text-white block rounded-md px-3 py-2 text-base font-medium';
  const mobileDefaultClass =
    'text-slate-300 hover:bg-slate-700 hover:text-white block rounded-md px-3 py-2 text-base font-medium';

  const iconWidthAndHeightInPixels = 20;

  const potentialMenuItems: (MenuItem | null)[] = [
    {
      url: '/dashboard',
      label: 'Dashboard',
    },
    enabledApps.includes('news')
      ? {
        url: '/news',
        label: 'News',
      }
      : null,
    {
      url: '/files',
      label: 'Files',
    },
    enabledApps.includes('notes')
      ? {
        url: '/notes',
        label: 'Notes',
      }
      : null,
    enabledApps.includes('photos')
      ? {
        url: '/photos',
        label: 'Photos',
      }
      : null,
    enabledApps.includes('expenses')
      ? {
        url: '/expenses',
        label: 'Expenses',
      }
      : null,
    enabledApps.includes('contacts')
      ? {
        url: '/contacts',
        label: 'Contacts',
      }
      : null,
    enabledApps.includes('calendar')
      ? {
        url: '/calendar',
        label: 'Calendar',
      }
      : null,
  ];

  const menuItems = potentialMenuItems.filter(Boolean) as MenuItem[];

  if (user) {
    const activeMenu = menuItems.find((menu) => route.startsWith(menu.url));

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

    return (
      <>
        <nav class='bg-slate-950'>
          <div class='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div class='flex h-16 items-center justify-between'>
              <div class='flex items-center'>
                <div class='flex-shrink-0'>
                  <a href='/'>
                    <img
                      class='h-12 w-12 drop-shadow-md'
                      src='/public/images/logomark.svg'
                      alt='a stylized blue cloud'
                    />
                  </a>
                </div>
                <div class='hidden md:block'>
                  <div class='ml-10 flex items-center space-x-4'>
                    {menuItems.map((menu) => (
                      <a href={menu.url} class={route.startsWith(menu.url) ? activeClass : defaultClass}>
                        <img
                          src={`/public/images${menu.url}${'.svg'}`}
                          alt={menu.label}
                          title={menu.label}
                          width={iconWidthAndHeightInPixels}
                          height={iconWidthAndHeightInPixels}
                          class='white'
                        />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div class='ml-4 flex items-center md:ml-6'>
                <div class='ml-10 flex items-center space-x-4'>
                  <span class='mx-2 text-white text-sm'>{user.email}</span>
                  <a
                    href='/settings'
                    class={route.startsWith('/settings') ? activeClass : defaultClass}
                  >
                    <img
                      src='/public/images/settings.svg'
                      alt='Settings'
                      title='Settings'
                      width={iconWidthAndHeightInPixels}
                      height={iconWidthAndHeightInPixels}
                      class='white'
                    />
                  </a>
                  <a
                    href='/logout'
                    class={defaultClass}
                  >
                    <img
                      src='/public/images/logout.svg'
                      alt='Logout'
                      title='Logout'
                      width={iconWidthAndHeightInPixels}
                      height={iconWidthAndHeightInPixels}
                      class='white'
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class='md:hidden' id='mobile-menu'>
            <div class='space-y-1 px-2 pb-3 pt-2 sm:px-3'>
              {menuItems.map((menu) => (
                <a href={menu.url} class={route.startsWith(menu.url) ? mobileActiveClass : mobileDefaultClass}>
                  {menu.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <header class='bg-gray-900 shadow-md'>
          <div class='mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
            <h1 class='text-3xl font-bold tracking-tight text-white'>
              {pageLabel}
            </h1>
          </div>
        </header>
      </>
    );
  }

  return (
    <header class='px-4 pt-8 pb-2 max-w-screen-md mx-auto flex flex-col items-center justify-center'>
      <a href='/'>
        <img
          class='mt-6 mb-2 drop-shadow-md'
          src='/public/images/logo-white.svg'
          width='250'
          height='50'
          alt='the bewCloud logo: a stylized logo'
        />
      </a>
    </header>
  );
}
