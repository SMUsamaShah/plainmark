const TOKEN = "AZ04qOZcfjEpC6F-LpE7twR3ItqGKXjXx4msLPujsJFiXMdkIpj70E_JuHoC8Nyhlp7yy9bAB7GneUADirS00oLNezFoBv8kIhvX217Zt8rHYiYCC2MORzG57VKQL6hO";
const dl = new Dynalist(TOKEN);

let pageMenu; 
let linkMenu;
let selectedTextMenu;

pageMenu = chrome.contextMenus.create({
    "title": "Save page to Dynalist", 
    "contexts": ["page"],
    "onclick": (info, tab) => {
        dl.add(tab.title + " " + tab.url, null);
        //updateChromeMenu(item);
    }
});

linkMenu = chrome.contextMenus.create({
    "title": "Save link to Dynalist", 
    "contexts": ["link"],
    "onclick": async (info, tab) => {
        let urlTitle = await getURLTitle(info.linkUrl);
        let title = info.linkUrl;
        if (urlTitle) {
            title = urlTitle + " " + title;
        }
        dl.add(title, `Source: ${tab.title} ${tab.url}`);
    }
})


selectedTextMenu = chrome.contextMenus.create({
    "title": "Save '%s' to note", 
    "contexts": ["selection"],
    "onclick": (info, tab) => {
        // console.log("item " + info.menuItemId + " was clicked");
        // console.log("info: " + JSON.stringify(info));
        // console.log("tab: " + JSON.stringify(tab));
    
        let title = info.selectionText;
        let description = tab.title + " " + tab.url;
    
        dl.add(title, description);
        addContextMenu(title);
    }
});

let appendNoteMenu;
function addContextMenu(text) {
    appendNoteMenu = chrome.contextMenus.create({
        "title": "Append '%s' to " + text, 
        "contexts": ["selection"],
        "onclick": (info, tab) => {
            dl.append(info.selectionText);
        }
    });
}

function updateContextMenu(menuID) {
    chrome.contextMenus.update(menuID, {
        "title": "Append '%s' to " + text, 
        "contexts": ["selection"],
        "onclick": (info, tab) => {
            dl.append(info.selectionText);
        }
    });
}

//--------------------------- browser listener -------------------------------

// what extension button is clicked
chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {"message": "openpopup"});  
    });
});

// chrome message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.message) {
        case "files":
            sendResponse({"files": Dynalist.files, "selectionID": dl.fileID});
            break;

        case "nodes":
            dl.getNodes(request.fileID, (nodes) => {
                sendResponse({"nodes": nodes, "selectionID": dl.inboxNodeID});
            }, (error) => {
                sendResponse({"error": "Error occured while trying to get nodes"});
            });
            break;

        case "add":
            dl.add(request.title + " " + request.url, null, (newNodeID) => {
                sendResponse({"newNodeID": newNodeID});
            }, (error) => {
                sendResponse({"error": "Error occured while trying to add"});
            });
            break;

        case "update":
            dl.update(request.nodeID, request.description, (newNodeID) => {
                sendResponse({"newNodeID": newNodeID});
            }, (error) => {
                sendResponse({"error": "Error occured while trying to add"});
            });
            break;
        
        case "delete":
            dl.delete(request.nodeID, (response) => {
                sendResponse({"message": response});
            }, (error) => {
                sendResponse({"error": "Error occured while trying to delete"});
            });
            break;

        default:
            break;
    }

    return true;
});