import page from '/lib/page.ts';

function get() {
  return new Response('Redirecting...', { status: 301, headers: { 'Location': '/caldav' } });
}

export default page({
  get,
  accessMode: 'public',
});
