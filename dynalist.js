function Dynalist(token) {
    const TOKEN = token;
    this.inboxNodeID = "j9HlwFTFeNgctLIWCKWNSlwS";
    this.fileID = "arYPsTPWYxTQ0exGcIX-onPE";
    let lastCreatedNodeID;
    let lastCreatedNodeData = "";
    _this = this;
    //static
    Dynalist.files = [];


    chrome.storage.sync.set({"selectedFileID": _this.fileID});
    
    /**
     * 
     * @param {*} title 
     * @param {*} description 
     * @param {*} successCallback newly added node id
     * @param {*} errorCallback 
     */
    function _add(title, description="", successCallback, errorCallback) {
        if (!description) description = "";
        if (!title) {errorCallback("title is required"); return;};

        requestEditDynalist([{
            "action": "insert",
            "parent_id": _this.inboxNodeID,
            "index": -1, // 0 for the beginning, -1 for the end
            "content": title,
            "note": description,
            "checked": false
        }], (response) => {
            if (!response.new_node_ids || response.new_node_ids.length == 0) {
                errorCallback("no new node id found");
                return;
            }
            lastCreatedNodeID = response.new_node_ids[0];
            successCallback(lastCreatedNodeID);
        }, errorCallback);
    };

    function _update(nodeID, description, successCallback, errorCallback) {
        requestEditDynalist([{
            "action": "edit",
            "node_id": nodeID,
            "note": description,
        }], successCallback, errorCallback);
    };

    function _append(description, successCallback, errorCallback) {
        lastCreatedNodeData = lastCreatedNodeData + " " + description;
        requestEditDynalist([{
            "action": "edit",
            "node_id": lastCreatedNodeID,
            "note": lastCreatedNodeData
        }], successCallback, errorCallback);
    };

    function _delete(nodeID, successCallback, errorCallback) {
        requestEditDynalist([{
            "action": "delete",
            "node_id": nodeID
        }], successCallback, errorCallback);
    };

    function _getFileList(successCallback, errorCallback) {
        postRequestJson("https://dynalist.io/api/v1/file/list", {
            "token": TOKEN,
        }, (response) => {
            if (response._code !== "Ok") {
                if (errorCallback) errorCallback(response);
                return;
            }
            if (successCallback) successCallback(response);
        });
    }

    function _getNodesListRaw(fileID, successCallback, errorCallback) {
        postRequestJson("https://dynalist.io/api/v1/doc/read", {
            "token": TOKEN,
            "file_id": fileID,
        }, (response) => {
            if (response._code !== "Ok") {
                if (errorCallback) errorCallback(response);
                return;
            }
            if (successCallback) successCallback(response);
        });
    }

    function _getNodeListFormatted(fileID, successCallback, errorCallback) {
        _getNodesListRaw(fileID, (response) => {
            let nodeList = [];

            for (let node of response.nodes) {
                if (node.id == "root") continue;

                nodeList.push({"id": node.id, "note": node.content});
            }
            successCallback(nodeList);
        }, errorCallback);
    }

    function requestEditDynalist(changes, successCallback, errorCallback) {
        postRequestJson("https://dynalist.io/api/v1/doc/edit", {
            "token": TOKEN,
            "file_id": _this.fileID,
            "changes": changes
        }, (response) => {
            if (response._code !== "Ok") {
                if (errorCallback) errorCallback(response);
                return;
            }
            if (successCallback) successCallback(response);
        });
    }

    _getFileList((response) => {
        Dynalist.files = response.files;
    });


    // export
    this.add = _add;
    this.append = _append;
    this.delete = _delete;
    this.getFileList = _getFileList;
    this.getNodes = _getNodeListFormatted;
    this.update = _update;
}