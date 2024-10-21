const deleteButton = document.getElementById("deleteButton");
const statusBox = document.getElementById("status");
const descriptionBox = document.getElementById("description");
const titleText = document.getElementById("title");
const filesDropdown = document.getElementById("fileSelection");
const nodesDropdown = document.getElementById("nodeSelection");

let savedNodeId;
let timer;

deleteButton.addEventListener('click', (e) => {
    e.target.style.visibility="hidden";
    e.target.style.display="none";

    deleteRequest(e.target.value);
    removePopup();
});
descriptionBox.focus();

descriptionBox.oninput = (e) => {
    if(savedNodeId) {
        let note = e.target.value;
        showStatus("Updating...");
        clearTimeout(timer);
        timer = setTimeout(() => {
            updateRequest(savedNodeId, note);
        }, 400);
    }
}

// when popup opens
window.addEventListener('DOMContentLoaded', () => {
    // create file selection dropdown
    chrome.runtime.sendMessage({"message": "files"}, (response) => {
        let fileDropDown = createDynalistFilesDropdown(response.files, response.selectionID);
        // chrome.runtime.sendMessage({"message": "nodes", "fileID": fileDropDown.value}, (response) => {
        //     createDynalistNodesDropdown(response.nodes, response.selectionID);
        // });
    });

    // save tab
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        titleText.textContent = tabs[0].title;
        saveTab(tabs[0].title, tabs[0].url);
    });
});

function createDynalistFilesDropdown(files, selectionID) {
    // console.log(files);

    let fileListSelect = document.createElement("select");
    fileListSelect.onchange = (event) => {
        let id = event.target.value;
        fileListSelect.value = id;

        chrome.storage.sync.set({'selectedFileID': id});
    }

    // populate the dropdown
    for (file of files) {
        let item;
        if (file.type == "document") {
            item = document.createElement("option");
            item.text = file.title;
            item.value = file.id;
        } else if (file.type == "folder") {
            item = document.createElement("optgroup");
            item.label = file.title;
            item.value = file.id;
        }
        fileListSelect.appendChild(item);
    }
    
    chrome.storage.sync.get(['selectedFileID'], (result) => {
        let id = result['selectedFileID'];
        
        if (id) 
            fileListSelect.value = id;
        else {
            // fileListSelect.value = dl.fileID;
        }
    });
    fileListSelect.value = selectionID;

    filesDropdown.appendChild(fileListSelect);

    return fileListSelect;
}

function createDynalistNodesDropdown(nodes, selectionID) {
    let nodeSelectElement = document.createElement("select");
    nodeSelectElement.onchange = (event) => {
        let id = event.target.value;
        nodeSelectElement.value = id;

        chrome.storage.sync.set({'inboxNodeID': id});
    }

    for (node of nodes) {
        let item;
        item = document.createElement("option");
        item.text = node.note;
        item.value = node.id;
        nodeSelectElement.appendChild(item);
    }
    
    chrome.storage.sync.get(['inboxNodeID'], (result) => {
        let id = result['inboxNodeID'];
        
        if (id) 
            nodeSelectElement.value = id;
        else {
            // nodeSelectElement.value = dl.fileID;
        }
    });
    nodeSelectElement.value = selectionID;

    nodesDropdown.appendChild(nodeSelectElement);

    return nodeSelectElement;
}

function showStatus(txt) {
    statusBox.textContent = txt;
}

function saveTab(title, url, callback) {
    showStatus("Saving...");
    
    chrome.runtime.sendMessage({"message": "add", "title": title, "url": url}, (response) => {
        if (response.error) {
            showStatus("Error saving");
            return;
        }
        showStatus("Saved");
        savedNodeId = response.newNodeID;
        //show delete button
        deleteButton.style.visibility = "visible";
        deleteButton.style.display = "inline";
        deleteButton.value = savedNodeId;
    });
}

function deleteRequest(nodeID, callback) {
    chrome.runtime.sendMessage({"message": "delete", "nodeID": nodeID}, (response) => {
        if (response.error) {
            showStatus("Error deleting");
            return;
        }
        showStatus("Deleted");
        removePopup();
    });
}

function updateRequest(nodeID, description, callback) {
    chrome.runtime.sendMessage({"message": "update", "nodeID": nodeID, "description": description}, (response) => {
        if (response.error) {
            showStatus("Error deleting");
            return;
        }
        showStatus("Updated");
    });
}

function removePopup() {
    //chrome.runtime.sendMessage({"message": "hidepopup"});
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {"message": "removepopup"});  
    });
}

