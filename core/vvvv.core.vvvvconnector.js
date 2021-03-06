// VVVV.js -- Visual Web Client Programming
// (c) 2011 Matthias Zauner
// VVVV.js is freely distributable under the MIT license.
// Additional authors of sub components are mentioned at the specific code locations.

if (!WebSocket && MozWebSocket)
  var WebSocket = MozWebSocket;

VVVV.Core.VVVVConnector = function() {
  
  this.patches = [];
  this.patchMap = {};
  this.host = false;
  var socket = false;
  var messageQueue = [];
  var messageQueueJob = undefined;

  var that = this;
  
  this.enable = function(patch, opts) {
    opts = opts || {}
    if (!this.host)
      return;
    socket = new WebSocket(this.host+":4444", "vvvvjs");
    
    messageQueueJob = window.setInterval(function() {
      message = messageQueue.shift();
      if (message) {
        socket.send(message);
      }
    }, 300);

    var opened = false;
    socket.onopen = function() {
      opened = true;
      console.log("connected to VVVV ...");
      that.addPatch(patch);
      var subpatches = patch.getSubPatches();
      
      function delayedAddPatch(i) {
        if (subpatches[i]) {
          that.addPatch(subpatches[i]);
          window.setTimeout(function() {
            delayedAddPatch(i+1);
          }, 2000);
        }
      }
      window.setTimeout(function() { delayedAddPatch(0); }, 2000);
      
      if (opts.success)
        opts.success();
    }
    socket.onclose = function() {
      if (!opened && opts.error)
        opts.error();
      opened = false;
    }
    socket.onmessage = function(m) {
      var messages = m.data.split('UPDATE');
      for (var i=0; i<messages.length; i++) {
        var match = ("UPDATE"+messages[i]).match(/^UPDATE\/([^/]+)\/([\s\S]*)/);
        if (match) {
          if (that.patchMap[match[1]+".v4p"]) {
            _(that.patchMap[match[1]+".v4p"]).each(function(p) {
              p.doLoad(match[2]);
              p.afterUpdate();
            });
          }
          if (match[1]=="*") {
            var p = that.patchMap[Object.keys(that.patchMap)[0]][0];
            p.doLoad(match[2]);
            p.afterUpdate();
          }
        }
      }
    }
    
    $(window).unload(function() {
      console.log('closing socket ...');
      socket.close();
    })
  }
  
  this.addPatch = function(patch) {
    for (var i=0; i<this.patches.length; i++) {
      if (this.patches[i].id==patch.id)
        return;
    }
    console.log('adding patch '+patch.nodename+' to Connector');
    this.patches.push(patch);
    if (!this.patchMap[patch.nodename])
      this.patchMap[patch.nodename] = [];
    this.patchMap[patch.nodename].push(patch);
    patch.VVVVConnector = this;
    that.pushCompletePatch(patch);
    window.setTimeout(function() {
      that.pullCompletePatch(patch);
    }, 1000);
  }
  
  this.disable = function() {
    // TODO alles
    if (!this.patch)
      return;
    this.patch.VVVVConnector = undefined;
    this.patch = undefined;
    if (socket)
      socket.close();
    socket.onmessage = null;
    socket.onopen = null;
    socket = false;
  }
  
  this.pullCompletePatch = function(patch) {
    console.log('pulling patch...'+patch.nodename);
    messageQueue.push('PULL/'+patch.nodename);
  }
  
  this.pushCompletePatch = function(patch) {
    console.log('pushing patch ...'+patch.nodename);
    messageQueue.push('PUSH/'+patch.nodename+'/'+patch.XMLCode);
  }
  
  this.sendUndo = function() {
    if (socket) {
      console.log('forcing Undo ...');
      messageQueue.push('UNDO');
    }
  }
  
  this.isConnected = function() {
    return socket!==false;
  }
  
}

VVVV.Editors = {};
VVVV.Editors["Connector"] = new VVVV.Core.VVVVConnector();

VVVV.Nodes.VVVVJsConnector = function(id, graph) {
  this.constructor(id, "VVVVJsConnector (VVVVjs)", graph);
}
VVVV.Nodes.VVVVJsConnector.prototype = new VVVV.Core.Node();
