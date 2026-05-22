export async function postJson(url, body, extraHeaders = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
}

export async function getURLTitle(url) {
    const resp = await fetch(url, { method: 'GET' });
    const text = await resp.text();
    return new DOMParser().parseFromString(text, 'text/html').title;
}
