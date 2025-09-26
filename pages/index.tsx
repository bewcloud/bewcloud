import page, { RequestHandlerParams } from '/lib/page.ts';

function get({ user }: RequestHandlerParams) {
  if (user) {
    return new Response('Redirect', { status: 302, headers: { 'Location': '/dashboard' } });
  }

  return new Response('Redirect', { status: 302, headers: { 'Location': '/login' } });
}

const indexPage = page({
  get,
  accessMode: 'user',
});

export default indexPage;
