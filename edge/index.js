const routes = [
  {
    prefix: '/cloud-api',
    target: 'https://tk.udrone.vip/api.php',
    stripPrefix: false,
  },
  {
    prefix: '/chaoxing-passport-api',
    target: 'https://passport2-api.chaoxing.com',
    stripPrefix: true,
  },
  {
    prefix: '/chaoxing-passport',
    target: 'https://passport2.chaoxing.com',
    stripPrefix: true,
  },
];

export default {
  fetch(request) {
    return handleRequest(request);
  },
};

async function handleRequest(request) {
  const url = new URL(request.url);
  const route = routes.find(item => url.pathname.startsWith(item.prefix));

  if (!route) {
    return new Response('Not found', { status: 404 });
  }

  const targetUrl = route.stripPrefix
    ? `${route.target}${url.pathname.slice(route.prefix.length)}${url.search}`
    : route.target;

  const headers = copyRequestHeaders(request.headers);
  headers.set('origin', new URL(route.target).origin);
  headers.set('referer', `${new URL(route.target).origin}/`);

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: shouldForwardBody(request.method) ? request.body : undefined,
    redirect: 'manual',
  });

  return rewriteResponse(response);
}

function shouldForwardBody(method) {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}

function copyRequestHeaders(source) {
  const headers = new Headers();
  source.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'host' ||
      lowerKey === 'content-length' ||
      lowerKey === 'connection' ||
      lowerKey === 'accept-encoding'
    ) {
      return;
    }
    headers.set(key, value);
  });
  return headers;
}

function rewriteResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.delete('content-length');
  headers.delete('content-encoding');

  const location = headers.get('location');
  if (location) {
    headers.set('location', rewriteLocation(location));
  }

  const setCookie = headers.get('set-cookie');
  if (setCookie) {
    headers.set('set-cookie', rewriteSetCookie(setCookie));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function rewriteLocation(location) {
  return location
    .replace(/^https:\/\/passport2-api\.chaoxing\.com/i, '/chaoxing-passport-api')
    .replace(/^https:\/\/passport2\.chaoxing\.com/i, '/chaoxing-passport');
}

function rewriteSetCookie(value) {
  return value
    .replace(/;\s*Domain=[^;]+/gi, '')
    .replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
}
