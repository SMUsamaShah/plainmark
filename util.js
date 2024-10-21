function postRequestJson(url, requestBody, callback) {
    fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        return response.json();
    }, error => console.log(error))
    .then(response => {
        if (callback) callback(response);
    }, error => console.log(error));
}

async function getURLTitle(url) {
    let resp = await fetch(url, { method: "GET" });
    let resultText = await resp.text();

    let html =  new DOMParser().parseFromString(resultText, "text/html"); // document.createElement('html');
    
    return html.title;
}