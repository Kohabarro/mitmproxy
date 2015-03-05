(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var $ = require("jquery");

var ActionTypes = {
    // Connection
    CONNECTION_OPEN: "connection_open",
    CONNECTION_CLOSE: "connection_close",
    CONNECTION_ERROR: "connection_error",

    // Stores
    SETTINGS_STORE: "settings",
    EVENT_STORE: "events",
    FLOW_STORE: "flows",
};

var StoreCmds = {
    ADD: "add",
    UPDATE: "update",
    REMOVE: "remove",
    RESET: "reset"
};

var ConnectionActions = {
    open: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_OPEN
        });
    },
    close: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_CLOSE
        });
    },
    error: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_ERROR
        });
    }
};

var SettingsActions = {
    update: function (settings) {

        $.ajax({
            type: "PUT",
            url: "/settings",
            data: settings
        });

        /*
        //Facebook Flux: We do an optimistic update on the client already.
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.SETTINGS_STORE,
            cmd: StoreCmds.UPDATE,
            data: settings
        });
        */
    }
};

var EventLogActions_event_id = 0;
var EventLogActions = {
    add_event: function (message) {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.EVENT_STORE,
            cmd: StoreCmds.ADD,
            data: {
                message: message,
                level: "web",
                id: "viewAction-" + EventLogActions_event_id++
            }
        });
    }
};

var FlowActions = {
    accept: function (flow) {
        $.post("/flows/" + flow.id + "/accept");
    },
    accept_all: function(){
        $.post("/flows/accept");
    },
    "delete": function(flow){
        $.ajax({
            type:"DELETE",
            url: "/flows/" + flow.id
        });
    },
    duplicate: function(flow){
        $.post("/flows/" + flow.id + "/duplicate");
    },
    replay: function(flow){
        $.post("/flows/" + flow.id + "/replay");
    },
    revert: function(flow){
        $.post("/flows/" + flow.id + "/revert");
    },
    update: function (flow) {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.FLOW_STORE,
            cmd: StoreCmds.UPDATE,
            data: flow
        });
    },
    clear: function(){
        $.post("/clear");
    }
};

Query = {
    FILTER: "f",
    HIGHLIGHT: "h",
    SHOW_EVENTLOG: "e"
};

module.exports = {
    ActionTypes: ActionTypes,
    ConnectionActions: ConnectionActions,
    FlowActions: FlowActions,
    StoreCmds: StoreCmds
};

},{"jquery":"jquery"}],3:[function(require,module,exports){

var React = require("react");
var ReactRouter = require("react-router");
var $ = require("jquery");

var Connection = require("./connection");
var proxyapp = require("./components/proxyapp.js");

$(function () {
    window.ws = new Connection("/updates");

    ReactRouter.run(proxyapp.routes, function (Handler) {
        React.render(React.createElement(Handler, null), document.body);
    });
});



},{"./components/proxyapp.js":12,"./connection":14,"jquery":"jquery","react":"react","react-router":"react-router"}],4:[function(require,module,exports){
var React = require("react");
var ReactRouter = require("react-router");
var _ = require("lodash");

// http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html (also contains inverse example)
var AutoScrollMixin = {
    componentWillUpdate: function () {
        var node = this.getDOMNode();
        this._shouldScrollBottom = (
            node.scrollTop !== 0 &&
            node.scrollTop + node.clientHeight === node.scrollHeight
        );
    },
    componentDidUpdate: function () {
        if (this._shouldScrollBottom) {
            var node = this.getDOMNode();
            node.scrollTop = node.scrollHeight;
        }
    },
};


var StickyHeadMixin = {
    adjustHead: function () {
        // Abusing CSS transforms to set the element
        // referenced as head into some kind of position:sticky.
        var head = this.refs.head.getDOMNode();
        head.style.transform = "translate(0," + this.getDOMNode().scrollTop + "px)";
    }
};


var Navigation = _.extend({}, ReactRouter.Navigation, {
    setQuery: function (dict) {
        var q = this.context.getCurrentQuery();
        for(var i in dict){
            if(dict.hasOwnProperty(i)){
                q[i] = dict[i] || undefined; //falsey values shall be removed.
            }
        }
        q._ = "_"; // workaround for https://github.com/rackt/react-router/pull/599
        this.replaceWith(this.context.getCurrentPath(), this.context.getCurrentParams(), q);
    },
    replaceWith: function(routeNameOrPath, params, query) {
        if(routeNameOrPath === undefined){
            routeNameOrPath = this.context.getCurrentPath();
        }
        if(params === undefined){
            params = this.context.getCurrentParams();
        }
        if(query === undefined){
            query = this.context.getCurrentQuery();
        }
        ReactRouter.Navigation.replaceWith.call(this, routeNameOrPath, params, query);
    }
});
_.extend(Navigation.contextTypes, ReactRouter.State.contextTypes);

var State = _.extend({}, ReactRouter.State, {
    getInitialState: function () {
        this._query = this.context.getCurrentQuery();
        this._queryWatches = [];
        return null;
    },
    onQueryChange: function (key, callback) {
        this._queryWatches.push({
            key: key,
            callback: callback
        });
    },
    componentWillReceiveProps: function (nextProps, nextState) {
        var q = this.context.getCurrentQuery();
        for (var i = 0; i < this._queryWatches.length; i++) {
            var watch = this._queryWatches[i];
            if (this._query[watch.key] !== q[watch.key]) {
                watch.callback(this._query[watch.key], q[watch.key], watch.key);
            }
        }
        this._query = q;
    }
});

var Splitter = React.createClass({displayName: "Splitter",
    getDefaultProps: function () {
        return {
            axis: "x"
        };
    },
    getInitialState: function () {
        return {
            applied: false,
            startX: false,
            startY: false
        };
    },
    onMouseDown: function (e) {
        this.setState({
            startX: e.pageX,
            startY: e.pageY
        });
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
        // Occasionally, only a dragEnd event is triggered, but no mouseUp.
        window.addEventListener("dragend", this.onDragEnd);
    },
    onDragEnd: function () {
        this.getDOMNode().style.transform = "";
        window.removeEventListener("dragend", this.onDragEnd);
        window.removeEventListener("mouseup", this.onMouseUp);
        window.removeEventListener("mousemove", this.onMouseMove);
    },
    onMouseUp: function (e) {
        this.onDragEnd();

        var node = this.getDOMNode();
        var prev = node.previousElementSibling;
        var next = node.nextElementSibling;

        var dX = e.pageX - this.state.startX;
        var dY = e.pageY - this.state.startY;
        var flexBasis;
        if (this.props.axis === "x") {
            flexBasis = prev.offsetWidth + dX;
        } else {
            flexBasis = prev.offsetHeight + dY;
        }

        prev.style.flex = "0 0 " + Math.max(0, flexBasis) + "px";
        next.style.flex = "1 1 auto";

        this.setState({
            applied: true
        });
        this.onResize();
    },
    onMouseMove: function (e) {
        var dX = 0, dY = 0;
        if (this.props.axis === "x") {
            dX = e.pageX - this.state.startX;
        } else {
            dY = e.pageY - this.state.startY;
        }
        this.getDOMNode().style.transform = "translate(" + dX + "px," + dY + "px)";
    },
    onResize: function () {
        // Trigger a global resize event. This notifies components that employ virtual scrolling
        // that their viewport may have changed.
        window.setTimeout(function () {
            window.dispatchEvent(new CustomEvent("resize"));
        }, 1);
    },
    reset: function (willUnmount) {
        if (!this.state.applied) {
            return;
        }
        var node = this.getDOMNode();
        var prev = node.previousElementSibling;
        var next = node.nextElementSibling;

        prev.style.flex = "";
        next.style.flex = "";

        if (!willUnmount) {
            this.setState({
                applied: false
            });
        }
        this.onResize();
    },
    componentWillUnmount: function () {
        this.reset(true);
    },
    render: function () {
        var className = "splitter";
        if (this.props.axis === "x") {
            className += " splitter-x";
        } else {
            className += " splitter-y";
        }
        return (
            React.createElement("div", {className: className}, 
                React.createElement("div", {onMouseDown: this.onMouseDown, draggable: "true"})
            )
        );
    }
});

module.exports = {
    State: State,
    Navigation: Navigation,
    StickyHeadMixin: StickyHeadMixin,
    AutoScrollMixin: AutoScrollMixin,
    Splitter: Splitter
}

},{"lodash":"lodash","react":"react","react-router":"react-router"}],5:[function(require,module,exports){
var React = require("react");
var common = require("./common.js");
var VirtualScrollMixin = require("./virtualscroll.js");
var views = require("../store/view.js");

var LogMessage = React.createClass({displayName: "LogMessage",
    render: function () {
        var entry = this.props.entry;
        var indicator;
        switch (entry.level) {
            case "web":
                indicator = React.createElement("i", {className: "fa fa-fw fa-html5"});
                break;
            case "debug":
                indicator = React.createElement("i", {className: "fa fa-fw fa-bug"});
                break;
            default:
                indicator = React.createElement("i", {className: "fa fa-fw fa-info"});
        }
        return (
            React.createElement("div", null, 
                indicator, " ", entry.message
            )
        );
    },
    shouldComponentUpdate: function () {
        return false; // log entries are immutable.
    }
});

var EventLogContents = React.createClass({displayName: "EventLogContents",
    mixins: [common.AutoScrollMixin, VirtualScrollMixin],
    getInitialState: function () {
        return {
            log: []
        };
    },
    componentWillMount: function () {
        this.openView(this.props.eventStore);
    },
    componentWillUnmount: function () {
        this.closeView();
    },
    openView: function (store) {
        var view = new views.StoreView(store, function (entry) {
            return this.props.filter[entry.level];
        }.bind(this));
        this.setState({
            view: view
        });

        view.addListener("add", this.onEventLogChange);
        view.addListener("recalculate", this.onEventLogChange);
    },
    closeView: function () {
        this.state.view.close();
    },
    onEventLogChange: function () {
        this.setState({
            log: this.state.view.list
        });
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.filter !== this.props.filter) {
            this.props.filter = nextProps.filter; // Dirty: Make sure that view filter sees the update.
            this.state.view.recalculate();
        }
        if (nextProps.eventStore !== this.props.eventStore) {
            this.closeView();
            this.openView(nextProps.eventStore);
        }
    },
    getDefaultProps: function () {
        return {
            rowHeight: 45,
            rowHeightMin: 15,
            placeholderTagName: "div"
        };
    },
    renderRow: function (elem) {
        return React.createElement(LogMessage, {key: elem.id, entry: elem});
    },
    render: function () {
        var rows = this.renderRows(this.state.log);

        return React.createElement("pre", {onScroll: this.onScroll}, 
             this.getPlaceholderTop(this.state.log.length), 
            rows, 
             this.getPlaceholderBottom(this.state.log.length) 
        );
    }
});

var ToggleFilter = React.createClass({displayName: "ToggleFilter",
    toggle: function (e) {
        e.preventDefault();
        return this.props.toggleLevel(this.props.name);
    },
    render: function () {
        var className = "label ";
        if (this.props.active) {
            className += "label-primary";
        } else {
            className += "label-default";
        }
        return (
            React.createElement("a", {
                href: "#", 
                className: className, 
                onClick: this.toggle}, 
                this.props.name
            )
        );
    }
});

var EventLog = React.createClass({displayName: "EventLog",
    getInitialState: function () {
        return {
            filter: {
                "debug": false,
                "info": true,
                "web": true
            }
        };
    },
    close: function () {
        var d = {};
        d[Query.SHOW_EVENTLOG] = undefined;
        this.setQuery(d);
    },
    toggleLevel: function (level) {
        var filter = _.extend({}, this.state.filter);
        filter[level] = !filter[level];
        this.setState({filter: filter});
    },
    render: function () {
        return (
            React.createElement("div", {className: "eventlog"}, 
                React.createElement("div", null, 
                    "Eventlog", 
                    React.createElement("div", {className: "pull-right"}, 
                        React.createElement(ToggleFilter, {name: "debug", active: this.state.filter.debug, toggleLevel: this.toggleLevel}), 
                        React.createElement(ToggleFilter, {name: "info", active: this.state.filter.info, toggleLevel: this.toggleLevel}), 
                        React.createElement(ToggleFilter, {name: "web", active: this.state.filter.web, toggleLevel: this.toggleLevel}), 
                        React.createElement("i", {onClick: this.close, className: "fa fa-close"})
                    )

                ), 
                React.createElement(EventLogContents, {filter: this.state.filter, eventStore: this.props.eventStore})
            )
        );
    }
});

module.exports = EventLog;

},{"../store/view.js":19,"./common.js":4,"./virtualscroll.js":13,"react":"react"}],6:[function(require,module,exports){
var React = require("react");
var _ = require("lodash");

var common = require("./common.js");
var actions = require("../actions.js");
var flowutils = require("../flow/utils.js");
var toputils = require("../utils.js");

var NavAction = React.createClass({displayName: "NavAction",
    onClick: function (e) {
        e.preventDefault();
        this.props.onClick();
    },
    render: function () {
        return (
            React.createElement("a", {title: this.props.title, 
                href: "#", 
                className: "nav-action", 
                onClick: this.onClick}, 
                React.createElement("i", {className: "fa fa-fw " + this.props.icon})
            )
        );
    }
});

var FlowDetailNav = React.createClass({displayName: "FlowDetailNav",
    render: function () {
        var flow = this.props.flow;

        var tabs = this.props.tabs.map(function (e) {
            var str = e.charAt(0).toUpperCase() + e.slice(1);
            var className = this.props.active === e ? "active" : "";
            var onClick = function (event) {
                this.props.selectTab(e);
                event.preventDefault();
            }.bind(this);
            return React.createElement("a", {key: e, 
                href: "#", 
                className: className, 
                onClick: onClick}, str);
        }.bind(this));

        var acceptButton = null;
        if(flow.intercepted){
            acceptButton = React.createElement(NavAction, {title: "[a]ccept intercepted flow", icon: "fa-play", onClick: actions.FlowActions.accept.bind(null, flow)});
        }
        var revertButton = null;
        if(flow.modified){
            revertButton = React.createElement(NavAction, {title: "revert changes to flow [V]", icon: "fa-history", onClick: actions.FlowActions.revert.bind(null, flow)});
        }

        return (
            React.createElement("nav", {ref: "head", className: "nav-tabs nav-tabs-sm"}, 
                tabs, 
                React.createElement(NavAction, {title: "[d]elete flow", icon: "fa-trash", onClick: actions.FlowActions.delete.bind(null, flow)}), 
                React.createElement(NavAction, {title: "[D]uplicate flow", icon: "fa-copy", onClick: actions.FlowActions.duplicate.bind(null, flow)}), 
                React.createElement(NavAction, {disabled: true, title: "[r]eplay flow", icon: "fa-repeat", onClick: actions.FlowActions.replay.bind(null, flow)}), 
                acceptButton, 
                revertButton
            )
        );
    }
});

var Headers = React.createClass({displayName: "Headers",
    render: function () {
        var rows = this.props.message.headers.map(function (header, i) {
            return (
                React.createElement("tr", {key: i}, 
                    React.createElement("td", {className: "header-name"}, header[0] + ":"), 
                    React.createElement("td", {className: "header-value"}, header[1])
                )
            );
        });
        return (
            React.createElement("table", {className: "header-table"}, 
                React.createElement("tbody", null, 
                    rows
                )
            )
        );
    }
});

var FlowDetailRequest = React.createClass({displayName: "FlowDetailRequest",
    render: function () {
        var flow = this.props.flow;
        var first_line = [
            flow.request.method,
            flowutils.RequestUtils.pretty_url(flow.request),
            "HTTP/" + flow.request.httpversion.join(".")
        ].join(" ");
        var content = null;
        if (flow.request.contentLength > 0) {
            content = "Request Content Size: " + toputils.formatSize(flow.request.contentLength);
        } else {
            content = React.createElement("div", {className: "alert alert-info"}, "No Content");
        }

        //TODO: Styling

        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "first-line"}, first_line ), 
                React.createElement(Headers, {message: flow.request}), 
                React.createElement("hr", null), 
                content
            )
        );
    }
});

var FlowDetailResponse = React.createClass({displayName: "FlowDetailResponse",
    render: function () {
        var flow = this.props.flow;
        var first_line = [
            "HTTP/" + flow.response.httpversion.join("."),
            flow.response.code,
            flow.response.msg
        ].join(" ");
        var content = null;
        if (flow.response.contentLength > 0) {
            content = "Response Content Size: " + toputils.formatSize(flow.response.contentLength);
        } else {
            content = React.createElement("div", {className: "alert alert-info"}, "No Content");
        }

        //TODO: Styling

        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "first-line"}, first_line ), 
                React.createElement(Headers, {message: flow.response}), 
                React.createElement("hr", null), 
                content
            )
        );
    }
});

var FlowDetailError = React.createClass({displayName: "FlowDetailError",
    render: function () {
        var flow = this.props.flow;
        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "alert alert-warning"}, 
                flow.error.msg, 
                    React.createElement("div", null, 
                        React.createElement("small", null,  toputils.formatTimeStamp(flow.error.timestamp) )
                    )
                )
            )
        );
    }
});

var TimeStamp = React.createClass({displayName: "TimeStamp",
    render: function () {

        if (!this.props.t) {
            //should be return null, but that triggers a React bug.
            return React.createElement("tr", null);
        }

        var ts = toputils.formatTimeStamp(this.props.t);

        var delta;
        if (this.props.deltaTo) {
            delta = toputils.formatTimeDelta(1000 * (this.props.t - this.props.deltaTo));
            delta = React.createElement("span", {className: "text-muted"}, "(" + delta + ")");
        } else {
            delta = null;
        }

        return React.createElement("tr", null, 
            React.createElement("td", null, this.props.title + ":"), 
            React.createElement("td", null, ts, " ", delta)
        );
    }
});

var ConnectionInfo = React.createClass({displayName: "ConnectionInfo",

    render: function () {
        var conn = this.props.conn;
        var address = conn.address.address.join(":");

        var sni = React.createElement("tr", {key: "sni"}); //should be null, but that triggers a React bug.
        if (conn.sni) {
            sni = React.createElement("tr", {key: "sni"}, 
                React.createElement("td", null, 
                    React.createElement("abbr", {title: "TLS Server Name Indication"}, "TLS SNI:")
                ), 
                React.createElement("td", null, conn.sni)
            );
        }
        return (
            React.createElement("table", {className: "connection-table"}, 
                React.createElement("tbody", null, 
                    React.createElement("tr", {key: "address"}, 
                        React.createElement("td", null, "Address:"), 
                        React.createElement("td", null, address)
                    ), 
                    sni
                )
            )
        );
    }
});

var CertificateInfo = React.createClass({displayName: "CertificateInfo",
    render: function () {
        //TODO: We should fetch human-readable certificate representation
        // from the server
        var flow = this.props.flow;
        var client_conn = flow.client_conn;
        var server_conn = flow.server_conn;

        var preStyle = {maxHeight: 100};
        return (
            React.createElement("div", null, 
            client_conn.cert ? React.createElement("h4", null, "Client Certificate") : null, 
            client_conn.cert ? React.createElement("pre", {style: preStyle}, client_conn.cert) : null, 

            server_conn.cert ? React.createElement("h4", null, "Server Certificate") : null, 
            server_conn.cert ? React.createElement("pre", {style: preStyle}, server_conn.cert) : null
            )
        );
    }
});

var Timing = React.createClass({displayName: "Timing",
    render: function () {
        var flow = this.props.flow;
        var sc = flow.server_conn;
        var cc = flow.client_conn;
        var req = flow.request;
        var resp = flow.response;

        var timestamps = [
            {
                title: "Server conn. initiated",
                t: sc.timestamp_start,
                deltaTo: req.timestamp_start
            }, {
                title: "Server conn. TCP handshake",
                t: sc.timestamp_tcp_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "Server conn. SSL handshake",
                t: sc.timestamp_ssl_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "Client conn. established",
                t: cc.timestamp_start,
                deltaTo: req.timestamp_start
            }, {
                title: "Client conn. SSL handshake",
                t: cc.timestamp_ssl_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "First request byte",
                t: req.timestamp_start,
            }, {
                title: "Request complete",
                t: req.timestamp_end,
                deltaTo: req.timestamp_start
            }
        ];

        if (flow.response) {
            timestamps.push(
                {
                    title: "First response byte",
                    t: resp.timestamp_start,
                    deltaTo: req.timestamp_start
                }, {
                    title: "Response complete",
                    t: resp.timestamp_end,
                    deltaTo: req.timestamp_start
                }
            );
        }

        //Add unique key for each row.
        timestamps.forEach(function (e) {
            e.key = e.title;
        });

        timestamps = _.sortBy(timestamps, 't');

        var rows = timestamps.map(function (e) {
            return React.createElement(TimeStamp, React.__spread({},  e));
        });

        return (
            React.createElement("div", null, 
                React.createElement("h4", null, "Timing"), 
                React.createElement("table", {className: "timing-table"}, 
                    React.createElement("tbody", null, 
                    rows
                    )
                )
            )
        );
    }
});

var FlowDetailConnectionInfo = React.createClass({displayName: "FlowDetailConnectionInfo",
    render: function () {
        var flow = this.props.flow;
        var client_conn = flow.client_conn;
        var server_conn = flow.server_conn;
        return (
            React.createElement("section", null, 

                React.createElement("h4", null, "Client Connection"), 
                React.createElement(ConnectionInfo, {conn: client_conn}), 

                React.createElement("h4", null, "Server Connection"), 
                React.createElement(ConnectionInfo, {conn: server_conn}), 

                React.createElement(CertificateInfo, {flow: flow}), 

                React.createElement(Timing, {flow: flow})

            )
        );
    }
});

var allTabs = {
    request: FlowDetailRequest,
    response: FlowDetailResponse,
    error: FlowDetailError,
    details: FlowDetailConnectionInfo
};

var FlowDetail = React.createClass({displayName: "FlowDetail",
    mixins: [common.StickyHeadMixin, common.Navigation, common.State],
    getTabs: function (flow) {
        var tabs = [];
        ["request", "response", "error"].forEach(function (e) {
            if (flow[e]) {
                tabs.push(e);
            }
        });
        tabs.push("details");
        return tabs;
    },
    nextTab: function (i) {
        var tabs = this.getTabs(this.props.flow);
        var currentIndex = tabs.indexOf(this.getParams().detailTab);
        // JS modulo operator doesn't correct negative numbers, make sure that we are positive.
        var nextIndex = (currentIndex + i + tabs.length) % tabs.length;
        this.selectTab(tabs[nextIndex]);
    },
    selectTab: function (panel) {
        this.replaceWith(
            "flow",
            {
                flowId: this.getParams().flowId,
                detailTab: panel
            }
        );
    },
    render: function () {
        var flow = this.props.flow;
        var tabs = this.getTabs(flow);
        var active = this.getParams().detailTab;

        if (!_.contains(tabs, active)) {
            if (active === "response" && flow.error) {
                active = "error";
            } else if (active === "error" && flow.response) {
                active = "response";
            } else {
                active = tabs[0];
            }
            this.selectTab(active);
        }

        var Tab = allTabs[active];
        return (
            React.createElement("div", {className: "flow-detail", onScroll: this.adjustHead}, 
                React.createElement(FlowDetailNav, {ref: "head", 
                    flow: flow, 
                    tabs: tabs, 
                    active: active, 
                    selectTab: this.selectTab}), 
                React.createElement(Tab, {flow: flow})
            )
        );
    }
});

module.exports = {
    FlowDetail: FlowDetail
};

},{"../actions.js":2,"../flow/utils.js":17,"../utils.js":20,"./common.js":4,"lodash":"lodash","react":"react"}],7:[function(require,module,exports){
var React = require("react");
var flowutils = require("../flow/utils.js");
var utils = require("../utils.js");

var TLSColumn = React.createClass({displayName: "TLSColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "tls", className: "col-tls"});
        }
    },
    render: function () {
        var flow = this.props.flow;
        var ssl = (flow.request.scheme == "https");
        var classes;
        if (ssl) {
            classes = "col-tls col-tls-https";
        } else {
            classes = "col-tls col-tls-http";
        }
        return React.createElement("td", {className: classes});
    }
});


var IconColumn = React.createClass({displayName: "IconColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "icon", className: "col-icon"});
        }
    },
    render: function () {
        var flow = this.props.flow;

        var icon;
        if (flow.response) {
            var contentType = flowutils.ResponseUtils.getContentType(flow.response);

            //TODO: We should assign a type to the flow somewhere else.
            if (flow.response.code == 304) {
                icon = "resource-icon-not-modified";
            } else if (300 <= flow.response.code && flow.response.code < 400) {
                icon = "resource-icon-redirect";
            } else if (contentType && contentType.indexOf("image") >= 0) {
                icon = "resource-icon-image";
            } else if (contentType && contentType.indexOf("javascript") >= 0) {
                icon = "resource-icon-js";
            } else if (contentType && contentType.indexOf("css") >= 0) {
                icon = "resource-icon-css";
            } else if (contentType && contentType.indexOf("html") >= 0) {
                icon = "resource-icon-document";
            }
        }
        if (!icon) {
            icon = "resource-icon-plain";
        }


        icon += " resource-icon";
        return React.createElement("td", {className: "col-icon"}, 
            React.createElement("div", {className: icon})
        );
    }
});

var PathColumn = React.createClass({displayName: "PathColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "path", className: "col-path"}, "Path");
        }
    },
    render: function () {
        var flow = this.props.flow;
        return React.createElement("td", {className: "col-path"}, 
            flow.request.is_replay ? React.createElement("i", {className: "fa fa-fw fa-repeat pull-right"}) : null, 
            flow.intercepted ? React.createElement("i", {className: "fa fa-fw fa-pause pull-right"}) : null, 
            flow.request.scheme + "://" + flow.request.host + flow.request.path
        );
    }
});


var MethodColumn = React.createClass({displayName: "MethodColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "method", className: "col-method"}, "Method");
        }
    },
    render: function () {
        var flow = this.props.flow;
        return React.createElement("td", {className: "col-method"}, flow.request.method);
    }
});


var StatusColumn = React.createClass({displayName: "StatusColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "status", className: "col-status"}, "Status");
        }
    },
    render: function () {
        var flow = this.props.flow;
        var status;
        if (flow.response) {
            status = flow.response.code;
        } else {
            status = null;
        }
        return React.createElement("td", {className: "col-status"}, status);
    }
});


var SizeColumn = React.createClass({displayName: "SizeColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "size", className: "col-size"}, "Size");
        }
    },
    render: function () {
        var flow = this.props.flow;

        var total = flow.request.contentLength;
        if (flow.response) {
            total += flow.response.contentLength || 0;
        }
        var size = utils.formatSize(total);
        return React.createElement("td", {className: "col-size"}, size);
    }
});


var TimeColumn = React.createClass({displayName: "TimeColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "time", className: "col-time"}, "Time");
        }
    },
    render: function () {
        var flow = this.props.flow;
        var time;
        if (flow.response) {
            time = utils.formatTimeDelta(1000 * (flow.response.timestamp_end - flow.request.timestamp_start));
        } else {
            time = "...";
        }
        return React.createElement("td", {className: "col-time"}, time);
    }
});


var all_columns = [
    TLSColumn,
    IconColumn,
    PathColumn,
    MethodColumn,
    StatusColumn,
    SizeColumn,
    TimeColumn];


module.exports = all_columns;




},{"../flow/utils.js":17,"../utils.js":20,"react":"react"}],8:[function(require,module,exports){
var React = require("react");
var common = require("./common.js");
var VirtualScrollMixin = require("./virtualscroll.js");
var flowtable_columns = require("./flowtable-columns.js");

var FlowRow = React.createClass({displayName: "FlowRow",
    render: function () {
        var flow = this.props.flow;
        var columns = this.props.columns.map(function (Column) {
            return React.createElement(Column, {key: Column.displayName, flow: flow});
        }.bind(this));
        var className = "";
        if (this.props.selected) {
            className += " selected";
        }
        if (this.props.highlighted) {
            className += " highlighted";
        }
        if (flow.intercepted) {
            className += " intercepted";
        }
        if (flow.request) {
            className += " has-request";
        }
        if (flow.response) {
            className += " has-response";
        }

        return (
            React.createElement("tr", {className: className, onClick: this.props.selectFlow.bind(null, flow)}, 
                columns
            ));
    },
    shouldComponentUpdate: function (nextProps) {
        return true;
        // Further optimization could be done here
        // by calling forceUpdate on flow updates, selection changes and column changes.
        //return (
        //(this.props.columns.length !== nextProps.columns.length) ||
        //(this.props.selected !== nextProps.selected)
        //);
    }
});

var FlowTableHead = React.createClass({displayName: "FlowTableHead",
    render: function () {
        var columns = this.props.columns.map(function (column) {
            return column.renderTitle();
        }.bind(this));
        return React.createElement("thead", null, 
            React.createElement("tr", null, columns)
        );
    }
});


var ROW_HEIGHT = 32;

var FlowTable = React.createClass({displayName: "FlowTable",
    mixins: [common.StickyHeadMixin, common.AutoScrollMixin, VirtualScrollMixin],
    getInitialState: function () {
        return {
            columns: flowtable_columns
        };
    },
    componentWillMount: function () {
        if (this.props.view) {
            this.props.view.addListener("add", this.onChange);
            this.props.view.addListener("update", this.onChange);
            this.props.view.addListener("remove", this.onChange);
            this.props.view.addListener("recalculate", this.onChange);
        }
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.view !== this.props.view) {
            if (this.props.view) {
                this.props.view.removeListener("add");
                this.props.view.removeListener("update");
                this.props.view.removeListener("remove");
                this.props.view.removeListener("recalculate");
            }
            nextProps.view.addListener("add", this.onChange);
            nextProps.view.addListener("update", this.onChange);
            nextProps.view.addListener("remove", this.onChange);
            nextProps.view.addListener("recalculate", this.onChange);
        }
    },
    getDefaultProps: function () {
        return {
            rowHeight: ROW_HEIGHT
        };
    },
    onScrollFlowTable: function () {
        this.adjustHead();
        this.onScroll();
    },
    onChange: function () {
        this.forceUpdate();
    },
    scrollIntoView: function (flow) {
        this.scrollRowIntoView(
            this.props.view.index(flow),
            this.refs.body.getDOMNode().offsetTop
        );
    },
    renderRow: function (flow) {
        var selected = (flow === this.props.selected);
        var highlighted =
            (
            this.props.view._highlight &&
            this.props.view._highlight[flow.id]
            );

        return React.createElement(FlowRow, {key: flow.id, 
            ref: flow.id, 
            flow: flow, 
            columns: this.state.columns, 
            selected: selected, 
            highlighted: highlighted, 
            selectFlow: this.props.selectFlow}
        );
    },
    render: function () {
        //console.log("render flowtable", this.state.start, this.state.stop, this.props.selected);
        var flows = this.props.view ? this.props.view.list : [];

        var rows = this.renderRows(flows);

        return (
            React.createElement("div", {className: "flow-table", onScroll: this.onScrollFlowTable}, 
                React.createElement("table", null, 
                    React.createElement(FlowTableHead, {ref: "head", 
                        columns: this.state.columns}), 
                    React.createElement("tbody", {ref: "body"}, 
                         this.getPlaceholderTop(flows.length), 
                        rows, 
                         this.getPlaceholderBottom(flows.length) 
                    )
                )
            )
        );
    }
});

module.exports = FlowTable;


},{"./common.js":4,"./flowtable-columns.js":7,"./virtualscroll.js":13,"react":"react"}],9:[function(require,module,exports){
var React = require("react");

var Footer = React.createClass({displayName: "Footer",
    render: function () {
        var mode = this.props.settings.mode;
        var intercept = this.props.settings.intercept;
        return (
            React.createElement("footer", null, 
                mode != "regular" ? React.createElement("span", {className: "label label-success"}, mode, " mode") : null, 
                " ", 
                intercept ? React.createElement("span", {className: "label label-success"}, "Intercept: ", intercept) : null
            )
        );
    }
});

module.exports = Footer;

},{"react":"react"}],10:[function(require,module,exports){
var React = require("react");
var $ = require("jquery");

var Filt = require("../filt/filt.js");
var utils = require("../utils.js");

var common = require("./common.js");

var FilterDocs = React.createClass({displayName: "FilterDocs",
    statics: {
        xhr: false,
        doc: false
    },
    componentWillMount: function () {
        if (!FilterDocs.doc) {
            FilterDocs.xhr = $.getJSON("/filter-help").done(function (doc) {
                FilterDocs.doc = doc;
                FilterDocs.xhr = false;
            });
        }
        if (FilterDocs.xhr) {
            FilterDocs.xhr.done(function () {
                this.forceUpdate();
            }.bind(this));
        }
    },
    render: function () {
        if (!FilterDocs.doc) {
            return React.createElement("i", {className: "fa fa-spinner fa-spin"});
        } else {
            var commands = FilterDocs.doc.commands.map(function (c) {
                return React.createElement("tr", null, 
                    React.createElement("td", null, c[0].replace(" ", '\u00a0')), 
                    React.createElement("td", null, c[1])
                );
            });
            commands.push(React.createElement("tr", null, 
                React.createElement("td", {colSpan: "2"}, 
                    React.createElement("a", {href: "https://mitmproxy.org/doc/features/filters.html", 
                        target: "_blank"}, 
                        React.createElement("i", {className: "fa fa-external-link"}), 
                    "  mitmproxy docs")
                )
            ));
            return React.createElement("table", {className: "table table-condensed"}, 
                React.createElement("tbody", null, commands)
            );
        }
    }
});
var FilterInput = React.createClass({displayName: "FilterInput",
    getInitialState: function () {
        // Consider both focus and mouseover for showing/hiding the tooltip,
        // because onBlur of the input is triggered before the click on the tooltip
        // finalized, hiding the tooltip just as the user clicks on it.
        return {
            value: this.props.value,
            focus: false,
            mousefocus: false
        };
    },
    componentWillReceiveProps: function (nextProps) {
        this.setState({value: nextProps.value});
    },
    onChange: function (e) {
        var nextValue = e.target.value;
        this.setState({
            value: nextValue
        });
        // Only propagate valid filters upwards.
        if (this.isValid(nextValue)) {
            this.props.onChange(nextValue);
        }
    },
    isValid: function (filt) {
        try {
            Filt.parse(filt || this.state.value);
            return true;
        } catch (e) {
            return false;
        }
    },
    getDesc: function () {
        var desc;
        try {
            desc = Filt.parse(this.state.value).desc;
        } catch (e) {
            desc = "" + e;
        }
        if (desc !== "true") {
            return desc;
        } else {
            return (
                React.createElement(FilterDocs, null)
            );
        }
    },
    onFocus: function () {
        this.setState({focus: true});
    },
    onBlur: function () {
        this.setState({focus: false});
    },
    onMouseEnter: function () {
        this.setState({mousefocus: true});
    },
    onMouseLeave: function () {
        this.setState({mousefocus: false});
    },
    onKeyDown: function (e) {
        if (e.keyCode === utils.Key.ESC || e.keyCode === utils.Key.ENTER) {
            this.blur();
            // If closed using ESC/ENTER, hide the tooltip.
            this.setState({mousefocus: false});
        }
    },
    blur: function () {
        this.refs.input.getDOMNode().blur();
    },
    focus: function () {
        this.refs.input.getDOMNode().select();
    },
    render: function () {
        var isValid = this.isValid();
        var icon = "fa fa-fw fa-" + this.props.type;
        var groupClassName = "filter-input input-group" + (isValid ? "" : " has-error");

        var popover;
        if (this.state.focus || this.state.mousefocus) {
            popover = (
                React.createElement("div", {className: "popover bottom", onMouseEnter: this.onMouseEnter, onMouseLeave: this.onMouseLeave}, 
                    React.createElement("div", {className: "arrow"}), 
                    React.createElement("div", {className: "popover-content"}, 
                    this.getDesc()
                    )
                )
            );
        }

        return (
            React.createElement("div", {className: groupClassName}, 
                React.createElement("span", {className: "input-group-addon"}, 
                    React.createElement("i", {className: icon, style: {color: this.props.color}})
                ), 
                React.createElement("input", {type: "text", placeholder: this.props.placeholder, className: "form-control", 
                    ref: "input", 
                    onChange: this.onChange, 
                    onFocus: this.onFocus, 
                    onBlur: this.onBlur, 
                    onKeyDown: this.onKeyDown, 
                    value: this.state.value}), 
                popover
            )
        );
    }
});

var MainMenu = React.createClass({displayName: "MainMenu",
    mixins: [common.Navigation, common.State],
    statics: {
        title: "Start",
        route: "flows"
    },
    onFilterChange: function (val) {
        var d = {};
        d[Query.FILTER] = val;
        this.setQuery(d);
    },
    onHighlightChange: function (val) {
        var d = {};
        d[Query.HIGHLIGHT] = val;
        this.setQuery(d);
    },
    onInterceptChange: function (val) {
        SettingsActions.update({intercept: val});
    },
    render: function () {
        var filter = this.getQuery()[Query.FILTER] || "";
        var highlight = this.getQuery()[Query.HIGHLIGHT] || "";
        var intercept = this.props.settings.intercept || "";

        return (
            React.createElement("div", null, 
                React.createElement("div", {className: "menu-row"}, 
                    React.createElement(FilterInput, {
                        placeholder: "Filter", 
                        type: "filter", 
                        color: "black", 
                        value: filter, 
                        onChange: this.onFilterChange}), 
                    React.createElement(FilterInput, {
                        placeholder: "Highlight", 
                        type: "tag", 
                        color: "hsl(48, 100%, 50%)", 
                        value: highlight, 
                        onChange: this.onHighlightChange}), 
                    React.createElement(FilterInput, {
                        placeholder: "Intercept", 
                        type: "pause", 
                        color: "hsl(208, 56%, 53%)", 
                        value: intercept, 
                        onChange: this.onInterceptChange})
                ), 
                React.createElement("div", {className: "clearfix"})
            )
        );
    }
});


var ViewMenu = React.createClass({displayName: "ViewMenu",
    statics: {
        title: "View",
        route: "flows"
    },
    mixins: [common.Navigation, common.State],
    toggleEventLog: function () {
        var d = {};

        if (this.getQuery()[Query.SHOW_EVENTLOG]) {
            d[Query.SHOW_EVENTLOG] = undefined;
        } else {
            d[Query.SHOW_EVENTLOG] = "t"; // any non-false value will do it, keep it short
        }

        this.setQuery(d);
    },
    render: function () {
        var showEventLog = this.getQuery()[Query.SHOW_EVENTLOG];
        return (
            React.createElement("div", null, 
                React.createElement("button", {
                    className: "btn " + (showEventLog ? "btn-primary" : "btn-default"), 
                    onClick: this.toggleEventLog}, 
                    React.createElement("i", {className: "fa fa-database"}), 
                " Show Eventlog"
                ), 
                React.createElement("span", null, " ")
            )
        );
    }
});


var ReportsMenu = React.createClass({displayName: "ReportsMenu",
    statics: {
        title: "Visualization",
        route: "reports"
    },
    render: function () {
        return React.createElement("div", null, "Reports Menu");
    }
});

var FileMenu = React.createClass({displayName: "FileMenu",
    getInitialState: function () {
        return {
            showFileMenu: false
        };
    },
    handleFileClick: function (e) {
        e.preventDefault();
        if (!this.state.showFileMenu) {
            var close = function () {
                this.setState({showFileMenu: false});
                document.removeEventListener("click", close);
            }.bind(this);
            document.addEventListener("click", close);

            this.setState({
                showFileMenu: true
            });
        }
    },
    handleNewClick: function (e) {
        e.preventDefault();
        if (confirm("Delete all flows?")) {
            FlowActions.clear();
        }
    },
    handleOpenClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleOpenClick");
    },
    handleSaveClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleSaveClick");
    },
    handleShutdownClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleShutdownClick");
    },
    render: function () {
        var fileMenuClass = "dropdown pull-left" + (this.state.showFileMenu ? " open" : "");

        return (
            React.createElement("div", {className: fileMenuClass}, 
                React.createElement("a", {href: "#", className: "special", onClick: this.handleFileClick}, " mitmproxy "), 
                React.createElement("ul", {className: "dropdown-menu", role: "menu"}, 
                    React.createElement("li", null, 
                        React.createElement("a", {href: "#", onClick: this.handleNewClick}, 
                            React.createElement("i", {className: "fa fa-fw fa-file"}), 
                            "New"
                        )
                    ), 
                    React.createElement("li", {role: "presentation", className: "divider"}), 
                    React.createElement("li", null, 
                        React.createElement("a", {href: "http://mitm.it/", target: "_blank"}, 
                            React.createElement("i", {className: "fa fa-fw fa-external-link"}), 
                            "Install Certificates..."
                        )
                    )
                /*
                 <li>
                 <a href="#" onClick={this.handleOpenClick}>
                 <i className="fa fa-fw fa-folder-open"></i>
                 Open
                 </a>
                 </li>
                 <li>
                 <a href="#" onClick={this.handleSaveClick}>
                 <i className="fa fa-fw fa-save"></i>
                 Save
                 </a>
                 </li>
                 <li role="presentation" className="divider"></li>
                 <li>
                 <a href="#" onClick={this.handleShutdownClick}>
                 <i className="fa fa-fw fa-plug"></i>
                 Shutdown
                 </a>
                 </li>
                 */
                )
            )
        );
    }
});


var header_entries = [MainMenu, ViewMenu /*, ReportsMenu */];


var Header = React.createClass({displayName: "Header",
    mixins: [common.Navigation],
    getInitialState: function () {
        return {
            active: header_entries[0]
        };
    },
    handleClick: function (active, e) {
        e.preventDefault();
        this.replaceWith(active.route);
        this.setState({active: active});
    },
    render: function () {
        var header = header_entries.map(function (entry, i) {
            var classes = React.addons.classSet({
                active: entry == this.state.active
            });
            return (
                React.createElement("a", {key: i, 
                    href: "#", 
                    className: classes, 
                    onClick: this.handleClick.bind(this, entry)
                }, 
                     entry.title
                )
            );
        }.bind(this));

        return (
            React.createElement("header", null, 
                React.createElement("nav", {className: "nav-tabs nav-tabs-lg"}, 
                    React.createElement(FileMenu, null), 
                    header
                ), 
                React.createElement("div", {className: "menu"}, 
                    React.createElement(this.state.active, {settings: this.props.settings})
                )
            )
        );
    }
});


module.exports = {
    Header: Header
}

},{"../filt/filt.js":16,"../utils.js":20,"./common.js":4,"jquery":"jquery","react":"react"}],11:[function(require,module,exports){
var React = require("react");

var common = require("./common.js");
var toputils = require("../utils.js");
var views = require("../store/view.js");
var Filt = require("../filt/filt.js");
FlowTable = require("./flowtable.js");
var flowdetail = require("./flowdetail.js");


var MainView = React.createClass({displayName: "MainView",
    mixins: [common.Navigation, common.State],
    getInitialState: function () {
        this.onQueryChange(Query.FILTER, function () {
            this.state.view.recalculate(this.getViewFilt(), this.getViewSort());
        }.bind(this));
        this.onQueryChange(Query.HIGHLIGHT, function () {
            this.state.view.recalculate(this.getViewFilt(), this.getViewSort());
        }.bind(this));
        return {
            flows: []
        };
    },
    getViewFilt: function () {
        try {
            var filt = Filt.parse(this.getQuery()[Query.FILTER] || "");
            var highlightStr = this.getQuery()[Query.HIGHLIGHT];
            var highlight = highlightStr ? Filt.parse(highlightStr) : false;
        } catch (e) {
            console.error("Error when processing filter: " + e);
        }

        return function filter_and_highlight(flow) {
            if (!this._highlight) {
                this._highlight = {};
            }
            this._highlight[flow.id] = highlight && highlight(flow);
            return filt(flow);
        };
    },
    getViewSort: function () {
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.flowStore !== this.props.flowStore) {
            this.closeView();
            this.openView(nextProps.flowStore);
        }
    },
    openView: function (store) {
        var view = new views.StoreView(store, this.getViewFilt(), this.getViewSort());
        this.setState({
            view: view
        });

        view.addListener("recalculate", this.onRecalculate);
        view.addListener("add", this.onUpdate);
        view.addListener("update", this.onUpdate);
        view.addListener("remove", this.onUpdate);
        view.addListener("remove", this.onRemove);
    },
    onRecalculate: function () {
        this.forceUpdate();
        var selected = this.getSelected();
        if (selected) {
            this.refs.flowTable.scrollIntoView(selected);
        }
    },
    onUpdate: function (flow) {
        if (flow.id === this.getParams().flowId) {
            this.forceUpdate();
        }
    },
    onRemove: function (flow_id, index) {
        if (flow_id === this.getParams().flowId) {
            var flow_to_select = this.state.view.list[Math.min(index, this.state.view.list.length -1)];
            this.selectFlow(flow_to_select);
        }
    },
    closeView: function () {
        this.state.view.close();
    },
    componentWillMount: function () {
        this.openView(this.props.flowStore);
    },
    componentWillUnmount: function () {
        this.closeView();
    },
    selectFlow: function (flow) {
        if (flow) {
            this.replaceWith(
                "flow",
                {
                    flowId: flow.id,
                    detailTab: this.getParams().detailTab || "request"
                }
            );
            this.refs.flowTable.scrollIntoView(flow);
        } else {
            this.replaceWith("flows", {});
        }
    },
    selectFlowRelative: function (shift) {
        var flows = this.state.view.list;
        var index;
        if (!this.getParams().flowId) {
            if (shift > 0) {
                index = flows.length - 1;
            } else {
                index = 0;
            }
        } else {
            var currFlowId = this.getParams().flowId;
            var i = flows.length;
            while (i--) {
                if (flows[i].id === currFlowId) {
                    index = i;
                    break;
                }
            }
            index = Math.min(
                Math.max(0, index + shift),
                flows.length - 1);
        }
        this.selectFlow(flows[index]);
    },
    onKeyDown: function (e) {
        var flow = this.getSelected();
        if (e.ctrlKey) {
            return;
        }
        switch (e.keyCode) {
            case toputils.Key.K:
            case toputils.Key.UP:
                this.selectFlowRelative(-1);
                break;
            case toputils.Key.J:
            case toputils.Key.DOWN:
                this.selectFlowRelative(+1);
                break;
            case toputils.Key.SPACE:
            case toputils.Key.PAGE_DOWN:
                this.selectFlowRelative(+10);
                break;
            case toputils.Key.PAGE_UP:
                this.selectFlowRelative(-10);
                break;
            case toputils.Key.END:
                this.selectFlowRelative(+1e10);
                break;
            case toputils.Key.HOME:
                this.selectFlowRelative(-1e10);
                break;
            case toputils.Key.ESC:
                this.selectFlow(null);
                break;
            case toputils.Key.H:
            case toputils.Key.LEFT:
                if (this.refs.flowDetails) {
                    this.refs.flowDetails.nextTab(-1);
                }
                break;
            case toputils.Key.L:
            case toputils.Key.TAB:
            case toputils.Key.RIGHT:
                if (this.refs.flowDetails) {
                    this.refs.flowDetails.nextTab(+1);
                }
                break;
            case toputils.Key.C:
                if (e.shiftKey) {
                    FlowActions.clear();
                }
                break;
            case toputils.Key.D:
                if (flow) {
                    if (e.shiftKey) {
                        FlowActions.duplicate(flow);
                    } else {
                        FlowActions.delete(flow);
                    }
                }
                break;
            case toputils.Key.A:
                if (e.shiftKey) {
                    FlowActions.accept_all();
                } else if (flow && flow.intercepted) {
                    FlowActions.accept(flow);
                }
                break;
            case toputils.Key.R:
                if (!e.shiftKey && flow) {
                    FlowActions.replay(flow);
                }
                break;
            case toputils.Key.V:
                if(e.shiftKey && flow && flow.modified) {
                    FlowActions.revert(flow);
                }
                break;
            default:
                console.debug("keydown", e.keyCode);
                return;
        }
        e.preventDefault();
    },
    getSelected: function () {
        return this.props.flowStore.get(this.getParams().flowId);
    },
    render: function () {
        var selected = this.getSelected();

        var details;
        if (selected) {
            details = [
                React.createElement(common.Splitter, {key: "splitter"}),
                React.createElement(flowdetail.FlowDetail, {key: "flowDetails", ref: "flowDetails", flow: selected})
            ];
        } else {
            details = null;
        }

        return (
            React.createElement("div", {className: "main-view", onKeyDown: this.onKeyDown, tabIndex: "0"}, 
                React.createElement(FlowTable, {ref: "flowTable", 
                    view: this.state.view, 
                    selectFlow: this.selectFlow, 
                    selected: selected}), 
                details
            )
        );
    }
});

module.exports = MainView;


},{"../filt/filt.js":16,"../store/view.js":19,"../utils.js":20,"./common.js":4,"./flowdetail.js":6,"./flowtable.js":8,"react":"react"}],12:[function(require,module,exports){
var React = require("react");
var ReactRouter = require("react-router");
var _ = require("lodash");

var common = require("./common.js");
var MainView = require("./mainview.js");
var Footer = require("./footer.js");
var header = require("./header.js");
var EventLog = require("./eventlog.js");
var store = require("../store/store.js");


//TODO: Move out of here, just a stub.
var Reports = React.createClass({displayName: "Reports",
    render: function () {
        return React.createElement("div", null, "ReportEditor");
    }
});


var ProxyAppMain = React.createClass({displayName: "ProxyAppMain",
    mixins: [common.State],
    getInitialState: function () {
        var eventStore = new store.EventLogStore();
        var flowStore = new store.FlowStore();
        var settings = new store.SettingsStore();

        // Default Settings before fetch
        _.extend(settings.dict,{
        });
        return {
            settings: settings,
            flowStore: flowStore,
            eventStore: eventStore
        };
    },
    componentDidMount: function () {
        this.state.settings.addListener("recalculate", this.onSettingsChange);
        window.app = this;
    },
    componentWillUnmount: function () {
        this.state.settings.removeListener("recalculate", this.onSettingsChange);
    },
    onSettingsChange: function(){
        this.setState({
            settings: this.state.settings
        });
    },
    render: function () {

        var eventlog;
        if (this.getQuery()[Query.SHOW_EVENTLOG]) {
            eventlog = [
                React.createElement(common.Splitter, {key: "splitter", axis: "y"}),
                React.createElement(EventLog, {key: "eventlog", eventStore: this.state.eventStore})
            ];
        } else {
            eventlog = null;
        }

        return (
            React.createElement("div", {id: "container"}, 
                React.createElement(header.Header, {settings: this.state.settings.dict}), 
                React.createElement(RouteHandler, {settings: this.state.settings.dict, flowStore: this.state.flowStore}), 
                eventlog, 
                React.createElement(Footer, {settings: this.state.settings.dict})
            )
        );
    }
});


var Route = ReactRouter.Route;
var RouteHandler = ReactRouter.RouteHandler;
var Redirect = ReactRouter.Redirect;
var DefaultRoute = ReactRouter.DefaultRoute;
var NotFoundRoute = ReactRouter.NotFoundRoute;


var routes = (
    React.createElement(Route, {path: "/", handler: ProxyAppMain}, 
        React.createElement(Route, {name: "flows", path: "flows", handler: MainView}), 
        React.createElement(Route, {name: "flow", path: "flows/:flowId/:detailTab", handler: MainView}), 
        React.createElement(Route, {name: "reports", handler: Reports}), 
        React.createElement(Redirect, {path: "/", to: "flows"})
    )
);

module.exports = {
    routes: routes
};



},{"../store/store.js":18,"./common.js":4,"./eventlog.js":5,"./footer.js":9,"./header.js":10,"./mainview.js":11,"lodash":"lodash","react":"react","react-router":"react-router"}],13:[function(require,module,exports){
var React = require("react");

var VirtualScrollMixin = {
    getInitialState: function () {
        return {
            start: 0,
            stop: 0
        };
    },
    componentWillMount: function () {
        if (!this.props.rowHeight) {
            console.warn("VirtualScrollMixin: No rowHeight specified", this);
        }
    },
    getPlaceholderTop: function (total) {
        var Tag = this.props.placeholderTagName || "tr";
        // When a large trunk of elements is removed from the button, start may be far off the viewport.
        // To make this issue less severe, limit the top placeholder to the total number of rows.
        var style = {
            height: Math.min(this.state.start, total) * this.props.rowHeight
        };
        var spacer = React.createElement(Tag, {key: "placeholder-top", style: style});

        if (this.state.start % 2 === 1) {
            // fix even/odd rows
            return [spacer, React.createElement(Tag, {key: "placeholder-top-2"})];
        } else {
            return spacer;
        }
    },
    getPlaceholderBottom: function (total) {
        var Tag = this.props.placeholderTagName || "tr";
        var style = {
            height: Math.max(0, total - this.state.stop) * this.props.rowHeight
        };
        return React.createElement(Tag, {key: "placeholder-bottom", style: style});
    },
    componentDidMount: function () {
        this.onScroll();
        window.addEventListener('resize', this.onScroll);
    },
    componentWillUnmount: function(){
        window.removeEventListener('resize', this.onScroll);
    },
    onScroll: function () {
        var viewport = this.getDOMNode();
        var top = viewport.scrollTop;
        var height = viewport.offsetHeight;
        var start = Math.floor(top / this.props.rowHeight);
        var stop = start + Math.ceil(height / (this.props.rowHeightMin || this.props.rowHeight));

        this.setState({
            start: start,
            stop: stop
        });
    },
    renderRows: function (elems) {
        var rows = [];
        var max = Math.min(elems.length, this.state.stop);

        for (var i = this.state.start; i < max; i++) {
            var elem = elems[i];
            rows.push(this.renderRow(elem));
        }
        return rows;
    },
    scrollRowIntoView: function (index, head_height) {

        var row_top = (index * this.props.rowHeight) + head_height;
        var row_bottom = row_top + this.props.rowHeight;

        var viewport = this.getDOMNode();
        var viewport_top = viewport.scrollTop;
        var viewport_bottom = viewport_top + viewport.offsetHeight;

        // Account for pinned thead
        if (row_top - head_height < viewport_top) {
            viewport.scrollTop = row_top - head_height;
        } else if (row_bottom > viewport_bottom) {
            viewport.scrollTop = row_bottom - viewport.offsetHeight;
        }
    },
};

module.exports  = VirtualScrollMixin;

},{"react":"react"}],14:[function(require,module,exports){

var actions = require("./actions.js");

function Connection(url) {
    if (url[0] === "/") {
        url = location.origin.replace("http", "ws") + url;
    }

    var ws = new WebSocket(url);
    ws.onopen = function () {
        actions.ConnectionActions.open();
    };
    ws.onmessage = function (message) {
        var m = JSON.parse(message.data);
        AppDispatcher.dispatchServerAction(m);
    };
    ws.onerror = function () {
        actions.ConnectionActions.error();
        EventLogActions.add_event("WebSocket connection error.");
    };
    ws.onclose = function () {
        actions.ConnectionActions.close();
        EventLogActions.add_event("WebSocket connection closed.");
    };
    return ws;
}

module.exports = Connection;

},{"./actions.js":2}],15:[function(require,module,exports){

var flux = require("flux");

const PayloadSources = {
    VIEW: "view",
    SERVER: "server"
};


AppDispatcher = new flux.Dispatcher();
AppDispatcher.dispatchViewAction = function (action) {
    action.source = PayloadSources.VIEW;
    this.dispatch(action);
};
AppDispatcher.dispatchServerAction = function (action) {
    action.source = PayloadSources.SERVER;
    this.dispatch(action);
};

module.exports = {
    AppDispatcher: AppDispatcher
};

},{"flux":"flux"}],16:[function(require,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = { type: "other", description: "filter expression" },
        peg$c1 = peg$FAILED,
        peg$c2 = function(orExpr) { return orExpr; },
        peg$c3 = [],
        peg$c4 = function() {return trueFilter; },
        peg$c5 = { type: "other", description: "whitespace" },
        peg$c6 = /^[ \t\n\r]/,
        peg$c7 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },
        peg$c8 = { type: "other", description: "control character" },
        peg$c9 = /^[|&!()~"]/,
        peg$c10 = { type: "class", value: "[|&!()~\"]", description: "[|&!()~\"]" },
        peg$c11 = { type: "other", description: "optional whitespace" },
        peg$c12 = "|",
        peg$c13 = { type: "literal", value: "|", description: "\"|\"" },
        peg$c14 = function(first, second) { return or(first, second); },
        peg$c15 = "&",
        peg$c16 = { type: "literal", value: "&", description: "\"&\"" },
        peg$c17 = function(first, second) { return and(first, second); },
        peg$c18 = "!",
        peg$c19 = { type: "literal", value: "!", description: "\"!\"" },
        peg$c20 = function(expr) { return not(expr); },
        peg$c21 = "(",
        peg$c22 = { type: "literal", value: "(", description: "\"(\"" },
        peg$c23 = ")",
        peg$c24 = { type: "literal", value: ")", description: "\")\"" },
        peg$c25 = function(expr) { return binding(expr); },
        peg$c26 = "~a",
        peg$c27 = { type: "literal", value: "~a", description: "\"~a\"" },
        peg$c28 = function() { return assetFilter; },
        peg$c29 = "~e",
        peg$c30 = { type: "literal", value: "~e", description: "\"~e\"" },
        peg$c31 = function() { return errorFilter; },
        peg$c32 = "~q",
        peg$c33 = { type: "literal", value: "~q", description: "\"~q\"" },
        peg$c34 = function() { return noResponseFilter; },
        peg$c35 = "~s",
        peg$c36 = { type: "literal", value: "~s", description: "\"~s\"" },
        peg$c37 = function() { return responseFilter; },
        peg$c38 = "true",
        peg$c39 = { type: "literal", value: "true", description: "\"true\"" },
        peg$c40 = function() { return trueFilter; },
        peg$c41 = "false",
        peg$c42 = { type: "literal", value: "false", description: "\"false\"" },
        peg$c43 = function() { return falseFilter; },
        peg$c44 = "~c",
        peg$c45 = { type: "literal", value: "~c", description: "\"~c\"" },
        peg$c46 = function(s) { return responseCode(s); },
        peg$c47 = "~d",
        peg$c48 = { type: "literal", value: "~d", description: "\"~d\"" },
        peg$c49 = function(s) { return domain(s); },
        peg$c50 = "~h",
        peg$c51 = { type: "literal", value: "~h", description: "\"~h\"" },
        peg$c52 = function(s) { return header(s); },
        peg$c53 = "~hq",
        peg$c54 = { type: "literal", value: "~hq", description: "\"~hq\"" },
        peg$c55 = function(s) { return requestHeader(s); },
        peg$c56 = "~hs",
        peg$c57 = { type: "literal", value: "~hs", description: "\"~hs\"" },
        peg$c58 = function(s) { return responseHeader(s); },
        peg$c59 = "~m",
        peg$c60 = { type: "literal", value: "~m", description: "\"~m\"" },
        peg$c61 = function(s) { return method(s); },
        peg$c62 = "~t",
        peg$c63 = { type: "literal", value: "~t", description: "\"~t\"" },
        peg$c64 = function(s) { return contentType(s); },
        peg$c65 = "~tq",
        peg$c66 = { type: "literal", value: "~tq", description: "\"~tq\"" },
        peg$c67 = function(s) { return requestContentType(s); },
        peg$c68 = "~ts",
        peg$c69 = { type: "literal", value: "~ts", description: "\"~ts\"" },
        peg$c70 = function(s) { return responseContentType(s); },
        peg$c71 = "~u",
        peg$c72 = { type: "literal", value: "~u", description: "\"~u\"" },
        peg$c73 = function(s) { return url(s); },
        peg$c74 = { type: "other", description: "integer" },
        peg$c75 = null,
        peg$c76 = /^['"]/,
        peg$c77 = { type: "class", value: "['\"]", description: "['\"]" },
        peg$c78 = /^[0-9]/,
        peg$c79 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c80 = function(digits) { return parseInt(digits.join(""), 10); },
        peg$c81 = { type: "other", description: "string" },
        peg$c82 = "\"",
        peg$c83 = { type: "literal", value: "\"", description: "\"\\\"\"" },
        peg$c84 = function(chars) { return chars.join(""); },
        peg$c85 = "'",
        peg$c86 = { type: "literal", value: "'", description: "\"'\"" },
        peg$c87 = void 0,
        peg$c88 = /^["\\]/,
        peg$c89 = { type: "class", value: "[\"\\\\]", description: "[\"\\\\]" },
        peg$c90 = { type: "any", description: "any character" },
        peg$c91 = function(char) { return char; },
        peg$c92 = "\\",
        peg$c93 = { type: "literal", value: "\\", description: "\"\\\\\"" },
        peg$c94 = /^['\\]/,
        peg$c95 = { type: "class", value: "['\\\\]", description: "['\\\\]" },
        peg$c96 = /^['"\\]/,
        peg$c97 = { type: "class", value: "['\"\\\\]", description: "['\"\\\\]" },
        peg$c98 = "n",
        peg$c99 = { type: "literal", value: "n", description: "\"n\"" },
        peg$c100 = function() { return "\n"; },
        peg$c101 = "r",
        peg$c102 = { type: "literal", value: "r", description: "\"r\"" },
        peg$c103 = function() { return "\r"; },
        peg$c104 = "t",
        peg$c105 = { type: "literal", value: "t", description: "\"t\"" },
        peg$c106 = function() { return "\t"; },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parse__();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseOrExpr();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse__();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c2(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = [];
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c4();
        }
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c0); }
      }

      return s0;
    }

    function peg$parsews() {
      var s0, s1;

      peg$silentFails++;
      if (peg$c6.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c7); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c5); }
      }

      return s0;
    }

    function peg$parsecc() {
      var s0, s1;

      peg$silentFails++;
      if (peg$c9.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c10); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c8); }
      }

      return s0;
    }

    function peg$parse__() {
      var s0, s1;

      peg$silentFails++;
      s0 = [];
      s1 = peg$parsews();
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parsews();
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c11); }
      }

      return s0;
    }

    function peg$parseOrExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$parseAndExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 124) {
            s3 = peg$c12;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c13); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseOrExpr();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c14(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseAndExpr();
      }

      return s0;
    }

    function peg$parseAndExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$parseNotExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 38) {
            s3 = peg$c15;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c16); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseAndExpr();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c17(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseNotExpr();
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parsews();
            }
          } else {
            s2 = peg$c1;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseAndExpr();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c17(s1, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseNotExpr();
        }
      }

      return s0;
    }

    function peg$parseNotExpr() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 33) {
        s1 = peg$c18;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c19); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseNotExpr();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c20(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseBindingExpr();
      }

      return s0;
    }

    function peg$parseBindingExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s1 = peg$c21;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c22); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseOrExpr();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 41) {
                s5 = peg$c23;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c25(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseExpr();
      }

      return s0;
    }

    function peg$parseExpr() {
      var s0;

      s0 = peg$parseNullaryExpr();
      if (s0 === peg$FAILED) {
        s0 = peg$parseUnaryExpr();
      }

      return s0;
    }

    function peg$parseNullaryExpr() {
      var s0, s1;

      s0 = peg$parseBooleanLiteral();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c26) {
          s1 = peg$c26;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c27); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c28();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c29) {
            s1 = peg$c29;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c30); }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c31();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 2) === peg$c32) {
              s1 = peg$c32;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c33); }
            }
            if (s1 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c34();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 2) === peg$c35) {
                s1 = peg$c35;
                peg$currPos += 2;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c36); }
              }
              if (s1 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c37();
              }
              s0 = s1;
            }
          }
        }
      }

      return s0;
    }

    function peg$parseBooleanLiteral() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c38) {
        s1 = peg$c38;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c39); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c40();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c41) {
          s1 = peg$c41;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c42); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c43();
        }
        s0 = s1;
      }

      return s0;
    }

    function peg$parseUnaryExpr() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c44) {
        s1 = peg$c44;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c45); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parsews();
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parsews();
          }
        } else {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseIntegerLiteral();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c46(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c47) {
          s1 = peg$c47;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c48); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parsews();
            }
          } else {
            s2 = peg$c1;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseStringLiteral();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c49(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c50) {
            s1 = peg$c50;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c51); }
          }
          if (s1 !== peg$FAILED) {
            s2 = [];
            s3 = peg$parsews();
            if (s3 !== peg$FAILED) {
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parsews();
              }
            } else {
              s2 = peg$c1;
            }
            if (s2 !== peg$FAILED) {
              s3 = peg$parseStringLiteral();
              if (s3 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c52(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 3) === peg$c53) {
              s1 = peg$c53;
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c54); }
            }
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parsews();
              if (s3 !== peg$FAILED) {
                while (s3 !== peg$FAILED) {
                  s2.push(s3);
                  s3 = peg$parsews();
                }
              } else {
                s2 = peg$c1;
              }
              if (s2 !== peg$FAILED) {
                s3 = peg$parseStringLiteral();
                if (s3 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c55(s3);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 3) === peg$c56) {
                s1 = peg$c56;
                peg$currPos += 3;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c57); }
              }
              if (s1 !== peg$FAILED) {
                s2 = [];
                s3 = peg$parsews();
                if (s3 !== peg$FAILED) {
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parsews();
                  }
                } else {
                  s2 = peg$c1;
                }
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseStringLiteral();
                  if (s3 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c58(s3);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c59) {
                  s1 = peg$c59;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c60); }
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parsews();
                  if (s3 !== peg$FAILED) {
                    while (s3 !== peg$FAILED) {
                      s2.push(s3);
                      s3 = peg$parsews();
                    }
                  } else {
                    s2 = peg$c1;
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parseStringLiteral();
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c61(s3);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 2) === peg$c62) {
                    s1 = peg$c62;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c63); }
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parsews();
                    if (s3 !== peg$FAILED) {
                      while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$parsews();
                      }
                    } else {
                      s2 = peg$c1;
                    }
                    if (s2 !== peg$FAILED) {
                      s3 = peg$parseStringLiteral();
                      if (s3 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c64(s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.substr(peg$currPos, 3) === peg$c65) {
                      s1 = peg$c65;
                      peg$currPos += 3;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c66); }
                    }
                    if (s1 !== peg$FAILED) {
                      s2 = [];
                      s3 = peg$parsews();
                      if (s3 !== peg$FAILED) {
                        while (s3 !== peg$FAILED) {
                          s2.push(s3);
                          s3 = peg$parsews();
                        }
                      } else {
                        s2 = peg$c1;
                      }
                      if (s2 !== peg$FAILED) {
                        s3 = peg$parseStringLiteral();
                        if (s3 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c67(s3);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      if (input.substr(peg$currPos, 3) === peg$c68) {
                        s1 = peg$c68;
                        peg$currPos += 3;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c69); }
                      }
                      if (s1 !== peg$FAILED) {
                        s2 = [];
                        s3 = peg$parsews();
                        if (s3 !== peg$FAILED) {
                          while (s3 !== peg$FAILED) {
                            s2.push(s3);
                            s3 = peg$parsews();
                          }
                        } else {
                          s2 = peg$c1;
                        }
                        if (s2 !== peg$FAILED) {
                          s3 = peg$parseStringLiteral();
                          if (s3 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c70(s3);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c1;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                      if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c71) {
                          s1 = peg$c71;
                          peg$currPos += 2;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c72); }
                        }
                        if (s1 !== peg$FAILED) {
                          s2 = [];
                          s3 = peg$parsews();
                          if (s3 !== peg$FAILED) {
                            while (s3 !== peg$FAILED) {
                              s2.push(s3);
                              s3 = peg$parsews();
                            }
                          } else {
                            s2 = peg$c1;
                          }
                          if (s2 !== peg$FAILED) {
                            s3 = peg$parseStringLiteral();
                            if (s3 !== peg$FAILED) {
                              peg$reportedPos = s0;
                              s1 = peg$c73(s3);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$c1;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c1;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                        if (s0 === peg$FAILED) {
                          s0 = peg$currPos;
                          s1 = peg$parseStringLiteral();
                          if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c73(s1);
                          }
                          s0 = s1;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      return s0;
    }

    function peg$parseIntegerLiteral() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      if (peg$c76.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c77); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$c75;
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c78.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c79); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$c78.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c79); }
            }
          }
        } else {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          if (peg$c76.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c77); }
          }
          if (s3 === peg$FAILED) {
            s3 = peg$c75;
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c80(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }

      return s0;
    }

    function peg$parseStringLiteral() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s1 = peg$c82;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c83); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseDoubleStringChar();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseDoubleStringChar();
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s3 = peg$c82;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c83); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c84(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s1 = peg$c85;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c86); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseSingleStringChar();
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseSingleStringChar();
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s3 = peg$c85;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c86); }
            }
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$currPos;
          peg$silentFails++;
          s2 = peg$parsecc();
          peg$silentFails--;
          if (s2 === peg$FAILED) {
            s1 = peg$c87;
          } else {
            peg$currPos = s1;
            s1 = peg$c1;
          }
          if (s1 !== peg$FAILED) {
            s2 = [];
            s3 = peg$parseUnquotedStringChar();
            if (s3 !== peg$FAILED) {
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parseUnquotedStringChar();
              }
            } else {
              s2 = peg$c1;
            }
            if (s2 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c81); }
      }

      return s0;
    }

    function peg$parseDoubleStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (peg$c88.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c89); }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c92;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c93); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c91(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      }

      return s0;
    }

    function peg$parseSingleStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (peg$c94.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c95); }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c92;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c93); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c91(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      }

      return s0;
    }

    function peg$parseUnquotedStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      s2 = peg$parsews();
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseEscapeSequence() {
      var s0, s1;

      if (peg$c96.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c97); }
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 110) {
          s1 = peg$c98;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c99); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c100();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 114) {
            s1 = peg$c101;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c102); }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c103();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 116) {
              s1 = peg$c104;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c105); }
            }
            if (s1 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c106();
            }
            s0 = s1;
          }
        }
      }

      return s0;
    }


    var flowutils = require("../flow/utils.js");

    function or(first, second) {
        // Add explicit function names to ease debugging.
        function orFilter() {
            return first.apply(this, arguments) || second.apply(this, arguments);
        }
        orFilter.desc = first.desc + " or " + second.desc;
        return orFilter;
    }
    function and(first, second) {
        function andFilter() {
            return first.apply(this, arguments) && second.apply(this, arguments);
        }
        andFilter.desc = first.desc + " and " + second.desc;
        return andFilter;
    }
    function not(expr) {
        function notFilter() {
            return !expr.apply(this, arguments);
        }
        notFilter.desc = "not " + expr.desc;
        return notFilter;
    }
    function binding(expr) {
        function bindingFilter() {
            return expr.apply(this, arguments);
        }
        bindingFilter.desc = "(" + expr.desc + ")";
        return bindingFilter;
    }
    function trueFilter(flow) {
        return true;
    }
    trueFilter.desc = "true";
    function falseFilter(flow) {
        return false;
    }
    falseFilter.desc = "false";

    var ASSET_TYPES = [
        new RegExp("text/javascript"),
        new RegExp("application/x-javascript"),
        new RegExp("application/javascript"),
        new RegExp("text/css"),
        new RegExp("image/.*"),
        new RegExp("application/x-shockwave-flash")
    ];
    function assetFilter(flow) {
        if (flow.response) {
            var ct = flowutils.ResponseUtils.getContentType(flow.response);
            var i = ASSET_TYPES.length;
            while (i--) {
                if (ASSET_TYPES[i].test(ct)) {
                    return true;
                }
            }
        }
        return false;
    }
    assetFilter.desc = "is asset";
    function responseCode(code){
        function responseCodeFilter(flow){
            return flow.response && flow.response.code === code;
        }
        responseCodeFilter.desc = "resp. code is " + code;
        return responseCodeFilter;
    }
    function domain(regex){
        regex = new RegExp(regex, "i");
        function domainFilter(flow){
            return flow.request && regex.test(flow.request.host);
        }
        domainFilter.desc = "domain matches " + regex;
        return domainFilter;
    }
    function errorFilter(flow){
        return !!flow.error;
    }
    errorFilter.desc = "has error";
    function header(regex){
        regex = new RegExp(regex, "i");
        function headerFilter(flow){
            return (
                (flow.request && flowutils.RequestUtils.match_header(flow.request, regex))
                ||
                (flow.response && flowutils.ResponseUtils.match_header(flow.response, regex))
            );
        }
        headerFilter.desc = "header matches " + regex;
        return headerFilter;
    }
    function requestHeader(regex){
        regex = new RegExp(regex, "i");
        function requestHeaderFilter(flow){
            return (flow.request && flowutils.RequestUtils.match_header(flow.request, regex));
        }
        requestHeaderFilter.desc = "req. header matches " + regex;
        return requestHeaderFilter;
    }
    function responseHeader(regex){
        regex = new RegExp(regex, "i");
        function responseHeaderFilter(flow){
            return (flow.response && flowutils.ResponseUtils.match_header(flow.response, regex));
        }
        responseHeaderFilter.desc = "resp. header matches " + regex;
        return responseHeaderFilter;
    }
    function method(regex){
        regex = new RegExp(regex, "i");
        function methodFilter(flow){
            return flow.request && regex.test(flow.request.method);
        }
        methodFilter.desc = "method matches " + regex;
        return methodFilter;
    }
    function noResponseFilter(flow){
        return flow.request && !flow.response;
    }
    noResponseFilter.desc = "has no response";
    function responseFilter(flow){
        return !!flow.response;
    }
    responseFilter.desc = "has response";

    function contentType(regex){
        regex = new RegExp(regex, "i");
        function contentTypeFilter(flow){
            return (
                (flow.request && regex.test(flowutils.RequestUtils.getContentType(flow.request)))
                ||
                (flow.response && regex.test(flowutils.ResponseUtils.getContentType(flow.response)))
            );
        }
        contentTypeFilter.desc = "content type matches " + regex;
        return contentTypeFilter;
    }
    function requestContentType(regex){
        regex = new RegExp(regex, "i");
        function requestContentTypeFilter(flow){
            return flow.request && regex.test(flowutils.RequestUtils.getContentType(flow.request));
        }
        requestContentTypeFilter.desc = "req. content type matches " + regex;
        return requestContentTypeFilter;
    }
    function responseContentType(regex){
        regex = new RegExp(regex, "i");
        function responseContentTypeFilter(flow){
            return flow.response && regex.test(flowutils.ResponseUtils.getContentType(flow.response));
        }
        responseContentTypeFilter.desc = "resp. content type matches " + regex;
        return responseContentTypeFilter;
    }
    function url(regex){
        regex = new RegExp(regex, "i");
        function urlFilter(flow){
            return flow.request && regex.test(flowutils.RequestUtils.pretty_url(flow.request));
        }
        urlFilter.desc = "url matches " + regex;
        return urlFilter;
    }


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();

},{"../flow/utils.js":17}],17:[function(require,module,exports){
var _ = require("lodash");

var _MessageUtils = {
    getContentType: function (message) {
        return this.get_first_header(message, /^Content-Type$/i);
    },
    get_first_header: function (message, regex) {
        //FIXME: Cache Invalidation.
        if (!message._headerLookups)
            Object.defineProperty(message, "_headerLookups", {
                value: {},
                configurable: false,
                enumerable: false,
                writable: false
            });
        if (!(regex in message._headerLookups)) {
            var header;
            for (var i = 0; i < message.headers.length; i++) {
                if (!!message.headers[i][0].match(regex)) {
                    header = message.headers[i];
                    break;
                }
            }
            message._headerLookups[regex] = header ? header[1] : undefined;
        }
        return message._headerLookups[regex];
    },
    match_header: function (message, regex) {
        var headers = message.headers;
        var i = headers.length;
        while (i--) {
            if (regex.test(headers[i].join(" "))) {
                return headers[i];
            }
        }
        return false;
    }
};

var defaultPorts = {
    "http": 80,
    "https": 443
};

var RequestUtils = _.extend(_MessageUtils, {
    pretty_host: function (request) {
        //FIXME: Add hostheader
        return request.host;
    },
    pretty_url: function (request) {
        var port = "";
        if (defaultPorts[request.scheme] !== request.port) {
            port = ":" + request.port;
        }
        return request.scheme + "://" + this.pretty_host(request) + port + request.path;
    }
});

var ResponseUtils = _.extend(_MessageUtils, {});


module.exports = {
    ResponseUtils: ResponseUtils,
    RequestUtils: RequestUtils

}

},{"lodash":"lodash"}],18:[function(require,module,exports){

var _ = require("lodash");
var $ = require("jquery");
var EventEmitter = require('events').EventEmitter;

var utils = require("../utils.js");
var actions = require("../actions.js");
var dispatcher = require("../dispatcher.js");


function ListStore() {
    EventEmitter.call(this);
    this.reset();
}
_.extend(ListStore.prototype, EventEmitter.prototype, {
    add: function (elem) {
        if (elem.id in this._pos_map) {
            return;
        }
        this._pos_map[elem.id] = this.list.length;
        this.list.push(elem);
        this.emit("add", elem);
    },
    update: function (elem) {
        if (!(elem.id in this._pos_map)) {
            return;
        }
        this.list[this._pos_map[elem.id]] = elem;
        this.emit("update", elem);
    },
    remove: function (elem_id) {
        if (!(elem_id in this._pos_map)) {
            return;
        }
        this.list.splice(this._pos_map[elem_id], 1);
        this._build_map();
        this.emit("remove", elem_id);
    },
    reset: function (elems) {
        this.list = elems || [];
        this._build_map();
        this.emit("recalculate");
    },
    _build_map: function () {
        this._pos_map = {};
        for (var i = 0; i < this.list.length; i++) {
            var elem = this.list[i];
            this._pos_map[elem.id] = i;
        }
    },
    get: function (elem_id) {
        return this.list[this._pos_map[elem_id]];
    },
    index: function (elem_id) {
        return this._pos_map[elem_id];
    }
});


function DictStore() {
    EventEmitter.call(this);
    this.reset();
}
_.extend(DictStore.prototype, EventEmitter.prototype, {
    update: function (dict) {
        _.merge(this.dict, dict);
        this.emit("recalculate");
    },
    reset: function (dict) {
        this.dict = dict || {};
        this.emit("recalculate");
    }
});

function LiveStoreMixin(type) {
    this.type = type;

    this._updates_before_fetch = undefined;
    this._fetchxhr = false;

    this.handle = this.handle.bind(this);
    dispatcher.AppDispatcher.register(this.handle);

    // Avoid double-fetch on startup.
    if (!(window.ws && window.ws.readyState === WebSocket.CONNECTING)) {
        this.fetch();
    }
}
_.extend(LiveStoreMixin.prototype, {
    handle: function (event) {
        if (event.type === actions.ActionTypes.CONNECTION_OPEN) {
            return this.fetch();
        }
        if (event.type === this.type) {
            if (event.cmd === actions.StoreCmds.RESET) {
                this.fetch(event.data);
            } else if (this._updates_before_fetch) {
                console.log("defer update", event);
                this._updates_before_fetch.push(event);
            } else {
                this[event.cmd](event.data);
            }
        }
    },
    close: function () {
        dispatcher.AppDispatcher.unregister(this.handle);
    },
    fetch: function (data) {
        console.log("fetch " + this.type);
        if (this._fetchxhr) {
            this._fetchxhr.abort();
        }
        this._updates_before_fetch = []; // (JS: empty array is true)
        if (data) {
            this.handle_fetch(data);
        } else {
            this._fetchxhr = $.getJSON("/" + this.type)
                .done(function (message) {
                    this.handle_fetch(message.data);
                }.bind(this))
                .fail(function () {
                    EventLogActions.add_event("Could not fetch " + this.type);
                }.bind(this));
        }
    },
    handle_fetch: function (data) {
        this._fetchxhr = false;
        console.log(this.type + " fetched.", this._updates_before_fetch);
        this.reset(data);
        var updates = this._updates_before_fetch;
        this._updates_before_fetch = false;
        for (var i = 0; i < updates.length; i++) {
            this.handle(updates[i]);
        }
    },
});

function LiveListStore(type) {
    ListStore.call(this);
    LiveStoreMixin.call(this, type);
}
_.extend(LiveListStore.prototype, ListStore.prototype, LiveStoreMixin.prototype);

function LiveDictStore(type) {
    DictStore.call(this);
    LiveStoreMixin.call(this, type);
}
_.extend(LiveDictStore.prototype, DictStore.prototype, LiveStoreMixin.prototype);


function FlowStore() {
    return new LiveListStore(actions.ActionTypes.FLOW_STORE);
}

function SettingsStore() {
    return new LiveDictStore(actions.ActionTypes.SETTINGS_STORE);
}

function EventLogStore() {
    LiveListStore.call(this, actions.ActionTypes.EVENT_STORE);
}
_.extend(EventLogStore.prototype, LiveListStore.prototype, {
    fetch: function(){
        LiveListStore.prototype.fetch.apply(this, arguments);

        // Make sure to display updates even if fetching all events failed.
        // This way, we can send "fetch failed" log messages to the log.
        if(this._fetchxhr){
            this._fetchxhr.fail(function(){
                this.handle_fetch(null);
            }.bind(this));
        }
    }
});


module.exports = {
    EventLogStore: EventLogStore,
    SettingsStore: SettingsStore,
    FlowStore: FlowStore
};

},{"../actions.js":2,"../dispatcher.js":15,"../utils.js":20,"events":1,"jquery":"jquery","lodash":"lodash"}],19:[function(require,module,exports){

var EventEmitter = require('events').EventEmitter;
var _ = require("lodash");


var utils = require("../utils.js");

function SortByStoreOrder(elem) {
    return this.store.index(elem.id);
}

var default_sort = SortByStoreOrder;
var default_filt = function(elem){
    return true;
};

function StoreView(store, filt, sortfun) {
    EventEmitter.call(this);
    filt = filt || default_filt;
    sortfun = sortfun || default_sort;

    this.store = store;

    this.add = this.add.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
    this.recalculate = this.recalculate.bind(this);
    this.store.addListener("add", this.add);
    this.store.addListener("update", this.update);
    this.store.addListener("remove", this.remove);
    this.store.addListener("recalculate", this.recalculate);

    this.recalculate(filt, sortfun);
}

_.extend(StoreView.prototype, EventEmitter.prototype, {
    close: function () {
        this.store.removeListener("add", this.add);
        this.store.removeListener("update", this.update);
        this.store.removeListener("remove", this.remove);
        this.store.removeListener("recalculate", this.recalculate);
        },
        recalculate: function (filt, sortfun) {
        if (filt) {
            this.filt = filt.bind(this);
        }
        if (sortfun) {
            this.sortfun = sortfun.bind(this);
        }

        this.list = this.store.list.filter(this.filt);
        this.list.sort(function (a, b) {
            return this.sortfun(a) - this.sortfun(b);
        }.bind(this));
        this.emit("recalculate");
    },
    index: function (elem) {
        return _.sortedIndex(this.list, elem, this.sortfun);
    },
    add: function (elem) {
        if (this.filt(elem)) {
            var idx = this.index(elem);
            if (idx === this.list.length) { //happens often, .push is way faster.
                this.list.push(elem);
            } else {
                this.list.splice(idx, 0, elem);
            }
            this.emit("add", elem, idx);
        }
    },
    update: function (elem) {
        var idx;
        var i = this.list.length;
        // Search from the back, we usually update the latest entries.
        while (i--) {
            if (this.list[i].id === elem.id) {
                idx = i;
                break;
            }
        }

        if (idx === -1) { //not contained in list
            this.add(elem);
        } else if (!this.filt(elem)) {
            this.remove(elem.id);
        } else {
            if (this.sortfun(this.list[idx]) !== this.sortfun(elem)) { //sortpos has changed
                this.remove(this.list[idx]);
                this.add(elem);
            } else {
                this.list[idx] = elem;
                this.emit("update", elem, idx);
            }
        }
    },
    remove: function (elem_id) {
        var idx = this.list.length;
        while (idx--) {
            if (this.list[idx].id === elem_id) {
                this.list.splice(idx, 1);
                this.emit("remove", elem_id, idx);
                break;
            }
        }
    }
});

module.exports = {
    StoreView: StoreView
};

},{"../utils.js":20,"events":1,"lodash":"lodash"}],20:[function(require,module,exports){
var $ = require("jquery");


var Key = {
    UP: 38,
    DOWN: 40,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    HOME: 36,
    END: 35,
    LEFT: 37,
    RIGHT: 39,
    ENTER: 13,
    ESC: 27,
    TAB: 9,
    SPACE: 32,
    BACKSPACE: 8,
};
// Add A-Z
for (var i = 65; i <= 90; i++) {
    Key[String.fromCharCode(i)] = i;
}


var formatSize = function (bytes) {
    if (bytes === 0)
        return "0";
    var prefix = ["b", "kb", "mb", "gb", "tb"];
    for (var i = 0; i < prefix.length; i++){
        if (Math.pow(1024, i + 1) > bytes){
            break;
        }
    }
    var precision;
    if (bytes%Math.pow(1024, i) === 0)
        precision = 0;
    else
        precision = 1;
    return (bytes/Math.pow(1024, i)).toFixed(precision) + prefix[i];
};


var formatTimeDelta = function (milliseconds) {
    var time = milliseconds;
    var prefix = ["ms", "s", "min", "h"];
    var div = [1000, 60, 60];
    var i = 0;
    while (Math.abs(time) >= div[i] && i < div.length) {
        time = time / div[i];
        i++;
    }
    return Math.round(time) + prefix[i];
};


var formatTimeStamp = function (seconds) {
    var ts = (new Date(seconds * 1000)).toISOString();
    return ts.replace("T", " ").replace("Z", "");
};


function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}
var xsrf = $.param({_xsrf: getCookie("_xsrf")});

//Tornado XSRF Protection.
$.ajaxPrefilter(function (options) {
    if (["post", "put", "delete"].indexOf(options.type.toLowerCase()) >= 0 && options.url[0] === "/") {
        if (options.data) {
            options.data += ("&" + xsrf);
        } else {
            options.data = xsrf;
        }
    }
});
// Log AJAX Errors
$(document).ajaxError(function (event, jqXHR, ajaxSettings, thrownError) {
    var message = jqXHR.responseText;
    console.error(message, arguments);
    EventLogActions.add_event(thrownError + ": " + message);
    window.alert(message);
});

module.exports = {
    formatSize: formatSize,
    formatTimeDelta: formatTimeDelta,
    formatTimeStamp: formatTimeStamp,
    Key: Key
};

},{"jquery":"jquery"}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGV2ZW50c1xcZXZlbnRzLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGFjdGlvbnMuanMiLCJEOlxcZ2l0aHViXFxtaXRtcHJveHlcXHdlYlxcc3JjXFxqc1xcYXBwLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGNvbXBvbmVudHNcXGNvbW1vbi5qcyIsIkQ6XFxnaXRodWJcXG1pdG1wcm94eVxcd2ViXFxzcmNcXGpzXFxjb21wb25lbnRzXFxldmVudGxvZy5qcyIsIkQ6XFxnaXRodWJcXG1pdG1wcm94eVxcd2ViXFxzcmNcXGpzXFxjb21wb25lbnRzXFxmbG93ZGV0YWlsLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGNvbXBvbmVudHNcXGZsb3d0YWJsZS1jb2x1bW5zLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGNvbXBvbmVudHNcXGZsb3d0YWJsZS5qcyIsIkQ6XFxnaXRodWJcXG1pdG1wcm94eVxcd2ViXFxzcmNcXGpzXFxjb21wb25lbnRzXFxmb290ZXIuanMiLCJEOlxcZ2l0aHViXFxtaXRtcHJveHlcXHdlYlxcc3JjXFxqc1xcY29tcG9uZW50c1xcaGVhZGVyLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGNvbXBvbmVudHNcXG1haW52aWV3LmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGNvbXBvbmVudHNcXHByb3h5YXBwLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGNvbXBvbmVudHNcXHZpcnR1YWxzY3JvbGwuanMiLCJEOlxcZ2l0aHViXFxtaXRtcHJveHlcXHdlYlxcc3JjXFxqc1xcY29ubmVjdGlvbi5qcyIsIkQ6XFxnaXRodWJcXG1pdG1wcm94eVxcd2ViXFxzcmNcXGpzXFxkaXNwYXRjaGVyLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXGZpbHRcXGZpbHQuanMiLCJEOlxcZ2l0aHViXFxtaXRtcHJveHlcXHdlYlxcc3JjXFxqc1xcZmxvd1xcdXRpbHMuanMiLCJEOlxcZ2l0aHViXFxtaXRtcHJveHlcXHdlYlxcc3JjXFxqc1xcc3RvcmVcXHN0b3JlLmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXHN0b3JlXFx2aWV3LmpzIiwiRDpcXGdpdGh1YlxcbWl0bXByb3h5XFx3ZWJcXHNyY1xcanNcXHV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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RSxPQUFPLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFO1FBQzNFLE9BQU8sR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLHFCQUFxQixFQUFFO1FBQy9ELE9BQU8sR0FBRyxHQUFHO1FBQ2IsT0FBTyxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUU7UUFDL0QsT0FBTyxHQUFHLFNBQVMsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFLE9BQU8sRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFO1FBQy9ELE9BQU8sR0FBRyxHQUFHO1FBQ2IsT0FBTyxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUU7UUFDL0QsT0FBTyxHQUFHLFNBQVMsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFLE9BQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFO1FBQ2hFLE9BQU8sR0FBRyxHQUFHO1FBQ2IsT0FBTyxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUU7UUFDL0QsT0FBTyxHQUFHLFNBQVMsSUFBSSxFQUFFLEVBQUUsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRTtRQUM5QyxPQUFPLEdBQUcsR0FBRztRQUNiLE9BQU8sR0FBRyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFO1FBQy9ELE9BQU8sR0FBRyxHQUFHO1FBQ2IsT0FBTyxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUU7UUFDL0QsT0FBTyxHQUFHLFNBQVMsSUFBSSxF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LENBQUMsQ0FBQyxDQUFDOztBQUVILE1BQU0sQ0FBQyxPQUFPLEdBQUc7SUFDYixVQUFVLEVBQUUsVUFBVTtJQUN0QixlQUFlLEVBQUUsZUFBZTtJQUNoQyxlQUFlLEVBQUUsZUFBZTtJQUNoQyxHQUFHLEVBQUUsR0FBRztDQUNYIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciAkID0gcmVxdWlyZShcImpxdWVyeVwiKTtcclxuXHJcbnZhciBBY3Rpb25UeXBlcyA9IHtcclxuICAgIC8vIENvbm5lY3Rpb25cclxuICAgIENPTk5FQ1RJT05fT1BFTjogXCJjb25uZWN0aW9uX29wZW5cIixcclxuICAgIENPTk5FQ1RJT05fQ0xPU0U6IFwiY29ubmVjdGlvbl9jbG9zZVwiLFxyXG4gICAgQ09OTkVDVElPTl9FUlJPUjogXCJjb25uZWN0aW9uX2Vycm9yXCIsXHJcblxyXG4gICAgLy8gU3RvcmVzXHJcbiAgICBTRVRUSU5HU19TVE9SRTogXCJzZXR0aW5nc1wiLFxyXG4gICAgRVZFTlRfU1RPUkU6IFwiZXZlbnRzXCIsXHJcbiAgICBGTE9XX1NUT1JFOiBcImZsb3dzXCIsXHJcbn07XHJcblxyXG52YXIgU3RvcmVDbWRzID0ge1xyXG4gICAgQUREOiBcImFkZFwiLFxyXG4gICAgVVBEQVRFOiBcInVwZGF0ZVwiLFxyXG4gICAgUkVNT1ZFOiBcInJlbW92ZVwiLFxyXG4gICAgUkVTRVQ6IFwicmVzZXRcIlxyXG59O1xyXG5cclxudmFyIENvbm5lY3Rpb25BY3Rpb25zID0ge1xyXG4gICAgb3BlbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uKHtcclxuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuQ09OTkVDVElPTl9PUEVOXHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG4gICAgY2xvc2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XHJcbiAgICAgICAgICAgIHR5cGU6IEFjdGlvblR5cGVzLkNPTk5FQ1RJT05fQ0xPU0VcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcbiAgICBlcnJvcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uKHtcclxuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuQ09OTkVDVElPTl9FUlJPUlxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxudmFyIFNldHRpbmdzQWN0aW9ucyA9IHtcclxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKHNldHRpbmdzKSB7XHJcblxyXG4gICAgICAgICQuYWpheCh7XHJcbiAgICAgICAgICAgIHR5cGU6IFwiUFVUXCIsXHJcbiAgICAgICAgICAgIHVybDogXCIvc2V0dGluZ3NcIixcclxuICAgICAgICAgICAgZGF0YTogc2V0dGluZ3NcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLypcclxuICAgICAgICAvL0ZhY2Vib29rIEZsdXg6IFdlIGRvIGFuIG9wdGltaXN0aWMgdXBkYXRlIG9uIHRoZSBjbGllbnQgYWxyZWFkeS5cclxuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XHJcbiAgICAgICAgICAgIHR5cGU6IEFjdGlvblR5cGVzLlNFVFRJTkdTX1NUT1JFLFxyXG4gICAgICAgICAgICBjbWQ6IFN0b3JlQ21kcy5VUERBVEUsXHJcbiAgICAgICAgICAgIGRhdGE6IHNldHRpbmdzXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgKi9cclxuICAgIH1cclxufTtcclxuXHJcbnZhciBFdmVudExvZ0FjdGlvbnNfZXZlbnRfaWQgPSAwO1xyXG52YXIgRXZlbnRMb2dBY3Rpb25zID0ge1xyXG4gICAgYWRkX2V2ZW50OiBmdW5jdGlvbiAobWVzc2FnZSkge1xyXG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uKHtcclxuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuRVZFTlRfU1RPUkUsXHJcbiAgICAgICAgICAgIGNtZDogU3RvcmVDbWRzLkFERCxcclxuICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcclxuICAgICAgICAgICAgICAgIGxldmVsOiBcIndlYlwiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IFwidmlld0FjdGlvbi1cIiArIEV2ZW50TG9nQWN0aW9uc19ldmVudF9pZCsrXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuXHJcbnZhciBGbG93QWN0aW9ucyA9IHtcclxuICAgIGFjY2VwdDogZnVuY3Rpb24gKGZsb3cpIHtcclxuICAgICAgICAkLnBvc3QoXCIvZmxvd3MvXCIgKyBmbG93LmlkICsgXCIvYWNjZXB0XCIpO1xyXG4gICAgfSxcclxuICAgIGFjY2VwdF9hbGw6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgJC5wb3N0KFwiL2Zsb3dzL2FjY2VwdFwiKTtcclxuICAgIH0sXHJcbiAgICBcImRlbGV0ZVwiOiBmdW5jdGlvbihmbG93KXtcclxuICAgICAgICAkLmFqYXgoe1xyXG4gICAgICAgICAgICB0eXBlOlwiREVMRVRFXCIsXHJcbiAgICAgICAgICAgIHVybDogXCIvZmxvd3MvXCIgKyBmbG93LmlkXHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG4gICAgZHVwbGljYXRlOiBmdW5jdGlvbihmbG93KXtcclxuICAgICAgICAkLnBvc3QoXCIvZmxvd3MvXCIgKyBmbG93LmlkICsgXCIvZHVwbGljYXRlXCIpO1xyXG4gICAgfSxcclxuICAgIHJlcGxheTogZnVuY3Rpb24oZmxvdyl7XHJcbiAgICAgICAgJC5wb3N0KFwiL2Zsb3dzL1wiICsgZmxvdy5pZCArIFwiL3JlcGxheVwiKTtcclxuICAgIH0sXHJcbiAgICByZXZlcnQ6IGZ1bmN0aW9uKGZsb3cpe1xyXG4gICAgICAgICQucG9zdChcIi9mbG93cy9cIiArIGZsb3cuaWQgKyBcIi9yZXZlcnRcIik7XHJcbiAgICB9LFxyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZmxvdykge1xyXG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uKHtcclxuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuRkxPV19TVE9SRSxcclxuICAgICAgICAgICAgY21kOiBTdG9yZUNtZHMuVVBEQVRFLFxyXG4gICAgICAgICAgICBkYXRhOiBmbG93XHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG4gICAgY2xlYXI6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgJC5wb3N0KFwiL2NsZWFyXCIpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUXVlcnkgPSB7XHJcbiAgICBGSUxURVI6IFwiZlwiLFxyXG4gICAgSElHSExJR0hUOiBcImhcIixcclxuICAgIFNIT1dfRVZFTlRMT0c6IFwiZVwiXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIEFjdGlvblR5cGVzOiBBY3Rpb25UeXBlcyxcclxuICAgIENvbm5lY3Rpb25BY3Rpb25zOiBDb25uZWN0aW9uQWN0aW9ucyxcclxuICAgIEZsb3dBY3Rpb25zOiBGbG93QWN0aW9ucyxcclxuICAgIFN0b3JlQ21kczogU3RvcmVDbWRzXHJcbn07IiwiXHJcbnZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcclxudmFyIFJlYWN0Um91dGVyID0gcmVxdWlyZShcInJlYWN0LXJvdXRlclwiKTtcclxudmFyICQgPSByZXF1aXJlKFwianF1ZXJ5XCIpO1xyXG5cclxudmFyIENvbm5lY3Rpb24gPSByZXF1aXJlKFwiLi9jb25uZWN0aW9uXCIpO1xyXG52YXIgcHJveHlhcHAgPSByZXF1aXJlKFwiLi9jb21wb25lbnRzL3Byb3h5YXBwLmpzXCIpO1xyXG5cclxuJChmdW5jdGlvbiAoKSB7XHJcbiAgICB3aW5kb3cud3MgPSBuZXcgQ29ubmVjdGlvbihcIi91cGRhdGVzXCIpO1xyXG5cclxuICAgIFJlYWN0Um91dGVyLnJ1bihwcm94eWFwcC5yb3V0ZXMsIGZ1bmN0aW9uIChIYW5kbGVyKSB7XHJcbiAgICAgICAgUmVhY3QucmVuZGVyKDxIYW5kbGVyLz4sIGRvY3VtZW50LmJvZHkpO1xyXG4gICAgfSk7XHJcbn0pO1xyXG5cclxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xyXG52YXIgUmVhY3RSb3V0ZXIgPSByZXF1aXJlKFwicmVhY3Qtcm91dGVyXCIpO1xyXG52YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcblxyXG4vLyBodHRwOi8vYmxvZy52amV1eC5jb20vMjAxMy9qYXZhc2NyaXB0L3Njcm9sbC1wb3NpdGlvbi13aXRoLXJlYWN0Lmh0bWwgKGFsc28gY29udGFpbnMgaW52ZXJzZSBleGFtcGxlKVxyXG52YXIgQXV0b1Njcm9sbE1peGluID0ge1xyXG4gICAgY29tcG9uZW50V2lsbFVwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5nZXRET01Ob2RlKCk7XHJcbiAgICAgICAgdGhpcy5fc2hvdWxkU2Nyb2xsQm90dG9tID0gKFxyXG4gICAgICAgICAgICBub2RlLnNjcm9sbFRvcCAhPT0gMCAmJlxyXG4gICAgICAgICAgICBub2RlLnNjcm9sbFRvcCArIG5vZGUuY2xpZW50SGVpZ2h0ID09PSBub2RlLnNjcm9sbEhlaWdodFxyXG4gICAgICAgICk7XHJcbiAgICB9LFxyXG4gICAgY29tcG9uZW50RGlkVXBkYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3Nob3VsZFNjcm9sbEJvdHRvbSkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZ2V0RE9NTm9kZSgpO1xyXG4gICAgICAgICAgICBub2RlLnNjcm9sbFRvcCA9IG5vZGUuc2Nyb2xsSGVpZ2h0O1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbn07XHJcblxyXG5cclxudmFyIFN0aWNreUhlYWRNaXhpbiA9IHtcclxuICAgIGFkanVzdEhlYWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAvLyBBYnVzaW5nIENTUyB0cmFuc2Zvcm1zIHRvIHNldCB0aGUgZWxlbWVudFxyXG4gICAgICAgIC8vIHJlZmVyZW5jZWQgYXMgaGVhZCBpbnRvIHNvbWUga2luZCBvZiBwb3NpdGlvbjpzdGlja3kuXHJcbiAgICAgICAgdmFyIGhlYWQgPSB0aGlzLnJlZnMuaGVhZC5nZXRET01Ob2RlKCk7XHJcbiAgICAgICAgaGVhZC5zdHlsZS50cmFuc2Zvcm0gPSBcInRyYW5zbGF0ZSgwLFwiICsgdGhpcy5nZXRET01Ob2RlKCkuc2Nyb2xsVG9wICsgXCJweClcIjtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG52YXIgTmF2aWdhdGlvbiA9IF8uZXh0ZW5kKHt9LCBSZWFjdFJvdXRlci5OYXZpZ2F0aW9uLCB7XHJcbiAgICBzZXRRdWVyeTogZnVuY3Rpb24gKGRpY3QpIHtcclxuICAgICAgICB2YXIgcSA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UXVlcnkoKTtcclxuICAgICAgICBmb3IodmFyIGkgaW4gZGljdCl7XHJcbiAgICAgICAgICAgIGlmKGRpY3QuaGFzT3duUHJvcGVydHkoaSkpe1xyXG4gICAgICAgICAgICAgICAgcVtpXSA9IGRpY3RbaV0gfHwgdW5kZWZpbmVkOyAvL2ZhbHNleSB2YWx1ZXMgc2hhbGwgYmUgcmVtb3ZlZC5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBxLl8gPSBcIl9cIjsgLy8gd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL3JhY2t0L3JlYWN0LXJvdXRlci9wdWxsLzU5OVxyXG4gICAgICAgIHRoaXMucmVwbGFjZVdpdGgodGhpcy5jb250ZXh0LmdldEN1cnJlbnRQYXRoKCksIHRoaXMuY29udGV4dC5nZXRDdXJyZW50UGFyYW1zKCksIHEpO1xyXG4gICAgfSxcclxuICAgIHJlcGxhY2VXaXRoOiBmdW5jdGlvbihyb3V0ZU5hbWVPclBhdGgsIHBhcmFtcywgcXVlcnkpIHtcclxuICAgICAgICBpZihyb3V0ZU5hbWVPclBhdGggPT09IHVuZGVmaW5lZCl7XHJcbiAgICAgICAgICAgIHJvdXRlTmFtZU9yUGF0aCA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UGF0aCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZihwYXJhbXMgPT09IHVuZGVmaW5lZCl7XHJcbiAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UGFyYW1zKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKHF1ZXJ5ID09PSB1bmRlZmluZWQpe1xyXG4gICAgICAgICAgICBxdWVyeSA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UXVlcnkoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgUmVhY3RSb3V0ZXIuTmF2aWdhdGlvbi5yZXBsYWNlV2l0aC5jYWxsKHRoaXMsIHJvdXRlTmFtZU9yUGF0aCwgcGFyYW1zLCBxdWVyeSk7XHJcbiAgICB9XHJcbn0pO1xyXG5fLmV4dGVuZChOYXZpZ2F0aW9uLmNvbnRleHRUeXBlcywgUmVhY3RSb3V0ZXIuU3RhdGUuY29udGV4dFR5cGVzKTtcclxuXHJcbnZhciBTdGF0ZSA9IF8uZXh0ZW5kKHt9LCBSZWFjdFJvdXRlci5TdGF0ZSwge1xyXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5fcXVlcnkgPSB0aGlzLmNvbnRleHQuZ2V0Q3VycmVudFF1ZXJ5KCk7XHJcbiAgICAgICAgdGhpcy5fcXVlcnlXYXRjaGVzID0gW107XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9LFxyXG4gICAgb25RdWVyeUNoYW5nZTogZnVuY3Rpb24gKGtleSwgY2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLl9xdWVyeVdhdGNoZXMucHVzaCh7XHJcbiAgICAgICAgICAgIGtleToga2V5LFxyXG4gICAgICAgICAgICBjYWxsYmFjazogY2FsbGJhY2tcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiAobmV4dFByb3BzLCBuZXh0U3RhdGUpIHtcclxuICAgICAgICB2YXIgcSA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UXVlcnkoKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX3F1ZXJ5V2F0Y2hlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgd2F0Y2ggPSB0aGlzLl9xdWVyeVdhdGNoZXNbaV07XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWVyeVt3YXRjaC5rZXldICE9PSBxW3dhdGNoLmtleV0pIHtcclxuICAgICAgICAgICAgICAgIHdhdGNoLmNhbGxiYWNrKHRoaXMuX3F1ZXJ5W3dhdGNoLmtleV0sIHFbd2F0Y2gua2V5XSwgd2F0Y2gua2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9xdWVyeSA9IHE7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIFNwbGl0dGVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgYXhpczogXCJ4XCJcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcGxpZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICBzdGFydFg6IGZhbHNlLFxyXG4gICAgICAgICAgICBzdGFydFk6IGZhbHNlXHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcbiAgICBvbk1vdXNlRG93bjogZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcclxuICAgICAgICAgICAgc3RhcnRYOiBlLnBhZ2VYLFxyXG4gICAgICAgICAgICBzdGFydFk6IGUucGFnZVlcclxuICAgICAgICB9KTtcclxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLm9uTW91c2VNb3ZlKTtcclxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5vbk1vdXNlVXApO1xyXG4gICAgICAgIC8vIE9jY2FzaW9uYWxseSwgb25seSBhIGRyYWdFbmQgZXZlbnQgaXMgdHJpZ2dlcmVkLCBidXQgbm8gbW91c2VVcC5cclxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgdGhpcy5vbkRyYWdFbmQpO1xyXG4gICAgfSxcclxuICAgIG9uRHJhZ0VuZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuZ2V0RE9NTm9kZSgpLnN0eWxlLnRyYW5zZm9ybSA9IFwiXCI7XHJcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJkcmFnZW5kXCIsIHRoaXMub25EcmFnRW5kKTtcclxuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5vbk1vdXNlVXApO1xyXG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIHRoaXMub25Nb3VzZU1vdmUpO1xyXG4gICAgfSxcclxuICAgIG9uTW91c2VVcDogZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICB0aGlzLm9uRHJhZ0VuZCgpO1xyXG5cclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZ2V0RE9NTm9kZSgpO1xyXG4gICAgICAgIHZhciBwcmV2ID0gbm9kZS5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xyXG4gICAgICAgIHZhciBuZXh0ID0gbm9kZS5uZXh0RWxlbWVudFNpYmxpbmc7XHJcblxyXG4gICAgICAgIHZhciBkWCA9IGUucGFnZVggLSB0aGlzLnN0YXRlLnN0YXJ0WDtcclxuICAgICAgICB2YXIgZFkgPSBlLnBhZ2VZIC0gdGhpcy5zdGF0ZS5zdGFydFk7XHJcbiAgICAgICAgdmFyIGZsZXhCYXNpcztcclxuICAgICAgICBpZiAodGhpcy5wcm9wcy5heGlzID09PSBcInhcIikge1xyXG4gICAgICAgICAgICBmbGV4QmFzaXMgPSBwcmV2Lm9mZnNldFdpZHRoICsgZFg7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZmxleEJhc2lzID0gcHJldi5vZmZzZXRIZWlnaHQgKyBkWTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByZXYuc3R5bGUuZmxleCA9IFwiMCAwIFwiICsgTWF0aC5tYXgoMCwgZmxleEJhc2lzKSArIFwicHhcIjtcclxuICAgICAgICBuZXh0LnN0eWxlLmZsZXggPSBcIjEgMSBhdXRvXCI7XHJcblxyXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xyXG4gICAgICAgICAgICBhcHBsaWVkOiB0cnVlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5vblJlc2l6ZSgpO1xyXG4gICAgfSxcclxuICAgIG9uTW91c2VNb3ZlOiBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIHZhciBkWCA9IDAsIGRZID0gMDtcclxuICAgICAgICBpZiAodGhpcy5wcm9wcy5heGlzID09PSBcInhcIikge1xyXG4gICAgICAgICAgICBkWCA9IGUucGFnZVggLSB0aGlzLnN0YXRlLnN0YXJ0WDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBkWSA9IGUucGFnZVkgLSB0aGlzLnN0YXRlLnN0YXJ0WTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5nZXRET01Ob2RlKCkuc3R5bGUudHJhbnNmb3JtID0gXCJ0cmFuc2xhdGUoXCIgKyBkWCArIFwicHgsXCIgKyBkWSArIFwicHgpXCI7XHJcbiAgICB9LFxyXG4gICAgb25SZXNpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAvLyBUcmlnZ2VyIGEgZ2xvYmFsIHJlc2l6ZSBldmVudC4gVGhpcyBub3RpZmllcyBjb21wb25lbnRzIHRoYXQgZW1wbG95IHZpcnR1YWwgc2Nyb2xsaW5nXHJcbiAgICAgICAgLy8gdGhhdCB0aGVpciB2aWV3cG9ydCBtYXkgaGF2ZSBjaGFuZ2VkLlxyXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KFwicmVzaXplXCIpKTtcclxuICAgICAgICB9LCAxKTtcclxuICAgIH0sXHJcbiAgICByZXNldDogZnVuY3Rpb24gKHdpbGxVbm1vdW50KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnN0YXRlLmFwcGxpZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZ2V0RE9NTm9kZSgpO1xyXG4gICAgICAgIHZhciBwcmV2ID0gbm9kZS5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xyXG4gICAgICAgIHZhciBuZXh0ID0gbm9kZS5uZXh0RWxlbWVudFNpYmxpbmc7XHJcblxyXG4gICAgICAgIHByZXYuc3R5bGUuZmxleCA9IFwiXCI7XHJcbiAgICAgICAgbmV4dC5zdHlsZS5mbGV4ID0gXCJcIjtcclxuXHJcbiAgICAgICAgaWYgKCF3aWxsVW5tb3VudCkge1xyXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKHtcclxuICAgICAgICAgICAgICAgIGFwcGxpZWQ6IGZhbHNlXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLm9uUmVzaXplKCk7XHJcbiAgICB9LFxyXG4gICAgY29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnJlc2V0KHRydWUpO1xyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBjbGFzc05hbWUgPSBcInNwbGl0dGVyXCI7XHJcbiAgICAgICAgaWYgKHRoaXMucHJvcHMuYXhpcyA9PT0gXCJ4XCIpIHtcclxuICAgICAgICAgICAgY2xhc3NOYW1lICs9IFwiIHNwbGl0dGVyLXhcIjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCIgc3BsaXR0ZXIteVwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17Y2xhc3NOYW1lfT5cclxuICAgICAgICAgICAgICAgIDxkaXYgb25Nb3VzZURvd249e3RoaXMub25Nb3VzZURvd259IGRyYWdnYWJsZT1cInRydWVcIj48L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFN0YXRlOiBTdGF0ZSxcclxuICAgIE5hdmlnYXRpb246IE5hdmlnYXRpb24sXHJcbiAgICBTdGlja3lIZWFkTWl4aW46IFN0aWNreUhlYWRNaXhpbixcclxuICAgIEF1dG9TY3JvbGxNaXhpbjogQXV0b1Njcm9sbE1peGluLFxyXG4gICAgU3BsaXR0ZXI6IFNwbGl0dGVyXHJcbn0iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XHJcbnZhciBjb21tb24gPSByZXF1aXJlKFwiLi9jb21tb24uanNcIik7XHJcbnZhciBWaXJ0dWFsU2Nyb2xsTWl4aW4gPSByZXF1aXJlKFwiLi92aXJ0dWFsc2Nyb2xsLmpzXCIpO1xyXG52YXIgdmlld3MgPSByZXF1aXJlKFwiLi4vc3RvcmUvdmlldy5qc1wiKTtcclxuXHJcbnZhciBMb2dNZXNzYWdlID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy5wcm9wcy5lbnRyeTtcclxuICAgICAgICB2YXIgaW5kaWNhdG9yO1xyXG4gICAgICAgIHN3aXRjaCAoZW50cnkubGV2ZWwpIHtcclxuICAgICAgICAgICAgY2FzZSBcIndlYlwiOlxyXG4gICAgICAgICAgICAgICAgaW5kaWNhdG9yID0gPGkgY2xhc3NOYW1lPVwiZmEgZmEtZncgZmEtaHRtbDVcIj48L2k+O1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJkZWJ1Z1wiOlxyXG4gICAgICAgICAgICAgICAgaW5kaWNhdG9yID0gPGkgY2xhc3NOYW1lPVwiZmEgZmEtZncgZmEtYnVnXCI+PC9pPjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgaW5kaWNhdG9yID0gPGkgY2xhc3NOYW1lPVwiZmEgZmEtZncgZmEtaW5mb1wiPjwvaT47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICB7IGluZGljYXRvciB9IHtlbnRyeS5tZXNzYWdlfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApO1xyXG4gICAgfSxcclxuICAgIHNob3VsZENvbXBvbmVudFVwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gbG9nIGVudHJpZXMgYXJlIGltbXV0YWJsZS5cclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgRXZlbnRMb2dDb250ZW50cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIG1peGluczogW2NvbW1vbi5BdXRvU2Nyb2xsTWl4aW4sIFZpcnR1YWxTY3JvbGxNaXhpbl0sXHJcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBsb2c6IFtdXHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcbiAgICBjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLm9wZW5WaWV3KHRoaXMucHJvcHMuZXZlbnRTdG9yZSk7XHJcbiAgICB9LFxyXG4gICAgY29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmNsb3NlVmlldygpO1xyXG4gICAgfSxcclxuICAgIG9wZW5WaWV3OiBmdW5jdGlvbiAoc3RvcmUpIHtcclxuICAgICAgICB2YXIgdmlldyA9IG5ldyB2aWV3cy5TdG9yZVZpZXcoc3RvcmUsIGZ1bmN0aW9uIChlbnRyeSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wcy5maWx0ZXJbZW50cnkubGV2ZWxdO1xyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XHJcbiAgICAgICAgICAgIHZpZXc6IHZpZXdcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdmlldy5hZGRMaXN0ZW5lcihcImFkZFwiLCB0aGlzLm9uRXZlbnRMb2dDaGFuZ2UpO1xyXG4gICAgICAgIHZpZXcuYWRkTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLm9uRXZlbnRMb2dDaGFuZ2UpO1xyXG4gICAgfSxcclxuICAgIGNsb3NlVmlldzogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuc3RhdGUudmlldy5jbG9zZSgpO1xyXG4gICAgfSxcclxuICAgIG9uRXZlbnRMb2dDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcclxuICAgICAgICAgICAgbG9nOiB0aGlzLnN0YXRlLnZpZXcubGlzdFxyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuICAgIGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHM6IGZ1bmN0aW9uIChuZXh0UHJvcHMpIHtcclxuICAgICAgICBpZiAobmV4dFByb3BzLmZpbHRlciAhPT0gdGhpcy5wcm9wcy5maWx0ZXIpIHtcclxuICAgICAgICAgICAgdGhpcy5wcm9wcy5maWx0ZXIgPSBuZXh0UHJvcHMuZmlsdGVyOyAvLyBEaXJ0eTogTWFrZSBzdXJlIHRoYXQgdmlldyBmaWx0ZXIgc2VlcyB0aGUgdXBkYXRlLlxyXG4gICAgICAgICAgICB0aGlzLnN0YXRlLnZpZXcucmVjYWxjdWxhdGUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG5leHRQcm9wcy5ldmVudFN0b3JlICE9PSB0aGlzLnByb3BzLmV2ZW50U3RvcmUpIHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZVZpZXcoKTtcclxuICAgICAgICAgICAgdGhpcy5vcGVuVmlldyhuZXh0UHJvcHMuZXZlbnRTdG9yZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHJvd0hlaWdodDogNDUsXHJcbiAgICAgICAgICAgIHJvd0hlaWdodE1pbjogMTUsXHJcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyVGFnTmFtZTogXCJkaXZcIlxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyUm93OiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHJldHVybiA8TG9nTWVzc2FnZSBrZXk9e2VsZW0uaWR9IGVudHJ5PXtlbGVtfS8+O1xyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciByb3dzID0gdGhpcy5yZW5kZXJSb3dzKHRoaXMuc3RhdGUubG9nKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIDxwcmUgb25TY3JvbGw9e3RoaXMub25TY3JvbGx9PlxyXG4gICAgICAgICAgICB7IHRoaXMuZ2V0UGxhY2Vob2xkZXJUb3AodGhpcy5zdGF0ZS5sb2cubGVuZ3RoKSB9XHJcbiAgICAgICAgICAgIHtyb3dzfVxyXG4gICAgICAgICAgICB7IHRoaXMuZ2V0UGxhY2Vob2xkZXJCb3R0b20odGhpcy5zdGF0ZS5sb2cubGVuZ3RoKSB9XHJcbiAgICAgICAgPC9wcmU+O1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBUb2dnbGVGaWx0ZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICB0b2dnbGU6IGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLnByb3BzLnRvZ2dsZUxldmVsKHRoaXMucHJvcHMubmFtZSk7XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGNsYXNzTmFtZSA9IFwibGFiZWwgXCI7XHJcbiAgICAgICAgaWYgKHRoaXMucHJvcHMuYWN0aXZlKSB7XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcImxhYmVsLXByaW1hcnlcIjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCJsYWJlbC1kZWZhdWx0XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxhXHJcbiAgICAgICAgICAgICAgICBocmVmPVwiI1wiXHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3RoaXMudG9nZ2xlfT5cclxuICAgICAgICAgICAgICAgIHt0aGlzLnByb3BzLm5hbWV9XHJcbiAgICAgICAgICAgIDwvYT5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBFdmVudExvZyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGZpbHRlcjoge1xyXG4gICAgICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIFwiaW5mb1wiOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgXCJ3ZWJcIjogdHJ1ZVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBkID0ge307XHJcbiAgICAgICAgZFtRdWVyeS5TSE9XX0VWRU5UTE9HXSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLnNldFF1ZXJ5KGQpO1xyXG4gICAgfSxcclxuICAgIHRvZ2dsZUxldmVsOiBmdW5jdGlvbiAobGV2ZWwpIHtcclxuICAgICAgICB2YXIgZmlsdGVyID0gXy5leHRlbmQoe30sIHRoaXMuc3RhdGUuZmlsdGVyKTtcclxuICAgICAgICBmaWx0ZXJbbGV2ZWxdID0gIWZpbHRlcltsZXZlbF07XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7ZmlsdGVyOiBmaWx0ZXJ9KTtcclxuICAgIH0sXHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImV2ZW50bG9nXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIEV2ZW50bG9nXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwdWxsLXJpZ2h0XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxUb2dnbGVGaWx0ZXIgbmFtZT1cImRlYnVnXCIgYWN0aXZlPXt0aGlzLnN0YXRlLmZpbHRlci5kZWJ1Z30gdG9nZ2xlTGV2ZWw9e3RoaXMudG9nZ2xlTGV2ZWx9Lz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPFRvZ2dsZUZpbHRlciBuYW1lPVwiaW5mb1wiIGFjdGl2ZT17dGhpcy5zdGF0ZS5maWx0ZXIuaW5mb30gdG9nZ2xlTGV2ZWw9e3RoaXMudG9nZ2xlTGV2ZWx9Lz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPFRvZ2dsZUZpbHRlciBuYW1lPVwid2ViXCIgYWN0aXZlPXt0aGlzLnN0YXRlLmZpbHRlci53ZWJ9IHRvZ2dsZUxldmVsPXt0aGlzLnRvZ2dsZUxldmVsfS8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIG9uQ2xpY2s9e3RoaXMuY2xvc2V9IGNsYXNzTmFtZT1cImZhIGZhLWNsb3NlXCI+PC9pPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPEV2ZW50TG9nQ29udGVudHMgZmlsdGVyPXt0aGlzLnN0YXRlLmZpbHRlcn0gZXZlbnRTdG9yZT17dGhpcy5wcm9wcy5ldmVudFN0b3JlfS8+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFdmVudExvZzsiLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XHJcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcclxuXHJcbnZhciBjb21tb24gPSByZXF1aXJlKFwiLi9jb21tb24uanNcIik7XHJcbnZhciBhY3Rpb25zID0gcmVxdWlyZShcIi4uL2FjdGlvbnMuanNcIik7XHJcbnZhciBmbG93dXRpbHMgPSByZXF1aXJlKFwiLi4vZmxvdy91dGlscy5qc1wiKTtcclxudmFyIHRvcHV0aWxzID0gcmVxdWlyZShcIi4uL3V0aWxzLmpzXCIpO1xyXG5cclxudmFyIE5hdkFjdGlvbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIG9uQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIHRoaXMucHJvcHMub25DbGljaygpO1xyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxhIHRpdGxlPXt0aGlzLnByb3BzLnRpdGxlfVxyXG4gICAgICAgICAgICAgICAgaHJlZj1cIiNcIlxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibmF2LWFjdGlvblwiXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXt0aGlzLm9uQ2xpY2t9PlxyXG4gICAgICAgICAgICAgICAgPGkgY2xhc3NOYW1lPXtcImZhIGZhLWZ3IFwiICsgdGhpcy5wcm9wcy5pY29ufT48L2k+XHJcbiAgICAgICAgICAgIDwvYT5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBGbG93RGV0YWlsTmF2ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XHJcblxyXG4gICAgICAgIHZhciB0YWJzID0gdGhpcy5wcm9wcy50YWJzLm1hcChmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgICAgICB2YXIgc3RyID0gZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGUuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgIHZhciBjbGFzc05hbWUgPSB0aGlzLnByb3BzLmFjdGl2ZSA9PT0gZSA/IFwiYWN0aXZlXCIgOiBcIlwiO1xyXG4gICAgICAgICAgICB2YXIgb25DbGljayA9IGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm9wcy5zZWxlY3RUYWIoZSk7XHJcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XHJcbiAgICAgICAgICAgIHJldHVybiA8YSBrZXk9e2V9XHJcbiAgICAgICAgICAgICAgICBocmVmPVwiI1wiXHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e29uQ2xpY2t9PntzdHJ9PC9hPjtcclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICB2YXIgYWNjZXB0QnV0dG9uID0gbnVsbDtcclxuICAgICAgICBpZihmbG93LmludGVyY2VwdGVkKXtcclxuICAgICAgICAgICAgYWNjZXB0QnV0dG9uID0gPE5hdkFjdGlvbiB0aXRsZT1cIlthXWNjZXB0IGludGVyY2VwdGVkIGZsb3dcIiBpY29uPVwiZmEtcGxheVwiIG9uQ2xpY2s9e2FjdGlvbnMuRmxvd0FjdGlvbnMuYWNjZXB0LmJpbmQobnVsbCwgZmxvdyl9IC8+O1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcmV2ZXJ0QnV0dG9uID0gbnVsbDtcclxuICAgICAgICBpZihmbG93Lm1vZGlmaWVkKXtcclxuICAgICAgICAgICAgcmV2ZXJ0QnV0dG9uID0gPE5hdkFjdGlvbiB0aXRsZT1cInJldmVydCBjaGFuZ2VzIHRvIGZsb3cgW1ZdXCIgaWNvbj1cImZhLWhpc3RvcnlcIiBvbkNsaWNrPXthY3Rpb25zLkZsb3dBY3Rpb25zLnJldmVydC5iaW5kKG51bGwsIGZsb3cpfSAvPjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxuYXYgcmVmPVwiaGVhZFwiIGNsYXNzTmFtZT1cIm5hdi10YWJzIG5hdi10YWJzLXNtXCI+XHJcbiAgICAgICAgICAgICAgICB7dGFic31cclxuICAgICAgICAgICAgICAgIDxOYXZBY3Rpb24gdGl0bGU9XCJbZF1lbGV0ZSBmbG93XCIgaWNvbj1cImZhLXRyYXNoXCIgb25DbGljaz17YWN0aW9ucy5GbG93QWN0aW9ucy5kZWxldGUuYmluZChudWxsLCBmbG93KX0gLz5cclxuICAgICAgICAgICAgICAgIDxOYXZBY3Rpb24gdGl0bGU9XCJbRF11cGxpY2F0ZSBmbG93XCIgaWNvbj1cImZhLWNvcHlcIiBvbkNsaWNrPXthY3Rpb25zLkZsb3dBY3Rpb25zLmR1cGxpY2F0ZS5iaW5kKG51bGwsIGZsb3cpfSAvPlxyXG4gICAgICAgICAgICAgICAgPE5hdkFjdGlvbiBkaXNhYmxlZCB0aXRsZT1cIltyXWVwbGF5IGZsb3dcIiBpY29uPVwiZmEtcmVwZWF0XCIgb25DbGljaz17YWN0aW9ucy5GbG93QWN0aW9ucy5yZXBsYXkuYmluZChudWxsLCBmbG93KX0gLz5cclxuICAgICAgICAgICAgICAgIHthY2NlcHRCdXR0b259XHJcbiAgICAgICAgICAgICAgICB7cmV2ZXJ0QnV0dG9ufVxyXG4gICAgICAgICAgICA8L25hdj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBIZWFkZXJzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJvd3MgPSB0aGlzLnByb3BzLm1lc3NhZ2UuaGVhZGVycy5tYXAoZnVuY3Rpb24gKGhlYWRlciwgaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgPHRyIGtleT17aX0+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cImhlYWRlci1uYW1lXCI+e2hlYWRlclswXSArIFwiOlwifTwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cImhlYWRlci12YWx1ZVwiPntoZWFkZXJbMV19PC90ZD5cclxuICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT1cImhlYWRlci10YWJsZVwiPlxyXG4gICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgIHtyb3dzfVxyXG4gICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgPC90YWJsZT5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBGbG93RGV0YWlsUmVxdWVzdCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xyXG4gICAgICAgIHZhciBmaXJzdF9saW5lID0gW1xyXG4gICAgICAgICAgICBmbG93LnJlcXVlc3QubWV0aG9kLFxyXG4gICAgICAgICAgICBmbG93dXRpbHMuUmVxdWVzdFV0aWxzLnByZXR0eV91cmwoZmxvdy5yZXF1ZXN0KSxcclxuICAgICAgICAgICAgXCJIVFRQL1wiICsgZmxvdy5yZXF1ZXN0Lmh0dHB2ZXJzaW9uLmpvaW4oXCIuXCIpXHJcbiAgICAgICAgXS5qb2luKFwiIFwiKTtcclxuICAgICAgICB2YXIgY29udGVudCA9IG51bGw7XHJcbiAgICAgICAgaWYgKGZsb3cucmVxdWVzdC5jb250ZW50TGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICBjb250ZW50ID0gXCJSZXF1ZXN0IENvbnRlbnQgU2l6ZTogXCIgKyB0b3B1dGlscy5mb3JtYXRTaXplKGZsb3cucmVxdWVzdC5jb250ZW50TGVuZ3RoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb250ZW50ID0gPGRpdiBjbGFzc05hbWU9XCJhbGVydCBhbGVydC1pbmZvXCI+Tm8gQ29udGVudDwvZGl2PjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vVE9ETzogU3R5bGluZ1xyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8c2VjdGlvbj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmlyc3QtbGluZVwiPnsgZmlyc3RfbGluZSB9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8SGVhZGVycyBtZXNzYWdlPXtmbG93LnJlcXVlc3R9Lz5cclxuICAgICAgICAgICAgICAgIDxoci8+XHJcbiAgICAgICAgICAgICAgICB7Y29udGVudH1cclxuICAgICAgICAgICAgPC9zZWN0aW9uPlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIEZsb3dEZXRhaWxSZXNwb25zZSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xyXG4gICAgICAgIHZhciBmaXJzdF9saW5lID0gW1xyXG4gICAgICAgICAgICBcIkhUVFAvXCIgKyBmbG93LnJlc3BvbnNlLmh0dHB2ZXJzaW9uLmpvaW4oXCIuXCIpLFxyXG4gICAgICAgICAgICBmbG93LnJlc3BvbnNlLmNvZGUsXHJcbiAgICAgICAgICAgIGZsb3cucmVzcG9uc2UubXNnXHJcbiAgICAgICAgXS5qb2luKFwiIFwiKTtcclxuICAgICAgICB2YXIgY29udGVudCA9IG51bGw7XHJcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UuY29udGVudExlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgY29udGVudCA9IFwiUmVzcG9uc2UgQ29udGVudCBTaXplOiBcIiArIHRvcHV0aWxzLmZvcm1hdFNpemUoZmxvdy5yZXNwb25zZS5jb250ZW50TGVuZ3RoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb250ZW50ID0gPGRpdiBjbGFzc05hbWU9XCJhbGVydCBhbGVydC1pbmZvXCI+Tm8gQ29udGVudDwvZGl2PjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vVE9ETzogU3R5bGluZ1xyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8c2VjdGlvbj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmlyc3QtbGluZVwiPnsgZmlyc3RfbGluZSB9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8SGVhZGVycyBtZXNzYWdlPXtmbG93LnJlc3BvbnNlfS8+XHJcbiAgICAgICAgICAgICAgICA8aHIvPlxyXG4gICAgICAgICAgICAgICAge2NvbnRlbnR9XHJcbiAgICAgICAgICAgIDwvc2VjdGlvbj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBGbG93RGV0YWlsRXJyb3IgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8c2VjdGlvbj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWxlcnQgYWxlcnQtd2FybmluZ1wiPlxyXG4gICAgICAgICAgICAgICAge2Zsb3cuZXJyb3IubXNnfVxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzbWFsbD57IHRvcHV0aWxzLmZvcm1hdFRpbWVTdGFtcChmbG93LmVycm9yLnRpbWVzdGFtcCkgfTwvc21hbGw+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9zZWN0aW9uPlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIFRpbWVTdGFtcCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMucHJvcHMudCkge1xyXG4gICAgICAgICAgICAvL3Nob3VsZCBiZSByZXR1cm4gbnVsbCwgYnV0IHRoYXQgdHJpZ2dlcnMgYSBSZWFjdCBidWcuXHJcbiAgICAgICAgICAgIHJldHVybiA8dHI+PC90cj47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgdHMgPSB0b3B1dGlscy5mb3JtYXRUaW1lU3RhbXAodGhpcy5wcm9wcy50KTtcclxuXHJcbiAgICAgICAgdmFyIGRlbHRhO1xyXG4gICAgICAgIGlmICh0aGlzLnByb3BzLmRlbHRhVG8pIHtcclxuICAgICAgICAgICAgZGVsdGEgPSB0b3B1dGlscy5mb3JtYXRUaW1lRGVsdGEoMTAwMCAqICh0aGlzLnByb3BzLnQgLSB0aGlzLnByb3BzLmRlbHRhVG8pKTtcclxuICAgICAgICAgICAgZGVsdGEgPSA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LW11dGVkXCI+e1wiKFwiICsgZGVsdGEgKyBcIilcIn08L3NwYW4+O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGRlbHRhID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiA8dHI+XHJcbiAgICAgICAgICAgIDx0ZD57dGhpcy5wcm9wcy50aXRsZSArIFwiOlwifTwvdGQ+XHJcbiAgICAgICAgICAgIDx0ZD57dHN9IHtkZWx0YX08L3RkPlxyXG4gICAgICAgIDwvdHI+O1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBDb25uZWN0aW9uSW5mbyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuXHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgY29ubiA9IHRoaXMucHJvcHMuY29ubjtcclxuICAgICAgICB2YXIgYWRkcmVzcyA9IGNvbm4uYWRkcmVzcy5hZGRyZXNzLmpvaW4oXCI6XCIpO1xyXG5cclxuICAgICAgICB2YXIgc25pID0gPHRyIGtleT1cInNuaVwiPjwvdHI+OyAvL3Nob3VsZCBiZSBudWxsLCBidXQgdGhhdCB0cmlnZ2VycyBhIFJlYWN0IGJ1Zy5cclxuICAgICAgICBpZiAoY29ubi5zbmkpIHtcclxuICAgICAgICAgICAgc25pID0gPHRyIGtleT1cInNuaVwiPlxyXG4gICAgICAgICAgICAgICAgPHRkPlxyXG4gICAgICAgICAgICAgICAgICAgIDxhYmJyIHRpdGxlPVwiVExTIFNlcnZlciBOYW1lIEluZGljYXRpb25cIj5UTFMgU05JOjwvYWJicj5cclxuICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICA8dGQ+e2Nvbm4uc25pfTwvdGQ+XHJcbiAgICAgICAgICAgIDwvdHI+O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwiY29ubmVjdGlvbi10YWJsZVwiPlxyXG4gICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0ciBrZXk9XCJhZGRyZXNzXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD5BZGRyZXNzOjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD57YWRkcmVzc308L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAge3NuaX1cclxuICAgICAgICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgQ2VydGlmaWNhdGVJbmZvID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgLy9UT0RPOiBXZSBzaG91bGQgZmV0Y2ggaHVtYW4tcmVhZGFibGUgY2VydGlmaWNhdGUgcmVwcmVzZW50YXRpb25cclxuICAgICAgICAvLyBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcclxuICAgICAgICB2YXIgY2xpZW50X2Nvbm4gPSBmbG93LmNsaWVudF9jb25uO1xyXG4gICAgICAgIHZhciBzZXJ2ZXJfY29ubiA9IGZsb3cuc2VydmVyX2Nvbm47XHJcblxyXG4gICAgICAgIHZhciBwcmVTdHlsZSA9IHttYXhIZWlnaHQ6IDEwMH07XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAge2NsaWVudF9jb25uLmNlcnQgPyA8aDQ+Q2xpZW50IENlcnRpZmljYXRlPC9oND4gOiBudWxsfVxyXG4gICAgICAgICAgICB7Y2xpZW50X2Nvbm4uY2VydCA/IDxwcmUgc3R5bGU9e3ByZVN0eWxlfT57Y2xpZW50X2Nvbm4uY2VydH08L3ByZT4gOiBudWxsfVxyXG5cclxuICAgICAgICAgICAge3NlcnZlcl9jb25uLmNlcnQgPyA8aDQ+U2VydmVyIENlcnRpZmljYXRlPC9oND4gOiBudWxsfVxyXG4gICAgICAgICAgICB7c2VydmVyX2Nvbm4uY2VydCA/IDxwcmUgc3R5bGU9e3ByZVN0eWxlfT57c2VydmVyX2Nvbm4uY2VydH08L3ByZT4gOiBudWxsfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBUaW1pbmcgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcclxuICAgICAgICB2YXIgc2MgPSBmbG93LnNlcnZlcl9jb25uO1xyXG4gICAgICAgIHZhciBjYyA9IGZsb3cuY2xpZW50X2Nvbm47XHJcbiAgICAgICAgdmFyIHJlcSA9IGZsb3cucmVxdWVzdDtcclxuICAgICAgICB2YXIgcmVzcCA9IGZsb3cucmVzcG9uc2U7XHJcblxyXG4gICAgICAgIHZhciB0aW1lc3RhbXBzID0gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTZXJ2ZXIgY29ubi4gaW5pdGlhdGVkXCIsXHJcbiAgICAgICAgICAgICAgICB0OiBzYy50aW1lc3RhbXBfc3RhcnQsXHJcbiAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XHJcbiAgICAgICAgICAgIH0sIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlNlcnZlciBjb25uLiBUQ1AgaGFuZHNoYWtlXCIsXHJcbiAgICAgICAgICAgICAgICB0OiBzYy50aW1lc3RhbXBfdGNwX3NldHVwLFxyXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxyXG4gICAgICAgICAgICB9LCB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTZXJ2ZXIgY29ubi4gU1NMIGhhbmRzaGFrZVwiLFxyXG4gICAgICAgICAgICAgICAgdDogc2MudGltZXN0YW1wX3NzbF9zZXR1cCxcclxuICAgICAgICAgICAgICAgIGRlbHRhVG86IHJlcS50aW1lc3RhbXBfc3RhcnRcclxuICAgICAgICAgICAgfSwge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiQ2xpZW50IGNvbm4uIGVzdGFibGlzaGVkXCIsXHJcbiAgICAgICAgICAgICAgICB0OiBjYy50aW1lc3RhbXBfc3RhcnQsXHJcbiAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XHJcbiAgICAgICAgICAgIH0sIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkNsaWVudCBjb25uLiBTU0wgaGFuZHNoYWtlXCIsXHJcbiAgICAgICAgICAgICAgICB0OiBjYy50aW1lc3RhbXBfc3NsX3NldHVwLFxyXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxyXG4gICAgICAgICAgICB9LCB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJGaXJzdCByZXF1ZXN0IGJ5dGVcIixcclxuICAgICAgICAgICAgICAgIHQ6IHJlcS50aW1lc3RhbXBfc3RhcnQsXHJcbiAgICAgICAgICAgIH0sIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlJlcXVlc3QgY29tcGxldGVcIixcclxuICAgICAgICAgICAgICAgIHQ6IHJlcS50aW1lc3RhbXBfZW5kLFxyXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgdGltZXN0YW1wcy5wdXNoKFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkZpcnN0IHJlc3BvbnNlIGJ5dGVcIixcclxuICAgICAgICAgICAgICAgICAgICB0OiByZXNwLnRpbWVzdGFtcF9zdGFydCxcclxuICAgICAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XHJcbiAgICAgICAgICAgICAgICB9LCB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiUmVzcG9uc2UgY29tcGxldGVcIixcclxuICAgICAgICAgICAgICAgICAgICB0OiByZXNwLnRpbWVzdGFtcF9lbmQsXHJcbiAgICAgICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9BZGQgdW5pcXVlIGtleSBmb3IgZWFjaCByb3cuXHJcbiAgICAgICAgdGltZXN0YW1wcy5mb3JFYWNoKGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgICAgIGUua2V5ID0gZS50aXRsZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGltZXN0YW1wcyA9IF8uc29ydEJ5KHRpbWVzdGFtcHMsICd0Jyk7XHJcblxyXG4gICAgICAgIHZhciByb3dzID0gdGltZXN0YW1wcy5tYXAoZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDxUaW1lU3RhbXAgey4uLmV9Lz47XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8aDQ+VGltaW5nPC9oND5cclxuICAgICAgICAgICAgICAgIDx0YWJsZSBjbGFzc05hbWU9XCJ0aW1pbmctdGFibGVcIj5cclxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAge3Jvd3N9XHJcbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIEZsb3dEZXRhaWxDb25uZWN0aW9uSW5mbyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xyXG4gICAgICAgIHZhciBjbGllbnRfY29ubiA9IGZsb3cuY2xpZW50X2Nvbm47XHJcbiAgICAgICAgdmFyIHNlcnZlcl9jb25uID0gZmxvdy5zZXJ2ZXJfY29ubjtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8c2VjdGlvbj5cclxuXHJcbiAgICAgICAgICAgICAgICA8aDQ+Q2xpZW50IENvbm5lY3Rpb248L2g0PlxyXG4gICAgICAgICAgICAgICAgPENvbm5lY3Rpb25JbmZvIGNvbm49e2NsaWVudF9jb25ufS8+XHJcblxyXG4gICAgICAgICAgICAgICAgPGg0PlNlcnZlciBDb25uZWN0aW9uPC9oND5cclxuICAgICAgICAgICAgICAgIDxDb25uZWN0aW9uSW5mbyBjb25uPXtzZXJ2ZXJfY29ubn0vPlxyXG5cclxuICAgICAgICAgICAgICAgIDxDZXJ0aWZpY2F0ZUluZm8gZmxvdz17Zmxvd30vPlxyXG5cclxuICAgICAgICAgICAgICAgIDxUaW1pbmcgZmxvdz17Zmxvd30vPlxyXG5cclxuICAgICAgICAgICAgPC9zZWN0aW9uPlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIGFsbFRhYnMgPSB7XHJcbiAgICByZXF1ZXN0OiBGbG93RGV0YWlsUmVxdWVzdCxcclxuICAgIHJlc3BvbnNlOiBGbG93RGV0YWlsUmVzcG9uc2UsXHJcbiAgICBlcnJvcjogRmxvd0RldGFpbEVycm9yLFxyXG4gICAgZGV0YWlsczogRmxvd0RldGFpbENvbm5lY3Rpb25JbmZvXHJcbn07XHJcblxyXG52YXIgRmxvd0RldGFpbCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIG1peGluczogW2NvbW1vbi5TdGlja3lIZWFkTWl4aW4sIGNvbW1vbi5OYXZpZ2F0aW9uLCBjb21tb24uU3RhdGVdLFxyXG4gICAgZ2V0VGFiczogZnVuY3Rpb24gKGZsb3cpIHtcclxuICAgICAgICB2YXIgdGFicyA9IFtdO1xyXG4gICAgICAgIFtcInJlcXVlc3RcIiwgXCJyZXNwb25zZVwiLCBcImVycm9yXCJdLmZvckVhY2goZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgaWYgKGZsb3dbZV0pIHtcclxuICAgICAgICAgICAgICAgIHRhYnMucHVzaChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRhYnMucHVzaChcImRldGFpbHNcIik7XHJcbiAgICAgICAgcmV0dXJuIHRhYnM7XHJcbiAgICB9LFxyXG4gICAgbmV4dFRhYjogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICB2YXIgdGFicyA9IHRoaXMuZ2V0VGFicyh0aGlzLnByb3BzLmZsb3cpO1xyXG4gICAgICAgIHZhciBjdXJyZW50SW5kZXggPSB0YWJzLmluZGV4T2YodGhpcy5nZXRQYXJhbXMoKS5kZXRhaWxUYWIpO1xyXG4gICAgICAgIC8vIEpTIG1vZHVsbyBvcGVyYXRvciBkb2Vzbid0IGNvcnJlY3QgbmVnYXRpdmUgbnVtYmVycywgbWFrZSBzdXJlIHRoYXQgd2UgYXJlIHBvc2l0aXZlLlxyXG4gICAgICAgIHZhciBuZXh0SW5kZXggPSAoY3VycmVudEluZGV4ICsgaSArIHRhYnMubGVuZ3RoKSAlIHRhYnMubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMuc2VsZWN0VGFiKHRhYnNbbmV4dEluZGV4XSk7XHJcbiAgICB9LFxyXG4gICAgc2VsZWN0VGFiOiBmdW5jdGlvbiAocGFuZWwpIHtcclxuICAgICAgICB0aGlzLnJlcGxhY2VXaXRoKFxyXG4gICAgICAgICAgICBcImZsb3dcIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgZmxvd0lkOiB0aGlzLmdldFBhcmFtcygpLmZsb3dJZCxcclxuICAgICAgICAgICAgICAgIGRldGFpbFRhYjogcGFuZWxcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XHJcbiAgICAgICAgdmFyIHRhYnMgPSB0aGlzLmdldFRhYnMoZmxvdyk7XHJcbiAgICAgICAgdmFyIGFjdGl2ZSA9IHRoaXMuZ2V0UGFyYW1zKCkuZGV0YWlsVGFiO1xyXG5cclxuICAgICAgICBpZiAoIV8uY29udGFpbnModGFicywgYWN0aXZlKSkge1xyXG4gICAgICAgICAgICBpZiAoYWN0aXZlID09PSBcInJlc3BvbnNlXCIgJiYgZmxvdy5lcnJvcikge1xyXG4gICAgICAgICAgICAgICAgYWN0aXZlID0gXCJlcnJvclwiO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFjdGl2ZSA9PT0gXCJlcnJvclwiICYmIGZsb3cucmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgIGFjdGl2ZSA9IFwicmVzcG9uc2VcIjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGFjdGl2ZSA9IHRhYnNbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RUYWIoYWN0aXZlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBUYWIgPSBhbGxUYWJzW2FjdGl2ZV07XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbG93LWRldGFpbFwiIG9uU2Nyb2xsPXt0aGlzLmFkanVzdEhlYWR9PlxyXG4gICAgICAgICAgICAgICAgPEZsb3dEZXRhaWxOYXYgcmVmPVwiaGVhZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgZmxvdz17Zmxvd31cclxuICAgICAgICAgICAgICAgICAgICB0YWJzPXt0YWJzfVxyXG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZT17YWN0aXZlfVxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdFRhYj17dGhpcy5zZWxlY3RUYWJ9Lz5cclxuICAgICAgICAgICAgICAgIDxUYWIgZmxvdz17Zmxvd30vPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgRmxvd0RldGFpbDogRmxvd0RldGFpbFxyXG59OyIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcclxudmFyIGZsb3d1dGlscyA9IHJlcXVpcmUoXCIuLi9mbG93L3V0aWxzLmpzXCIpO1xyXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiLi4vdXRpbHMuanNcIik7XHJcblxyXG52YXIgVExTQ29sdW1uID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgc3RhdGljczoge1xyXG4gICAgICAgIHJlbmRlclRpdGxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiA8dGgga2V5PVwidGxzXCIgY2xhc3NOYW1lPVwiY29sLXRsc1wiPjwvdGg+O1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcclxuICAgICAgICB2YXIgc3NsID0gKGZsb3cucmVxdWVzdC5zY2hlbWUgPT0gXCJodHRwc1wiKTtcclxuICAgICAgICB2YXIgY2xhc3NlcztcclxuICAgICAgICBpZiAoc3NsKSB7XHJcbiAgICAgICAgICAgIGNsYXNzZXMgPSBcImNvbC10bHMgY29sLXRscy1odHRwc1wiO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNsYXNzZXMgPSBcImNvbC10bHMgY29sLXRscy1odHRwXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiA8dGQgY2xhc3NOYW1lPXtjbGFzc2VzfT48L3RkPjtcclxuICAgIH1cclxufSk7XHJcblxyXG5cclxudmFyIEljb25Db2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICBzdGF0aWNzOiB7XHJcbiAgICAgICAgcmVuZGVyVGl0bGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDx0aCBrZXk9XCJpY29uXCIgY2xhc3NOYW1lPVwiY29sLWljb25cIj48L3RoPjtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XHJcblxyXG4gICAgICAgIHZhciBpY29uO1xyXG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250ZW50VHlwZSA9IGZsb3d1dGlscy5SZXNwb25zZVV0aWxzLmdldENvbnRlbnRUeXBlKGZsb3cucmVzcG9uc2UpO1xyXG5cclxuICAgICAgICAgICAgLy9UT0RPOiBXZSBzaG91bGQgYXNzaWduIGEgdHlwZSB0byB0aGUgZmxvdyBzb21ld2hlcmUgZWxzZS5cclxuICAgICAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UuY29kZSA9PSAzMDQpIHtcclxuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tbm90LW1vZGlmaWVkXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoMzAwIDw9IGZsb3cucmVzcG9uc2UuY29kZSAmJiBmbG93LnJlc3BvbnNlLmNvZGUgPCA0MDApIHtcclxuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tcmVkaXJlY3RcIjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSAmJiBjb250ZW50VHlwZS5pbmRleE9mKFwiaW1hZ2VcIikgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1pbWFnZVwiO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnRlbnRUeXBlICYmIGNvbnRlbnRUeXBlLmluZGV4T2YoXCJqYXZhc2NyaXB0XCIpID49IDApIHtcclxuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tanNcIjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSAmJiBjb250ZW50VHlwZS5pbmRleE9mKFwiY3NzXCIpID49IDApIHtcclxuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tY3NzXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29udGVudFR5cGUgJiYgY29udGVudFR5cGUuaW5kZXhPZihcImh0bWxcIikgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1kb2N1bWVudFwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghaWNvbikge1xyXG4gICAgICAgICAgICBpY29uID0gXCJyZXNvdXJjZS1pY29uLXBsYWluXCI7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgaWNvbiArPSBcIiByZXNvdXJjZS1pY29uXCI7XHJcbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtaWNvblwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17aWNvbn0+PC9kaXY+XHJcbiAgICAgICAgPC90ZD47XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIFBhdGhDb2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICBzdGF0aWNzOiB7XHJcbiAgICAgICAgcmVuZGVyVGl0bGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDx0aCBrZXk9XCJwYXRoXCIgY2xhc3NOYW1lPVwiY29sLXBhdGhcIj5QYXRoPC90aD47XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xyXG4gICAgICAgIHJldHVybiA8dGQgY2xhc3NOYW1lPVwiY29sLXBhdGhcIj5cclxuICAgICAgICAgICAge2Zsb3cucmVxdWVzdC5pc19yZXBsYXkgPyA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1yZXBlYXQgcHVsbC1yaWdodFwiPjwvaT4gOiBudWxsfVxyXG4gICAgICAgICAgICB7Zmxvdy5pbnRlcmNlcHRlZCA/IDxpIGNsYXNzTmFtZT1cImZhIGZhLWZ3IGZhLXBhdXNlIHB1bGwtcmlnaHRcIj48L2k+IDogbnVsbH1cclxuICAgICAgICAgICAge2Zsb3cucmVxdWVzdC5zY2hlbWUgKyBcIjovL1wiICsgZmxvdy5yZXF1ZXN0Lmhvc3QgKyBmbG93LnJlcXVlc3QucGF0aH1cclxuICAgICAgICA8L3RkPjtcclxuICAgIH1cclxufSk7XHJcblxyXG5cclxudmFyIE1ldGhvZENvbHVtbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHN0YXRpY3M6IHtcclxuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gPHRoIGtleT1cIm1ldGhvZFwiIGNsYXNzTmFtZT1cImNvbC1tZXRob2RcIj5NZXRob2Q8L3RoPjtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XHJcbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtbWV0aG9kXCI+e2Zsb3cucmVxdWVzdC5tZXRob2R9PC90ZD47XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuXHJcbnZhciBTdGF0dXNDb2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICBzdGF0aWNzOiB7XHJcbiAgICAgICAgcmVuZGVyVGl0bGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDx0aCBrZXk9XCJzdGF0dXNcIiBjbGFzc05hbWU9XCJjb2wtc3RhdHVzXCI+U3RhdHVzPC90aD47XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xyXG4gICAgICAgIHZhciBzdGF0dXM7XHJcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgc3RhdHVzID0gZmxvdy5yZXNwb25zZS5jb2RlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHN0YXR1cyA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiA8dGQgY2xhc3NOYW1lPVwiY29sLXN0YXR1c1wiPntzdGF0dXN9PC90ZD47XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuXHJcbnZhciBTaXplQ29sdW1uID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgc3RhdGljczoge1xyXG4gICAgICAgIHJlbmRlclRpdGxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiA8dGgga2V5PVwic2l6ZVwiIGNsYXNzTmFtZT1cImNvbC1zaXplXCI+U2l6ZTwvdGg+O1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcclxuXHJcbiAgICAgICAgdmFyIHRvdGFsID0gZmxvdy5yZXF1ZXN0LmNvbnRlbnRMZW5ndGg7XHJcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgdG90YWwgKz0gZmxvdy5yZXNwb25zZS5jb250ZW50TGVuZ3RoIHx8IDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBzaXplID0gdXRpbHMuZm9ybWF0U2l6ZSh0b3RhbCk7XHJcbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtc2l6ZVwiPntzaXplfTwvdGQ+O1xyXG4gICAgfVxyXG59KTtcclxuXHJcblxyXG52YXIgVGltZUNvbHVtbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHN0YXRpY3M6IHtcclxuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gPHRoIGtleT1cInRpbWVcIiBjbGFzc05hbWU9XCJjb2wtdGltZVwiPlRpbWU8L3RoPjtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XHJcbiAgICAgICAgdmFyIHRpbWU7XHJcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgdGltZSA9IHV0aWxzLmZvcm1hdFRpbWVEZWx0YSgxMDAwICogKGZsb3cucmVzcG9uc2UudGltZXN0YW1wX2VuZCAtIGZsb3cucmVxdWVzdC50aW1lc3RhbXBfc3RhcnQpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aW1lID0gXCIuLi5cIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtdGltZVwiPnt0aW1lfTwvdGQ+O1xyXG4gICAgfVxyXG59KTtcclxuXHJcblxyXG52YXIgYWxsX2NvbHVtbnMgPSBbXHJcbiAgICBUTFNDb2x1bW4sXHJcbiAgICBJY29uQ29sdW1uLFxyXG4gICAgUGF0aENvbHVtbixcclxuICAgIE1ldGhvZENvbHVtbixcclxuICAgIFN0YXR1c0NvbHVtbixcclxuICAgIFNpemVDb2x1bW4sXHJcbiAgICBUaW1lQ29sdW1uXTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFsbF9jb2x1bW5zO1xyXG5cclxuXHJcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcclxudmFyIGNvbW1vbiA9IHJlcXVpcmUoXCIuL2NvbW1vbi5qc1wiKTtcclxudmFyIFZpcnR1YWxTY3JvbGxNaXhpbiA9IHJlcXVpcmUoXCIuL3ZpcnR1YWxzY3JvbGwuanNcIik7XHJcbnZhciBmbG93dGFibGVfY29sdW1ucyA9IHJlcXVpcmUoXCIuL2Zsb3d0YWJsZS1jb2x1bW5zLmpzXCIpO1xyXG5cclxudmFyIEZsb3dSb3cgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcclxuICAgICAgICB2YXIgY29sdW1ucyA9IHRoaXMucHJvcHMuY29sdW1ucy5tYXAoZnVuY3Rpb24gKENvbHVtbikge1xyXG4gICAgICAgICAgICByZXR1cm4gPENvbHVtbiBrZXk9e0NvbHVtbi5kaXNwbGF5TmFtZX0gZmxvdz17Zmxvd30vPjtcclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgIHZhciBjbGFzc05hbWUgPSBcIlwiO1xyXG4gICAgICAgIGlmICh0aGlzLnByb3BzLnNlbGVjdGVkKSB7XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcIiBzZWxlY3RlZFwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5wcm9wcy5oaWdobGlnaHRlZCkge1xyXG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCIgaGlnaGxpZ2h0ZWRcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZsb3cuaW50ZXJjZXB0ZWQpIHtcclxuICAgICAgICAgICAgY2xhc3NOYW1lICs9IFwiIGludGVyY2VwdGVkXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmbG93LnJlcXVlc3QpIHtcclxuICAgICAgICAgICAgY2xhc3NOYW1lICs9IFwiIGhhcy1yZXF1ZXN0XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcIiBoYXMtcmVzcG9uc2VcIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDx0ciBjbGFzc05hbWU9e2NsYXNzTmFtZX0gb25DbGljaz17dGhpcy5wcm9wcy5zZWxlY3RGbG93LmJpbmQobnVsbCwgZmxvdyl9PlxyXG4gICAgICAgICAgICAgICAge2NvbHVtbnN9XHJcbiAgICAgICAgICAgIDwvdHI+KTtcclxuICAgIH0sXHJcbiAgICBzaG91bGRDb21wb25lbnRVcGRhdGU6IGZ1bmN0aW9uIChuZXh0UHJvcHMpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAvLyBGdXJ0aGVyIG9wdGltaXphdGlvbiBjb3VsZCBiZSBkb25lIGhlcmVcclxuICAgICAgICAvLyBieSBjYWxsaW5nIGZvcmNlVXBkYXRlIG9uIGZsb3cgdXBkYXRlcywgc2VsZWN0aW9uIGNoYW5nZXMgYW5kIGNvbHVtbiBjaGFuZ2VzLlxyXG4gICAgICAgIC8vcmV0dXJuIChcclxuICAgICAgICAvLyh0aGlzLnByb3BzLmNvbHVtbnMubGVuZ3RoICE9PSBuZXh0UHJvcHMuY29sdW1ucy5sZW5ndGgpIHx8XHJcbiAgICAgICAgLy8odGhpcy5wcm9wcy5zZWxlY3RlZCAhPT0gbmV4dFByb3BzLnNlbGVjdGVkKVxyXG4gICAgICAgIC8vKTtcclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgRmxvd1RhYmxlSGVhZCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBjb2x1bW5zID0gdGhpcy5wcm9wcy5jb2x1bW5zLm1hcChmdW5jdGlvbiAoY29sdW1uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb2x1bW4ucmVuZGVyVGl0bGUoKTtcclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgIHJldHVybiA8dGhlYWQ+XHJcbiAgICAgICAgICAgIDx0cj57Y29sdW1uc308L3RyPlxyXG4gICAgICAgIDwvdGhlYWQ+O1xyXG4gICAgfVxyXG59KTtcclxuXHJcblxyXG52YXIgUk9XX0hFSUdIVCA9IDMyO1xyXG5cclxudmFyIEZsb3dUYWJsZSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIG1peGluczogW2NvbW1vbi5TdGlja3lIZWFkTWl4aW4sIGNvbW1vbi5BdXRvU2Nyb2xsTWl4aW4sIFZpcnR1YWxTY3JvbGxNaXhpbl0sXHJcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBjb2x1bW5zOiBmbG93dGFibGVfY29sdW1uc1xyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG4gICAgY29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMucHJvcHMudmlldykge1xyXG4gICAgICAgICAgICB0aGlzLnByb3BzLnZpZXcuYWRkTGlzdGVuZXIoXCJhZGRcIiwgdGhpcy5vbkNoYW5nZSk7XHJcbiAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5hZGRMaXN0ZW5lcihcInVwZGF0ZVwiLCB0aGlzLm9uQ2hhbmdlKTtcclxuICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3LmFkZExpc3RlbmVyKFwicmVtb3ZlXCIsIHRoaXMub25DaGFuZ2UpO1xyXG4gICAgICAgICAgICB0aGlzLnByb3BzLnZpZXcuYWRkTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLm9uQ2hhbmdlKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wczogZnVuY3Rpb24gKG5leHRQcm9wcykge1xyXG4gICAgICAgIGlmIChuZXh0UHJvcHMudmlldyAhPT0gdGhpcy5wcm9wcy52aWV3KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnByb3BzLnZpZXcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5yZW1vdmVMaXN0ZW5lcihcImFkZFwiKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5yZW1vdmVMaXN0ZW5lcihcInVwZGF0ZVwiKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5yZW1vdmVMaXN0ZW5lcihcInJlbW92ZVwiKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5yZW1vdmVMaXN0ZW5lcihcInJlY2FsY3VsYXRlXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG5leHRQcm9wcy52aWV3LmFkZExpc3RlbmVyKFwiYWRkXCIsIHRoaXMub25DaGFuZ2UpO1xyXG4gICAgICAgICAgICBuZXh0UHJvcHMudmlldy5hZGRMaXN0ZW5lcihcInVwZGF0ZVwiLCB0aGlzLm9uQ2hhbmdlKTtcclxuICAgICAgICAgICAgbmV4dFByb3BzLnZpZXcuYWRkTGlzdGVuZXIoXCJyZW1vdmVcIiwgdGhpcy5vbkNoYW5nZSk7XHJcbiAgICAgICAgICAgIG5leHRQcm9wcy52aWV3LmFkZExpc3RlbmVyKFwicmVjYWxjdWxhdGVcIiwgdGhpcy5vbkNoYW5nZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHJvd0hlaWdodDogUk9XX0hFSUdIVFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG4gICAgb25TY3JvbGxGbG93VGFibGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmFkanVzdEhlYWQoKTtcclxuICAgICAgICB0aGlzLm9uU2Nyb2xsKCk7XHJcbiAgICB9LFxyXG4gICAgb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmZvcmNlVXBkYXRlKCk7XHJcbiAgICB9LFxyXG4gICAgc2Nyb2xsSW50b1ZpZXc6IGZ1bmN0aW9uIChmbG93KSB7XHJcbiAgICAgICAgdGhpcy5zY3JvbGxSb3dJbnRvVmlldyhcclxuICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3LmluZGV4KGZsb3cpLFxyXG4gICAgICAgICAgICB0aGlzLnJlZnMuYm9keS5nZXRET01Ob2RlKCkub2Zmc2V0VG9wXHJcbiAgICAgICAgKTtcclxuICAgIH0sXHJcbiAgICByZW5kZXJSb3c6IGZ1bmN0aW9uIChmbG93KSB7XHJcbiAgICAgICAgdmFyIHNlbGVjdGVkID0gKGZsb3cgPT09IHRoaXMucHJvcHMuc2VsZWN0ZWQpO1xyXG4gICAgICAgIHZhciBoaWdobGlnaHRlZCA9XHJcbiAgICAgICAgICAgIChcclxuICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3Ll9oaWdobGlnaHQgJiZcclxuICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3Ll9oaWdobGlnaHRbZmxvdy5pZF1cclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIDxGbG93Um93IGtleT17Zmxvdy5pZH1cclxuICAgICAgICAgICAgcmVmPXtmbG93LmlkfVxyXG4gICAgICAgICAgICBmbG93PXtmbG93fVxyXG4gICAgICAgICAgICBjb2x1bW5zPXt0aGlzLnN0YXRlLmNvbHVtbnN9XHJcbiAgICAgICAgICAgIHNlbGVjdGVkPXtzZWxlY3RlZH1cclxuICAgICAgICAgICAgaGlnaGxpZ2h0ZWQ9e2hpZ2hsaWdodGVkfVxyXG4gICAgICAgICAgICBzZWxlY3RGbG93PXt0aGlzLnByb3BzLnNlbGVjdEZsb3d9XHJcbiAgICAgICAgLz47XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcInJlbmRlciBmbG93dGFibGVcIiwgdGhpcy5zdGF0ZS5zdGFydCwgdGhpcy5zdGF0ZS5zdG9wLCB0aGlzLnByb3BzLnNlbGVjdGVkKTtcclxuICAgICAgICB2YXIgZmxvd3MgPSB0aGlzLnByb3BzLnZpZXcgPyB0aGlzLnByb3BzLnZpZXcubGlzdCA6IFtdO1xyXG5cclxuICAgICAgICB2YXIgcm93cyA9IHRoaXMucmVuZGVyUm93cyhmbG93cyk7XHJcblxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxvdy10YWJsZVwiIG9uU2Nyb2xsPXt0aGlzLm9uU2Nyb2xsRmxvd1RhYmxlfT5cclxuICAgICAgICAgICAgICAgIDx0YWJsZT5cclxuICAgICAgICAgICAgICAgICAgICA8Rmxvd1RhYmxlSGVhZCByZWY9XCJoZWFkXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1ucz17dGhpcy5zdGF0ZS5jb2x1bW5zfS8+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRib2R5IHJlZj1cImJvZHlcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgeyB0aGlzLmdldFBsYWNlaG9sZGVyVG9wKGZsb3dzLmxlbmd0aCkgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7cm93c31cclxuICAgICAgICAgICAgICAgICAgICAgICAgeyB0aGlzLmdldFBsYWNlaG9sZGVyQm90dG9tKGZsb3dzLmxlbmd0aCkgfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRmxvd1RhYmxlO1xyXG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XHJcblxyXG52YXIgRm9vdGVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIG1vZGUgPSB0aGlzLnByb3BzLnNldHRpbmdzLm1vZGU7XHJcbiAgICAgICAgdmFyIGludGVyY2VwdCA9IHRoaXMucHJvcHMuc2V0dGluZ3MuaW50ZXJjZXB0O1xyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxmb290ZXI+XHJcbiAgICAgICAgICAgICAgICB7bW9kZSAhPSBcInJlZ3VsYXJcIiA/IDxzcGFuIGNsYXNzTmFtZT1cImxhYmVsIGxhYmVsLXN1Y2Nlc3NcIj57bW9kZX0gbW9kZTwvc3Bhbj4gOiBudWxsfVxyXG4gICAgICAgICAgICAgICAgJm5ic3A7XHJcbiAgICAgICAgICAgICAgICB7aW50ZXJjZXB0ID8gPHNwYW4gY2xhc3NOYW1lPVwibGFiZWwgbGFiZWwtc3VjY2Vzc1wiPkludGVyY2VwdDoge2ludGVyY2VwdH08L3NwYW4+IDogbnVsbH1cclxuICAgICAgICAgICAgPC9mb290ZXI+XHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZvb3RlcjsiLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XHJcbnZhciAkID0gcmVxdWlyZShcImpxdWVyeVwiKTtcclxuXHJcbnZhciBGaWx0ID0gcmVxdWlyZShcIi4uL2ZpbHQvZmlsdC5qc1wiKTtcclxudmFyIHV0aWxzID0gcmVxdWlyZShcIi4uL3V0aWxzLmpzXCIpO1xyXG5cclxudmFyIGNvbW1vbiA9IHJlcXVpcmUoXCIuL2NvbW1vbi5qc1wiKTtcclxuXHJcbnZhciBGaWx0ZXJEb2NzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgc3RhdGljczoge1xyXG4gICAgICAgIHhocjogZmFsc2UsXHJcbiAgICAgICAgZG9jOiBmYWxzZVxyXG4gICAgfSxcclxuICAgIGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICghRmlsdGVyRG9jcy5kb2MpIHtcclxuICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIgPSAkLmdldEpTT04oXCIvZmlsdGVyLWhlbHBcIikuZG9uZShmdW5jdGlvbiAoZG9jKSB7XHJcbiAgICAgICAgICAgICAgICBGaWx0ZXJEb2NzLmRvYyA9IGRvYztcclxuICAgICAgICAgICAgICAgIEZpbHRlckRvY3MueGhyID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoRmlsdGVyRG9jcy54aHIpIHtcclxuICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIuZG9uZShmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZvcmNlVXBkYXRlKCk7XHJcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICghRmlsdGVyRG9jcy5kb2MpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDxpIGNsYXNzTmFtZT1cImZhIGZhLXNwaW5uZXIgZmEtc3BpblwiPjwvaT47XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGNvbW1hbmRzID0gRmlsdGVyRG9jcy5kb2MuY29tbWFuZHMubWFwKGZ1bmN0aW9uIChjKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0ZD57Y1swXS5yZXBsYWNlKFwiIFwiLCAnXFx1MDBhMCcpfTwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRkPntjWzFdfTwvdGQ+XHJcbiAgICAgICAgICAgICAgICA8L3RyPjtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGNvbW1hbmRzLnB1c2goPHRyPlxyXG4gICAgICAgICAgICAgICAgPHRkIGNvbFNwYW49XCIyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cImh0dHBzOi8vbWl0bXByb3h5Lm9yZy9kb2MvZmVhdHVyZXMvZmlsdGVycy5odG1sXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0PVwiX2JsYW5rXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzTmFtZT1cImZhIGZhLWV4dGVybmFsLWxpbmtcIj48L2k+XHJcbiAgICAgICAgICAgICAgICAgICAgJm5ic3A7IG1pdG1wcm94eSBkb2NzPC9hPlxyXG4gICAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgPC90cj4pO1xyXG4gICAgICAgICAgICByZXR1cm4gPHRhYmxlIGNsYXNzTmFtZT1cInRhYmxlIHRhYmxlLWNvbmRlbnNlZFwiPlxyXG4gICAgICAgICAgICAgICAgPHRib2R5Pntjb21tYW5kc308L3Rib2R5PlxyXG4gICAgICAgICAgICA8L3RhYmxlPjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG52YXIgRmlsdGVySW5wdXQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAvLyBDb25zaWRlciBib3RoIGZvY3VzIGFuZCBtb3VzZW92ZXIgZm9yIHNob3dpbmcvaGlkaW5nIHRoZSB0b29sdGlwLFxyXG4gICAgICAgIC8vIGJlY2F1c2Ugb25CbHVyIG9mIHRoZSBpbnB1dCBpcyB0cmlnZ2VyZWQgYmVmb3JlIHRoZSBjbGljayBvbiB0aGUgdG9vbHRpcFxyXG4gICAgICAgIC8vIGZpbmFsaXplZCwgaGlkaW5nIHRoZSB0b29sdGlwIGp1c3QgYXMgdGhlIHVzZXIgY2xpY2tzIG9uIGl0LlxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLnByb3BzLnZhbHVlLFxyXG4gICAgICAgICAgICBmb2N1czogZmFsc2UsXHJcbiAgICAgICAgICAgIG1vdXNlZm9jdXM6IGZhbHNlXHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiAobmV4dFByb3BzKSB7XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7dmFsdWU6IG5leHRQcm9wcy52YWx1ZX0pO1xyXG4gICAgfSxcclxuICAgIG9uQ2hhbmdlOiBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIHZhciBuZXh0VmFsdWUgPSBlLnRhcmdldC52YWx1ZTtcclxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcclxuICAgICAgICAgICAgdmFsdWU6IG5leHRWYWx1ZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIC8vIE9ubHkgcHJvcGFnYXRlIHZhbGlkIGZpbHRlcnMgdXB3YXJkcy5cclxuICAgICAgICBpZiAodGhpcy5pc1ZhbGlkKG5leHRWYWx1ZSkpIHtcclxuICAgICAgICAgICAgdGhpcy5wcm9wcy5vbkNoYW5nZShuZXh0VmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBpc1ZhbGlkOiBmdW5jdGlvbiAoZmlsdCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIEZpbHQucGFyc2UoZmlsdCB8fCB0aGlzLnN0YXRlLnZhbHVlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGdldERlc2M6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZGVzYztcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBkZXNjID0gRmlsdC5wYXJzZSh0aGlzLnN0YXRlLnZhbHVlKS5kZXNjO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgZGVzYyA9IFwiXCIgKyBlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVzYyAhPT0gXCJ0cnVlXCIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRlc2M7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgIDxGaWx0ZXJEb2NzLz5cclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgb25Gb2N1czogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe2ZvY3VzOiB0cnVlfSk7XHJcbiAgICB9LFxyXG4gICAgb25CbHVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7Zm9jdXM6IGZhbHNlfSk7XHJcbiAgICB9LFxyXG4gICAgb25Nb3VzZUVudGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7bW91c2Vmb2N1czogdHJ1ZX0pO1xyXG4gICAgfSxcclxuICAgIG9uTW91c2VMZWF2ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe21vdXNlZm9jdXM6IGZhbHNlfSk7XHJcbiAgICB9LFxyXG4gICAgb25LZXlEb3duOiBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IHV0aWxzLktleS5FU0MgfHwgZS5rZXlDb2RlID09PSB1dGlscy5LZXkuRU5URVIpIHtcclxuICAgICAgICAgICAgdGhpcy5ibHVyKCk7XHJcbiAgICAgICAgICAgIC8vIElmIGNsb3NlZCB1c2luZyBFU0MvRU5URVIsIGhpZGUgdGhlIHRvb2x0aXAuXHJcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoe21vdXNlZm9jdXM6IGZhbHNlfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGJsdXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnJlZnMuaW5wdXQuZ2V0RE9NTm9kZSgpLmJsdXIoKTtcclxuICAgIH0sXHJcbiAgICBmb2N1czogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMucmVmcy5pbnB1dC5nZXRET01Ob2RlKCkuc2VsZWN0KCk7XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGlzVmFsaWQgPSB0aGlzLmlzVmFsaWQoKTtcclxuICAgICAgICB2YXIgaWNvbiA9IFwiZmEgZmEtZncgZmEtXCIgKyB0aGlzLnByb3BzLnR5cGU7XHJcbiAgICAgICAgdmFyIGdyb3VwQ2xhc3NOYW1lID0gXCJmaWx0ZXItaW5wdXQgaW5wdXQtZ3JvdXBcIiArIChpc1ZhbGlkID8gXCJcIiA6IFwiIGhhcy1lcnJvclwiKTtcclxuXHJcbiAgICAgICAgdmFyIHBvcG92ZXI7XHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUuZm9jdXMgfHwgdGhpcy5zdGF0ZS5tb3VzZWZvY3VzKSB7XHJcbiAgICAgICAgICAgIHBvcG92ZXIgPSAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInBvcG92ZXIgYm90dG9tXCIgb25Nb3VzZUVudGVyPXt0aGlzLm9uTW91c2VFbnRlcn0gb25Nb3VzZUxlYXZlPXt0aGlzLm9uTW91c2VMZWF2ZX0+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhcnJvd1wiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicG9wb3Zlci1jb250ZW50XCI+XHJcbiAgICAgICAgICAgICAgICAgICAge3RoaXMuZ2V0RGVzYygpfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17Z3JvdXBDbGFzc05hbWV9PlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiaW5wdXQtZ3JvdXAtYWRkb25cIj5cclxuICAgICAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9e2ljb259IHN0eWxlPXt7Y29sb3I6IHRoaXMucHJvcHMuY29sb3J9fT48L2k+XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBwbGFjZWhvbGRlcj17dGhpcy5wcm9wcy5wbGFjZWhvbGRlcn0gY2xhc3NOYW1lPVwiZm9ybS1jb250cm9sXCJcclxuICAgICAgICAgICAgICAgICAgICByZWY9XCJpbnB1dFwiXHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e3RoaXMub25DaGFuZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgb25Gb2N1cz17dGhpcy5vbkZvY3VzfVxyXG4gICAgICAgICAgICAgICAgICAgIG9uQmx1cj17dGhpcy5vbkJsdXJ9XHJcbiAgICAgICAgICAgICAgICAgICAgb25LZXlEb3duPXt0aGlzLm9uS2V5RG93bn1cclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17dGhpcy5zdGF0ZS52YWx1ZX0vPlxyXG4gICAgICAgICAgICAgICAge3BvcG92ZXJ9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIE1haW5NZW51ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgbWl4aW5zOiBbY29tbW9uLk5hdmlnYXRpb24sIGNvbW1vbi5TdGF0ZV0sXHJcbiAgICBzdGF0aWNzOiB7XHJcbiAgICAgICAgdGl0bGU6IFwiU3RhcnRcIixcclxuICAgICAgICByb3V0ZTogXCJmbG93c1wiXHJcbiAgICB9LFxyXG4gICAgb25GaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uICh2YWwpIHtcclxuICAgICAgICB2YXIgZCA9IHt9O1xyXG4gICAgICAgIGRbUXVlcnkuRklMVEVSXSA9IHZhbDtcclxuICAgICAgICB0aGlzLnNldFF1ZXJ5KGQpO1xyXG4gICAgfSxcclxuICAgIG9uSGlnaGxpZ2h0Q2hhbmdlOiBmdW5jdGlvbiAodmFsKSB7XHJcbiAgICAgICAgdmFyIGQgPSB7fTtcclxuICAgICAgICBkW1F1ZXJ5LkhJR0hMSUdIVF0gPSB2YWw7XHJcbiAgICAgICAgdGhpcy5zZXRRdWVyeShkKTtcclxuICAgIH0sXHJcbiAgICBvbkludGVyY2VwdENoYW5nZTogZnVuY3Rpb24gKHZhbCkge1xyXG4gICAgICAgIFNldHRpbmdzQWN0aW9ucy51cGRhdGUoe2ludGVyY2VwdDogdmFsfSk7XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGZpbHRlciA9IHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5GSUxURVJdIHx8IFwiXCI7XHJcbiAgICAgICAgdmFyIGhpZ2hsaWdodCA9IHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5ISUdITElHSFRdIHx8IFwiXCI7XHJcbiAgICAgICAgdmFyIGludGVyY2VwdCA9IHRoaXMucHJvcHMuc2V0dGluZ3MuaW50ZXJjZXB0IHx8IFwiXCI7XHJcblxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1lbnUtcm93XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPEZpbHRlcklucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRmlsdGVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImZpbHRlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPVwiYmxhY2tcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZmlsdGVyfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17dGhpcy5vbkZpbHRlckNoYW5nZX0gLz5cclxuICAgICAgICAgICAgICAgICAgICA8RmlsdGVySW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJIaWdobGlnaHRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGFnXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I9XCJoc2woNDgsIDEwMCUsIDUwJSlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aGlnaGxpZ2h0fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17dGhpcy5vbkhpZ2hsaWdodENoYW5nZX0vPlxyXG4gICAgICAgICAgICAgICAgICAgIDxGaWx0ZXJJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkludGVyY2VwdFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJwYXVzZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPVwiaHNsKDIwOCwgNTYlLCA1MyUpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2ludGVyY2VwdH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e3RoaXMub25JbnRlcmNlcHRDaGFuZ2V9Lz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjbGVhcmZpeFwiPjwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcblxyXG52YXIgVmlld01lbnUgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XHJcbiAgICBzdGF0aWNzOiB7XHJcbiAgICAgICAgdGl0bGU6IFwiVmlld1wiLFxyXG4gICAgICAgIHJvdXRlOiBcImZsb3dzXCJcclxuICAgIH0sXHJcbiAgICBtaXhpbnM6IFtjb21tb24uTmF2aWdhdGlvbiwgY29tbW9uLlN0YXRlXSxcclxuICAgIHRvZ2dsZUV2ZW50TG9nOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGQgPSB7fTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5TSE9XX0VWRU5UTE9HXSkge1xyXG4gICAgICAgICAgICBkW1F1ZXJ5LlNIT1dfRVZFTlRMT0ddID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGRbUXVlcnkuU0hPV19FVkVOVExPR10gPSBcInRcIjsgLy8gYW55IG5vbi1mYWxzZSB2YWx1ZSB3aWxsIGRvIGl0LCBrZWVwIGl0IHNob3J0XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnNldFF1ZXJ5KGQpO1xyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBzaG93RXZlbnRMb2cgPSB0aGlzLmdldFF1ZXJ5KClbUXVlcnkuU0hPV19FVkVOVExPR107XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e1wiYnRuIFwiICsgKHNob3dFdmVudExvZyA/IFwiYnRuLXByaW1hcnlcIiA6IFwiYnRuLWRlZmF1bHRcIil9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17dGhpcy50b2dnbGVFdmVudExvZ30+XHJcbiAgICAgICAgICAgICAgICAgICAgPGkgY2xhc3NOYW1lPVwiZmEgZmEtZGF0YWJhc2VcIj48L2k+XHJcbiAgICAgICAgICAgICAgICAmbmJzcDtTaG93IEV2ZW50bG9nXHJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDxzcGFuPiA8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuXHJcbnZhciBSZXBvcnRzTWVudSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHN0YXRpY3M6IHtcclxuICAgICAgICB0aXRsZTogXCJWaXN1YWxpemF0aW9uXCIsXHJcbiAgICAgICAgcm91dGU6IFwicmVwb3J0c1wiXHJcbiAgICB9LFxyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIDxkaXY+UmVwb3J0cyBNZW51PC9kaXY+O1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnZhciBGaWxlTWVudSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNob3dGaWxlTWVudTogZmFsc2VcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuICAgIGhhbmRsZUZpbGVDbGljazogZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgaWYgKCF0aGlzLnN0YXRlLnNob3dGaWxlTWVudSkge1xyXG4gICAgICAgICAgICB2YXIgY2xvc2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldFN0YXRlKHtzaG93RmlsZU1lbnU6IGZhbHNlfSk7XHJcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgY2xvc2UpO1xyXG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XHJcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBjbG9zZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKHtcclxuICAgICAgICAgICAgICAgIHNob3dGaWxlTWVudTogdHJ1ZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgaGFuZGxlTmV3Q2xpY2s6IGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGlmIChjb25maXJtKFwiRGVsZXRlIGFsbCBmbG93cz9cIikpIHtcclxuICAgICAgICAgICAgRmxvd0FjdGlvbnMuY2xlYXIoKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgaGFuZGxlT3BlbkNsaWNrOiBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwidW5pbXBsZW1lbnRlZDogaGFuZGxlT3BlbkNsaWNrXCIpO1xyXG4gICAgfSxcclxuICAgIGhhbmRsZVNhdmVDbGljazogZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcInVuaW1wbGVtZW50ZWQ6IGhhbmRsZVNhdmVDbGlja1wiKTtcclxuICAgIH0sXHJcbiAgICBoYW5kbGVTaHV0ZG93bkNsaWNrOiBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwidW5pbXBsZW1lbnRlZDogaGFuZGxlU2h1dGRvd25DbGlja1wiKTtcclxuICAgIH0sXHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZmlsZU1lbnVDbGFzcyA9IFwiZHJvcGRvd24gcHVsbC1sZWZ0XCIgKyAodGhpcy5zdGF0ZS5zaG93RmlsZU1lbnUgPyBcIiBvcGVuXCIgOiBcIlwiKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2ZpbGVNZW51Q2xhc3N9PlxyXG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBjbGFzc05hbWU9XCJzcGVjaWFsXCIgb25DbGljaz17dGhpcy5oYW5kbGVGaWxlQ2xpY2t9PiBtaXRtcHJveHkgPC9hPlxyXG4gICAgICAgICAgICAgICAgPHVsIGNsYXNzTmFtZT1cImRyb3Bkb3duLW1lbnVcIiByb2xlPVwibWVudVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxsaT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBvbkNsaWNrPXt0aGlzLmhhbmRsZU5ld0NsaWNrfT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzTmFtZT1cImZhIGZhLWZ3IGZhLWZpbGVcIj48L2k+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBOZXdcclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbGk+XHJcbiAgICAgICAgICAgICAgICAgICAgPGxpIHJvbGU9XCJwcmVzZW50YXRpb25cIiBjbGFzc05hbWU9XCJkaXZpZGVyXCI+PC9saT5cclxuICAgICAgICAgICAgICAgICAgICA8bGk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxhIGhyZWY9XCJodHRwOi8vbWl0bS5pdC9cIiB0YXJnZXQ9XCJfYmxhbmtcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzTmFtZT1cImZhIGZhLWZ3IGZhLWV4dGVybmFsLWxpbmtcIj48L2k+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBJbnN0YWxsIENlcnRpZmljYXRlcy4uLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2E+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9saT5cclxuICAgICAgICAgICAgICAgIHsvKlxyXG4gICAgICAgICAgICAgICAgIDxsaT5cclxuICAgICAgICAgICAgICAgICA8YSBocmVmPVwiI1wiIG9uQ2xpY2s9e3RoaXMuaGFuZGxlT3BlbkNsaWNrfT5cclxuICAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1mb2xkZXItb3BlblwiPjwvaT5cclxuICAgICAgICAgICAgICAgICBPcGVuXHJcbiAgICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICAgICAgIDwvbGk+XHJcbiAgICAgICAgICAgICAgICAgPGxpPlxyXG4gICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgb25DbGljaz17dGhpcy5oYW5kbGVTYXZlQ2xpY2t9PlxyXG4gICAgICAgICAgICAgICAgIDxpIGNsYXNzTmFtZT1cImZhIGZhLWZ3IGZhLXNhdmVcIj48L2k+XHJcbiAgICAgICAgICAgICAgICAgU2F2ZVxyXG4gICAgICAgICAgICAgICAgIDwvYT5cclxuICAgICAgICAgICAgICAgICA8L2xpPlxyXG4gICAgICAgICAgICAgICAgIDxsaSByb2xlPVwicHJlc2VudGF0aW9uXCIgY2xhc3NOYW1lPVwiZGl2aWRlclwiPjwvbGk+XHJcbiAgICAgICAgICAgICAgICAgPGxpPlxyXG4gICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgb25DbGljaz17dGhpcy5oYW5kbGVTaHV0ZG93bkNsaWNrfT5cclxuICAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1wbHVnXCI+PC9pPlxyXG4gICAgICAgICAgICAgICAgIFNodXRkb3duXHJcbiAgICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICAgICAgIDwvbGk+XHJcbiAgICAgICAgICAgICAgICAgKi99XHJcbiAgICAgICAgICAgICAgICA8L3VsPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcblxyXG52YXIgaGVhZGVyX2VudHJpZXMgPSBbTWFpbk1lbnUsIFZpZXdNZW51IC8qLCBSZXBvcnRzTWVudSAqL107XHJcblxyXG5cclxudmFyIEhlYWRlciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIG1peGluczogW2NvbW1vbi5OYXZpZ2F0aW9uXSxcclxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFjdGl2ZTogaGVhZGVyX2VudHJpZXNbMF1cclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuICAgIGhhbmRsZUNsaWNrOiBmdW5jdGlvbiAoYWN0aXZlLCBlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIHRoaXMucmVwbGFjZVdpdGgoYWN0aXZlLnJvdXRlKTtcclxuICAgICAgICB0aGlzLnNldFN0YXRlKHthY3RpdmU6IGFjdGl2ZX0pO1xyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBoZWFkZXIgPSBoZWFkZXJfZW50cmllcy5tYXAoZnVuY3Rpb24gKGVudHJ5LCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gUmVhY3QuYWRkb25zLmNsYXNzU2V0KHtcclxuICAgICAgICAgICAgICAgIGFjdGl2ZTogZW50cnkgPT0gdGhpcy5zdGF0ZS5hY3RpdmVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICA8YSBrZXk9e2l9XHJcbiAgICAgICAgICAgICAgICAgICAgaHJlZj1cIiNcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xhc3Nlc31cclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXt0aGlzLmhhbmRsZUNsaWNrLmJpbmQodGhpcywgZW50cnkpfVxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIHsgZW50cnkudGl0bGV9XHJcbiAgICAgICAgICAgICAgICA8L2E+XHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGhlYWRlcj5cclxuICAgICAgICAgICAgICAgIDxuYXYgY2xhc3NOYW1lPVwibmF2LXRhYnMgbmF2LXRhYnMtbGdcIj5cclxuICAgICAgICAgICAgICAgICAgICA8RmlsZU1lbnUvPlxyXG4gICAgICAgICAgICAgICAgICAgIHtoZWFkZXJ9XHJcbiAgICAgICAgICAgICAgICA8L25hdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWVudVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0aGlzLnN0YXRlLmFjdGl2ZSBzZXR0aW5ncz17dGhpcy5wcm9wcy5zZXR0aW5nc30vPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvaGVhZGVyPlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgSGVhZGVyOiBIZWFkZXJcclxufSIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcclxuXHJcbnZhciBjb21tb24gPSByZXF1aXJlKFwiLi9jb21tb24uanNcIik7XHJcbnZhciB0b3B1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcclxudmFyIHZpZXdzID0gcmVxdWlyZShcIi4uL3N0b3JlL3ZpZXcuanNcIik7XHJcbnZhciBGaWx0ID0gcmVxdWlyZShcIi4uL2ZpbHQvZmlsdC5qc1wiKTtcclxuRmxvd1RhYmxlID0gcmVxdWlyZShcIi4vZmxvd3RhYmxlLmpzXCIpO1xyXG52YXIgZmxvd2RldGFpbCA9IHJlcXVpcmUoXCIuL2Zsb3dkZXRhaWwuanNcIik7XHJcblxyXG5cclxudmFyIE1haW5WaWV3ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xyXG4gICAgbWl4aW5zOiBbY29tbW9uLk5hdmlnYXRpb24sIGNvbW1vbi5TdGF0ZV0sXHJcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLm9uUXVlcnlDaGFuZ2UoUXVlcnkuRklMVEVSLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUudmlldy5yZWNhbGN1bGF0ZSh0aGlzLmdldFZpZXdGaWx0KCksIHRoaXMuZ2V0Vmlld1NvcnQoKSk7XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuICAgICAgICB0aGlzLm9uUXVlcnlDaGFuZ2UoUXVlcnkuSElHSExJR0hULCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUudmlldy5yZWNhbGN1bGF0ZSh0aGlzLmdldFZpZXdGaWx0KCksIHRoaXMuZ2V0Vmlld1NvcnQoKSk7XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBmbG93czogW11cclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuICAgIGdldFZpZXdGaWx0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdmFyIGZpbHQgPSBGaWx0LnBhcnNlKHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5GSUxURVJdIHx8IFwiXCIpO1xyXG4gICAgICAgICAgICB2YXIgaGlnaGxpZ2h0U3RyID0gdGhpcy5nZXRRdWVyeSgpW1F1ZXJ5LkhJR0hMSUdIVF07XHJcbiAgICAgICAgICAgIHZhciBoaWdobGlnaHQgPSBoaWdobGlnaHRTdHIgPyBGaWx0LnBhcnNlKGhpZ2hsaWdodFN0cikgOiBmYWxzZTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciB3aGVuIHByb2Nlc3NpbmcgZmlsdGVyOiBcIiArIGUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGZpbHRlcl9hbmRfaGlnaGxpZ2h0KGZsb3cpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLl9oaWdobGlnaHQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2hpZ2hsaWdodCA9IHt9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuX2hpZ2hsaWdodFtmbG93LmlkXSA9IGhpZ2hsaWdodCAmJiBoaWdobGlnaHQoZmxvdyk7XHJcbiAgICAgICAgICAgIHJldHVybiBmaWx0KGZsb3cpO1xyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG4gICAgZ2V0Vmlld1NvcnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgIH0sXHJcbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiAobmV4dFByb3BzKSB7XHJcbiAgICAgICAgaWYgKG5leHRQcm9wcy5mbG93U3RvcmUgIT09IHRoaXMucHJvcHMuZmxvd1N0b3JlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2VWaWV3KCk7XHJcbiAgICAgICAgICAgIHRoaXMub3BlblZpZXcobmV4dFByb3BzLmZsb3dTdG9yZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIG9wZW5WaWV3OiBmdW5jdGlvbiAoc3RvcmUpIHtcclxuICAgICAgICB2YXIgdmlldyA9IG5ldyB2aWV3cy5TdG9yZVZpZXcoc3RvcmUsIHRoaXMuZ2V0Vmlld0ZpbHQoKSwgdGhpcy5nZXRWaWV3U29ydCgpKTtcclxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcclxuICAgICAgICAgICAgdmlldzogdmlld1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB2aWV3LmFkZExpc3RlbmVyKFwicmVjYWxjdWxhdGVcIiwgdGhpcy5vblJlY2FsY3VsYXRlKTtcclxuICAgICAgICB2aWV3LmFkZExpc3RlbmVyKFwiYWRkXCIsIHRoaXMub25VcGRhdGUpO1xyXG4gICAgICAgIHZpZXcuYWRkTGlzdGVuZXIoXCJ1cGRhdGVcIiwgdGhpcy5vblVwZGF0ZSk7XHJcbiAgICAgICAgdmlldy5hZGRMaXN0ZW5lcihcInJlbW92ZVwiLCB0aGlzLm9uVXBkYXRlKTtcclxuICAgICAgICB2aWV3LmFkZExpc3RlbmVyKFwicmVtb3ZlXCIsIHRoaXMub25SZW1vdmUpO1xyXG4gICAgfSxcclxuICAgIG9uUmVjYWxjdWxhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmZvcmNlVXBkYXRlKCk7XHJcbiAgICAgICAgdmFyIHNlbGVjdGVkID0gdGhpcy5nZXRTZWxlY3RlZCgpO1xyXG4gICAgICAgIGlmIChzZWxlY3RlZCkge1xyXG4gICAgICAgICAgICB0aGlzLnJlZnMuZmxvd1RhYmxlLnNjcm9sbEludG9WaWV3KHNlbGVjdGVkKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgb25VcGRhdGU6IGZ1bmN0aW9uIChmbG93KSB7XHJcbiAgICAgICAgaWYgKGZsb3cuaWQgPT09IHRoaXMuZ2V0UGFyYW1zKCkuZmxvd0lkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZm9yY2VVcGRhdGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgb25SZW1vdmU6IGZ1bmN0aW9uIChmbG93X2lkLCBpbmRleCkge1xyXG4gICAgICAgIGlmIChmbG93X2lkID09PSB0aGlzLmdldFBhcmFtcygpLmZsb3dJZCkge1xyXG4gICAgICAgICAgICB2YXIgZmxvd190b19zZWxlY3QgPSB0aGlzLnN0YXRlLnZpZXcubGlzdFtNYXRoLm1pbihpbmRleCwgdGhpcy5zdGF0ZS52aWV3Lmxpc3QubGVuZ3RoIC0xKV07XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0RmxvdyhmbG93X3RvX3NlbGVjdCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGNsb3NlVmlldzogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuc3RhdGUudmlldy5jbG9zZSgpO1xyXG4gICAgfSxcclxuICAgIGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMub3BlblZpZXcodGhpcy5wcm9wcy5mbG93U3RvcmUpO1xyXG4gICAgfSxcclxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5jbG9zZVZpZXcoKTtcclxuICAgIH0sXHJcbiAgICBzZWxlY3RGbG93OiBmdW5jdGlvbiAoZmxvdykge1xyXG4gICAgICAgIGlmIChmbG93KSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVwbGFjZVdpdGgoXHJcbiAgICAgICAgICAgICAgICBcImZsb3dcIixcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBmbG93SWQ6IGZsb3cuaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsVGFiOiB0aGlzLmdldFBhcmFtcygpLmRldGFpbFRhYiB8fCBcInJlcXVlc3RcIlxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB0aGlzLnJlZnMuZmxvd1RhYmxlLnNjcm9sbEludG9WaWV3KGZsb3cpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVwbGFjZVdpdGgoXCJmbG93c1wiLCB7fSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHNlbGVjdEZsb3dSZWxhdGl2ZTogZnVuY3Rpb24gKHNoaWZ0KSB7XHJcbiAgICAgICAgdmFyIGZsb3dzID0gdGhpcy5zdGF0ZS52aWV3Lmxpc3Q7XHJcbiAgICAgICAgdmFyIGluZGV4O1xyXG4gICAgICAgIGlmICghdGhpcy5nZXRQYXJhbXMoKS5mbG93SWQpIHtcclxuICAgICAgICAgICAgaWYgKHNoaWZ0ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaW5kZXggPSBmbG93cy5sZW5ndGggLSAxO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaW5kZXggPSAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGN1cnJGbG93SWQgPSB0aGlzLmdldFBhcmFtcygpLmZsb3dJZDtcclxuICAgICAgICAgICAgdmFyIGkgPSBmbG93cy5sZW5ndGg7XHJcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcclxuICAgICAgICAgICAgICAgIGlmIChmbG93c1tpXS5pZCA9PT0gY3VyckZsb3dJZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpbmRleCA9IE1hdGgubWluKFxyXG4gICAgICAgICAgICAgICAgTWF0aC5tYXgoMCwgaW5kZXggKyBzaGlmdCksXHJcbiAgICAgICAgICAgICAgICBmbG93cy5sZW5ndGggLSAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5zZWxlY3RGbG93KGZsb3dzW2luZGV4XSk7XHJcbiAgICB9LFxyXG4gICAgb25LZXlEb3duOiBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5nZXRTZWxlY3RlZCgpO1xyXG4gICAgICAgIGlmIChlLmN0cmxLZXkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzd2l0Y2ggKGUua2V5Q29kZSkge1xyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5LOlxyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5VUDpcclxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0Rmxvd1JlbGF0aXZlKC0xKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5KOlxyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5ET1dOOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RGbG93UmVsYXRpdmUoKzEpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlNQQUNFOlxyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5QQUdFX0RPV046XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3dSZWxhdGl2ZSgrMTApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlBBR0VfVVA6XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3dSZWxhdGl2ZSgtMTApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkVORDpcclxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0Rmxvd1JlbGF0aXZlKCsxZTEwKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5IT01FOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RGbG93UmVsYXRpdmUoLTFlMTApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkVTQzpcclxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0RmxvdyhudWxsKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5IOlxyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5MRUZUOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVmcy5mbG93RGV0YWlscykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcy5mbG93RGV0YWlscy5uZXh0VGFiKC0xKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5MOlxyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5UQUI6XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlJJR0hUOlxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVmcy5mbG93RGV0YWlscykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcy5mbG93RGV0YWlscy5uZXh0VGFiKCsxKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5DOlxyXG4gICAgICAgICAgICAgICAgaWYgKGUuc2hpZnRLZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICBGbG93QWN0aW9ucy5jbGVhcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkQ6XHJcbiAgICAgICAgICAgICAgICBpZiAoZmxvdykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlLnNoaWZ0S2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLmR1cGxpY2F0ZShmbG93KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBGbG93QWN0aW9ucy5kZWxldGUoZmxvdyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkE6XHJcbiAgICAgICAgICAgICAgICBpZiAoZS5zaGlmdEtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLmFjY2VwdF9hbGwoKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmxvdyAmJiBmbG93LmludGVyY2VwdGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgRmxvd0FjdGlvbnMuYWNjZXB0KGZsb3cpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlI6XHJcbiAgICAgICAgICAgICAgICBpZiAoIWUuc2hpZnRLZXkgJiYgZmxvdykge1xyXG4gICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLnJlcGxheShmbG93KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5WOlxyXG4gICAgICAgICAgICAgICAgaWYoZS5zaGlmdEtleSAmJiBmbG93ICYmIGZsb3cubW9kaWZpZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBGbG93QWN0aW9ucy5yZXZlcnQoZmxvdyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoXCJrZXlkb3duXCIsIGUua2V5Q29kZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIH0sXHJcbiAgICBnZXRTZWxlY3RlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnByb3BzLmZsb3dTdG9yZS5nZXQodGhpcy5nZXRQYXJhbXMoKS5mbG93SWQpO1xyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBzZWxlY3RlZCA9IHRoaXMuZ2V0U2VsZWN0ZWQoKTtcclxuXHJcbiAgICAgICAgdmFyIGRldGFpbHM7XHJcbiAgICAgICAgaWYgKHNlbGVjdGVkKSB7XHJcbiAgICAgICAgICAgIGRldGFpbHMgPSBbXHJcbiAgICAgICAgICAgICAgICA8Y29tbW9uLlNwbGl0dGVyIGtleT1cInNwbGl0dGVyXCIvPixcclxuICAgICAgICAgICAgICAgIDxmbG93ZGV0YWlsLkZsb3dEZXRhaWwga2V5PVwiZmxvd0RldGFpbHNcIiByZWY9XCJmbG93RGV0YWlsc1wiIGZsb3c9e3NlbGVjdGVkfS8+XHJcbiAgICAgICAgICAgIF07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZGV0YWlscyA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1haW4tdmlld1wiIG9uS2V5RG93bj17dGhpcy5vbktleURvd259IHRhYkluZGV4PVwiMFwiPlxyXG4gICAgICAgICAgICAgICAgPEZsb3dUYWJsZSByZWY9XCJmbG93VGFibGVcIlxyXG4gICAgICAgICAgICAgICAgICAgIHZpZXc9e3RoaXMuc3RhdGUudmlld31cclxuICAgICAgICAgICAgICAgICAgICBzZWxlY3RGbG93PXt0aGlzLnNlbGVjdEZsb3d9XHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0ZWQ9e3NlbGVjdGVkfSAvPlxyXG4gICAgICAgICAgICAgICAge2RldGFpbHN9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNYWluVmlldztcclxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xyXG52YXIgUmVhY3RSb3V0ZXIgPSByZXF1aXJlKFwicmVhY3Qtcm91dGVyXCIpO1xyXG52YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcblxyXG52YXIgY29tbW9uID0gcmVxdWlyZShcIi4vY29tbW9uLmpzXCIpO1xyXG52YXIgTWFpblZpZXcgPSByZXF1aXJlKFwiLi9tYWludmlldy5qc1wiKTtcclxudmFyIEZvb3RlciA9IHJlcXVpcmUoXCIuL2Zvb3Rlci5qc1wiKTtcclxudmFyIGhlYWRlciA9IHJlcXVpcmUoXCIuL2hlYWRlci5qc1wiKTtcclxudmFyIEV2ZW50TG9nID0gcmVxdWlyZShcIi4vZXZlbnRsb2cuanNcIik7XHJcbnZhciBzdG9yZSA9IHJlcXVpcmUoXCIuLi9zdG9yZS9zdG9yZS5qc1wiKTtcclxuXHJcblxyXG4vL1RPRE86IE1vdmUgb3V0IG9mIGhlcmUsIGp1c3QgYSBzdHViLlxyXG52YXIgUmVwb3J0cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiA8ZGl2PlJlcG9ydEVkaXRvcjwvZGl2PjtcclxuICAgIH1cclxufSk7XHJcblxyXG5cclxudmFyIFByb3h5QXBwTWFpbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcclxuICAgIG1peGluczogW2NvbW1vbi5TdGF0ZV0sXHJcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZXZlbnRTdG9yZSA9IG5ldyBzdG9yZS5FdmVudExvZ1N0b3JlKCk7XHJcbiAgICAgICAgdmFyIGZsb3dTdG9yZSA9IG5ldyBzdG9yZS5GbG93U3RvcmUoKTtcclxuICAgICAgICB2YXIgc2V0dGluZ3MgPSBuZXcgc3RvcmUuU2V0dGluZ3NTdG9yZSgpO1xyXG5cclxuICAgICAgICAvLyBEZWZhdWx0IFNldHRpbmdzIGJlZm9yZSBmZXRjaFxyXG4gICAgICAgIF8uZXh0ZW5kKHNldHRpbmdzLmRpY3Qse1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNldHRpbmdzOiBzZXR0aW5ncyxcclxuICAgICAgICAgICAgZmxvd1N0b3JlOiBmbG93U3RvcmUsXHJcbiAgICAgICAgICAgIGV2ZW50U3RvcmU6IGV2ZW50U3RvcmVcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zdGF0ZS5zZXR0aW5ncy5hZGRMaXN0ZW5lcihcInJlY2FsY3VsYXRlXCIsIHRoaXMub25TZXR0aW5nc0NoYW5nZSk7XHJcbiAgICAgICAgd2luZG93LmFwcCA9IHRoaXM7XHJcbiAgICB9LFxyXG4gICAgY29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnN0YXRlLnNldHRpbmdzLnJlbW92ZUxpc3RlbmVyKFwicmVjYWxjdWxhdGVcIiwgdGhpcy5vblNldHRpbmdzQ2hhbmdlKTtcclxuICAgIH0sXHJcbiAgICBvblNldHRpbmdzQ2hhbmdlOiBmdW5jdGlvbigpe1xyXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xyXG4gICAgICAgICAgICBzZXR0aW5nczogdGhpcy5zdGF0ZS5zZXR0aW5nc1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xyXG5cclxuICAgICAgICB2YXIgZXZlbnRsb2c7XHJcbiAgICAgICAgaWYgKHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5TSE9XX0VWRU5UTE9HXSkge1xyXG4gICAgICAgICAgICBldmVudGxvZyA9IFtcclxuICAgICAgICAgICAgICAgIDxjb21tb24uU3BsaXR0ZXIga2V5PVwic3BsaXR0ZXJcIiBheGlzPVwieVwiLz4sXHJcbiAgICAgICAgICAgICAgICA8RXZlbnRMb2cga2V5PVwiZXZlbnRsb2dcIiBldmVudFN0b3JlPXt0aGlzLnN0YXRlLmV2ZW50U3RvcmV9Lz5cclxuICAgICAgICAgICAgXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBldmVudGxvZyA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8ZGl2IGlkPVwiY29udGFpbmVyXCI+XHJcbiAgICAgICAgICAgICAgICA8aGVhZGVyLkhlYWRlciBzZXR0aW5ncz17dGhpcy5zdGF0ZS5zZXR0aW5ncy5kaWN0fS8+XHJcbiAgICAgICAgICAgICAgICA8Um91dGVIYW5kbGVyIHNldHRpbmdzPXt0aGlzLnN0YXRlLnNldHRpbmdzLmRpY3R9IGZsb3dTdG9yZT17dGhpcy5zdGF0ZS5mbG93U3RvcmV9Lz5cclxuICAgICAgICAgICAgICAgIHtldmVudGxvZ31cclxuICAgICAgICAgICAgICAgIDxGb290ZXIgc2V0dGluZ3M9e3RoaXMuc3RhdGUuc2V0dGluZ3MuZGljdH0vPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcblxyXG52YXIgUm91dGUgPSBSZWFjdFJvdXRlci5Sb3V0ZTtcclxudmFyIFJvdXRlSGFuZGxlciA9IFJlYWN0Um91dGVyLlJvdXRlSGFuZGxlcjtcclxudmFyIFJlZGlyZWN0ID0gUmVhY3RSb3V0ZXIuUmVkaXJlY3Q7XHJcbnZhciBEZWZhdWx0Um91dGUgPSBSZWFjdFJvdXRlci5EZWZhdWx0Um91dGU7XHJcbnZhciBOb3RGb3VuZFJvdXRlID0gUmVhY3RSb3V0ZXIuTm90Rm91bmRSb3V0ZTtcclxuXHJcblxyXG52YXIgcm91dGVzID0gKFxyXG4gICAgPFJvdXRlIHBhdGg9XCIvXCIgaGFuZGxlcj17UHJveHlBcHBNYWlufT5cclxuICAgICAgICA8Um91dGUgbmFtZT1cImZsb3dzXCIgcGF0aD1cImZsb3dzXCIgaGFuZGxlcj17TWFpblZpZXd9Lz5cclxuICAgICAgICA8Um91dGUgbmFtZT1cImZsb3dcIiBwYXRoPVwiZmxvd3MvOmZsb3dJZC86ZGV0YWlsVGFiXCIgaGFuZGxlcj17TWFpblZpZXd9Lz5cclxuICAgICAgICA8Um91dGUgbmFtZT1cInJlcG9ydHNcIiBoYW5kbGVyPXtSZXBvcnRzfS8+XHJcbiAgICAgICAgPFJlZGlyZWN0IHBhdGg9XCIvXCIgdG89XCJmbG93c1wiIC8+XHJcbiAgICA8L1JvdXRlPlxyXG4pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICByb3V0ZXM6IHJvdXRlc1xyXG59O1xyXG5cclxuIiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xyXG5cclxudmFyIFZpcnR1YWxTY3JvbGxNaXhpbiA9IHtcclxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN0YXJ0OiAwLFxyXG4gICAgICAgICAgICBzdG9wOiAwXHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcbiAgICBjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAoIXRoaXMucHJvcHMucm93SGVpZ2h0KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIlZpcnR1YWxTY3JvbGxNaXhpbjogTm8gcm93SGVpZ2h0IHNwZWNpZmllZFwiLCB0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgZ2V0UGxhY2Vob2xkZXJUb3A6IGZ1bmN0aW9uICh0b3RhbCkge1xyXG4gICAgICAgIHZhciBUYWcgPSB0aGlzLnByb3BzLnBsYWNlaG9sZGVyVGFnTmFtZSB8fCBcInRyXCI7XHJcbiAgICAgICAgLy8gV2hlbiBhIGxhcmdlIHRydW5rIG9mIGVsZW1lbnRzIGlzIHJlbW92ZWQgZnJvbSB0aGUgYnV0dG9uLCBzdGFydCBtYXkgYmUgZmFyIG9mZiB0aGUgdmlld3BvcnQuXHJcbiAgICAgICAgLy8gVG8gbWFrZSB0aGlzIGlzc3VlIGxlc3Mgc2V2ZXJlLCBsaW1pdCB0aGUgdG9wIHBsYWNlaG9sZGVyIHRvIHRoZSB0b3RhbCBudW1iZXIgb2Ygcm93cy5cclxuICAgICAgICB2YXIgc3R5bGUgPSB7XHJcbiAgICAgICAgICAgIGhlaWdodDogTWF0aC5taW4odGhpcy5zdGF0ZS5zdGFydCwgdG90YWwpICogdGhpcy5wcm9wcy5yb3dIZWlnaHRcclxuICAgICAgICB9O1xyXG4gICAgICAgIHZhciBzcGFjZXIgPSA8VGFnIGtleT1cInBsYWNlaG9sZGVyLXRvcFwiIHN0eWxlPXtzdHlsZX0+PC9UYWc+O1xyXG5cclxuICAgICAgICBpZiAodGhpcy5zdGF0ZS5zdGFydCAlIDIgPT09IDEpIHtcclxuICAgICAgICAgICAgLy8gZml4IGV2ZW4vb2RkIHJvd3NcclxuICAgICAgICAgICAgcmV0dXJuIFtzcGFjZXIsIDxUYWcga2V5PVwicGxhY2Vob2xkZXItdG9wLTJcIj48L1RhZz5dO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBzcGFjZXI7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGdldFBsYWNlaG9sZGVyQm90dG9tOiBmdW5jdGlvbiAodG90YWwpIHtcclxuICAgICAgICB2YXIgVGFnID0gdGhpcy5wcm9wcy5wbGFjZWhvbGRlclRhZ05hbWUgfHwgXCJ0clwiO1xyXG4gICAgICAgIHZhciBzdHlsZSA9IHtcclxuICAgICAgICAgICAgaGVpZ2h0OiBNYXRoLm1heCgwLCB0b3RhbCAtIHRoaXMuc3RhdGUuc3RvcCkgKiB0aGlzLnByb3BzLnJvd0hlaWdodFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmV0dXJuIDxUYWcga2V5PVwicGxhY2Vob2xkZXItYm90dG9tXCIgc3R5bGU9e3N0eWxlfT48L1RhZz47XHJcbiAgICB9LFxyXG4gICAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLm9uU2Nyb2xsKCk7XHJcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHRoaXMub25TY3JvbGwpO1xyXG4gICAgfSxcclxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbigpe1xyXG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCB0aGlzLm9uU2Nyb2xsKTtcclxuICAgIH0sXHJcbiAgICBvblNjcm9sbDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciB2aWV3cG9ydCA9IHRoaXMuZ2V0RE9NTm9kZSgpO1xyXG4gICAgICAgIHZhciB0b3AgPSB2aWV3cG9ydC5zY3JvbGxUb3A7XHJcbiAgICAgICAgdmFyIGhlaWdodCA9IHZpZXdwb3J0Lm9mZnNldEhlaWdodDtcclxuICAgICAgICB2YXIgc3RhcnQgPSBNYXRoLmZsb29yKHRvcCAvIHRoaXMucHJvcHMucm93SGVpZ2h0KTtcclxuICAgICAgICB2YXIgc3RvcCA9IHN0YXJ0ICsgTWF0aC5jZWlsKGhlaWdodCAvICh0aGlzLnByb3BzLnJvd0hlaWdodE1pbiB8fCB0aGlzLnByb3BzLnJvd0hlaWdodCkpO1xyXG5cclxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcclxuICAgICAgICAgICAgc3RhcnQ6IHN0YXJ0LFxyXG4gICAgICAgICAgICBzdG9wOiBzdG9wXHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG4gICAgcmVuZGVyUm93czogZnVuY3Rpb24gKGVsZW1zKSB7XHJcbiAgICAgICAgdmFyIHJvd3MgPSBbXTtcclxuICAgICAgICB2YXIgbWF4ID0gTWF0aC5taW4oZWxlbXMubGVuZ3RoLCB0aGlzLnN0YXRlLnN0b3ApO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gdGhpcy5zdGF0ZS5zdGFydDsgaSA8IG1heDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBlbGVtID0gZWxlbXNbaV07XHJcbiAgICAgICAgICAgIHJvd3MucHVzaCh0aGlzLnJlbmRlclJvdyhlbGVtKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByb3dzO1xyXG4gICAgfSxcclxuICAgIHNjcm9sbFJvd0ludG9WaWV3OiBmdW5jdGlvbiAoaW5kZXgsIGhlYWRfaGVpZ2h0KSB7XHJcblxyXG4gICAgICAgIHZhciByb3dfdG9wID0gKGluZGV4ICogdGhpcy5wcm9wcy5yb3dIZWlnaHQpICsgaGVhZF9oZWlnaHQ7XHJcbiAgICAgICAgdmFyIHJvd19ib3R0b20gPSByb3dfdG9wICsgdGhpcy5wcm9wcy5yb3dIZWlnaHQ7XHJcblxyXG4gICAgICAgIHZhciB2aWV3cG9ydCA9IHRoaXMuZ2V0RE9NTm9kZSgpO1xyXG4gICAgICAgIHZhciB2aWV3cG9ydF90b3AgPSB2aWV3cG9ydC5zY3JvbGxUb3A7XHJcbiAgICAgICAgdmFyIHZpZXdwb3J0X2JvdHRvbSA9IHZpZXdwb3J0X3RvcCArIHZpZXdwb3J0Lm9mZnNldEhlaWdodDtcclxuXHJcbiAgICAgICAgLy8gQWNjb3VudCBmb3IgcGlubmVkIHRoZWFkXHJcbiAgICAgICAgaWYgKHJvd190b3AgLSBoZWFkX2hlaWdodCA8IHZpZXdwb3J0X3RvcCkge1xyXG4gICAgICAgICAgICB2aWV3cG9ydC5zY3JvbGxUb3AgPSByb3dfdG9wIC0gaGVhZF9oZWlnaHQ7XHJcbiAgICAgICAgfSBlbHNlIGlmIChyb3dfYm90dG9tID4gdmlld3BvcnRfYm90dG9tKSB7XHJcbiAgICAgICAgICAgIHZpZXdwb3J0LnNjcm9sbFRvcCA9IHJvd19ib3R0b20gLSB2aWV3cG9ydC5vZmZzZXRIZWlnaHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzICA9IFZpcnR1YWxTY3JvbGxNaXhpbjsiLCJcclxudmFyIGFjdGlvbnMgPSByZXF1aXJlKFwiLi9hY3Rpb25zLmpzXCIpO1xyXG5cclxuZnVuY3Rpb24gQ29ubmVjdGlvbih1cmwpIHtcclxuICAgIGlmICh1cmxbMF0gPT09IFwiL1wiKSB7XHJcbiAgICAgICAgdXJsID0gbG9jYXRpb24ub3JpZ2luLnJlcGxhY2UoXCJodHRwXCIsIFwid3NcIikgKyB1cmw7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHdzID0gbmV3IFdlYlNvY2tldCh1cmwpO1xyXG4gICAgd3Mub25vcGVuID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGFjdGlvbnMuQ29ubmVjdGlvbkFjdGlvbnMub3BlbigpO1xyXG4gICAgfTtcclxuICAgIHdzLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XHJcbiAgICAgICAgdmFyIG0gPSBKU09OLnBhcnNlKG1lc3NhZ2UuZGF0YSk7XHJcbiAgICAgICAgQXBwRGlzcGF0Y2hlci5kaXNwYXRjaFNlcnZlckFjdGlvbihtKTtcclxuICAgIH07XHJcbiAgICB3cy5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGFjdGlvbnMuQ29ubmVjdGlvbkFjdGlvbnMuZXJyb3IoKTtcclxuICAgICAgICBFdmVudExvZ0FjdGlvbnMuYWRkX2V2ZW50KFwiV2ViU29ja2V0IGNvbm5lY3Rpb24gZXJyb3IuXCIpO1xyXG4gICAgfTtcclxuICAgIHdzLm9uY2xvc2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgYWN0aW9ucy5Db25uZWN0aW9uQWN0aW9ucy5jbG9zZSgpO1xyXG4gICAgICAgIEV2ZW50TG9nQWN0aW9ucy5hZGRfZXZlbnQoXCJXZWJTb2NrZXQgY29ubmVjdGlvbiBjbG9zZWQuXCIpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiB3cztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb25uZWN0aW9uOyIsIlxyXG52YXIgZmx1eCA9IHJlcXVpcmUoXCJmbHV4XCIpO1xyXG5cclxuY29uc3QgUGF5bG9hZFNvdXJjZXMgPSB7XHJcbiAgICBWSUVXOiBcInZpZXdcIixcclxuICAgIFNFUlZFUjogXCJzZXJ2ZXJcIlxyXG59O1xyXG5cclxuXHJcbkFwcERpc3BhdGNoZXIgPSBuZXcgZmx1eC5EaXNwYXRjaGVyKCk7XHJcbkFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbikge1xyXG4gICAgYWN0aW9uLnNvdXJjZSA9IFBheWxvYWRTb3VyY2VzLlZJRVc7XHJcbiAgICB0aGlzLmRpc3BhdGNoKGFjdGlvbik7XHJcbn07XHJcbkFwcERpc3BhdGNoZXIuZGlzcGF0Y2hTZXJ2ZXJBY3Rpb24gPSBmdW5jdGlvbiAoYWN0aW9uKSB7XHJcbiAgICBhY3Rpb24uc291cmNlID0gUGF5bG9hZFNvdXJjZXMuU0VSVkVSO1xyXG4gICAgdGhpcy5kaXNwYXRjaChhY3Rpb24pO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBBcHBEaXNwYXRjaGVyOiBBcHBEaXNwYXRjaGVyXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG4gIC8qXG4gICAqIEdlbmVyYXRlZCBieSBQRUcuanMgMC44LjAuXG4gICAqXG4gICAqIGh0dHA6Ly9wZWdqcy5tYWpkYS5jei9cbiAgICovXG5cbiAgZnVuY3Rpb24gcGVnJHN1YmNsYXNzKGNoaWxkLCBwYXJlbnQpIHtcbiAgICBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH1cbiAgICBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7XG4gICAgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIFN5bnRheEVycm9yKG1lc3NhZ2UsIGV4cGVjdGVkLCBmb3VuZCwgb2Zmc2V0LCBsaW5lLCBjb2x1bW4pIHtcbiAgICB0aGlzLm1lc3NhZ2UgID0gbWVzc2FnZTtcbiAgICB0aGlzLmV4cGVjdGVkID0gZXhwZWN0ZWQ7XG4gICAgdGhpcy5mb3VuZCAgICA9IGZvdW5kO1xuICAgIHRoaXMub2Zmc2V0ICAgPSBvZmZzZXQ7XG4gICAgdGhpcy5saW5lICAgICA9IGxpbmU7XG4gICAgdGhpcy5jb2x1bW4gICA9IGNvbHVtbjtcblxuICAgIHRoaXMubmFtZSAgICAgPSBcIlN5bnRheEVycm9yXCI7XG4gIH1cblxuICBwZWckc3ViY2xhc3MoU3ludGF4RXJyb3IsIEVycm9yKTtcblxuICBmdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAgIHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiB7fSxcblxuICAgICAgICBwZWckRkFJTEVEID0ge30sXG5cbiAgICAgICAgcGVnJHN0YXJ0UnVsZUZ1bmN0aW9ucyA9IHsgc3RhcnQ6IHBlZyRwYXJzZXN0YXJ0IH0sXG4gICAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbiAgPSBwZWckcGFyc2VzdGFydCxcblxuICAgICAgICBwZWckYzAgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwiZmlsdGVyIGV4cHJlc3Npb25cIiB9LFxuICAgICAgICBwZWckYzEgPSBwZWckRkFJTEVELFxuICAgICAgICBwZWckYzIgPSBmdW5jdGlvbihvckV4cHIpIHsgcmV0dXJuIG9yRXhwcjsgfSxcbiAgICAgICAgcGVnJGMzID0gW10sXG4gICAgICAgIHBlZyRjNCA9IGZ1bmN0aW9uKCkge3JldHVybiB0cnVlRmlsdGVyOyB9LFxuICAgICAgICBwZWckYzUgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwid2hpdGVzcGFjZVwiIH0sXG4gICAgICAgIHBlZyRjNiA9IC9eWyBcXHRcXG5cXHJdLyxcbiAgICAgICAgcGVnJGM3ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsgXFxcXHRcXFxcblxcXFxyXVwiLCBkZXNjcmlwdGlvbjogXCJbIFxcXFx0XFxcXG5cXFxccl1cIiB9LFxuICAgICAgICBwZWckYzggPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwiY29udHJvbCBjaGFyYWN0ZXJcIiB9LFxuICAgICAgICBwZWckYzkgPSAvXlt8JiEoKX5cIl0vLFxuICAgICAgICBwZWckYzEwID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlt8JiEoKX5cXFwiXVwiLCBkZXNjcmlwdGlvbjogXCJbfCYhKCl+XFxcIl1cIiB9LFxuICAgICAgICBwZWckYzExID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcIm9wdGlvbmFsIHdoaXRlc3BhY2VcIiB9LFxuICAgICAgICBwZWckYzEyID0gXCJ8XCIsXG4gICAgICAgIHBlZyRjMTMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ8XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ8XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTQgPSBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7IHJldHVybiBvcihmaXJzdCwgc2Vjb25kKTsgfSxcbiAgICAgICAgcGVnJGMxNSA9IFwiJlwiLFxuICAgICAgICBwZWckYzE2ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiJlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiJlxcXCJcIiB9LFxuICAgICAgICBwZWckYzE3ID0gZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkgeyByZXR1cm4gYW5kKGZpcnN0LCBzZWNvbmQpOyB9LFxuICAgICAgICBwZWckYzE4ID0gXCIhXCIsXG4gICAgICAgIHBlZyRjMTkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIhXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIhXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjAgPSBmdW5jdGlvbihleHByKSB7IHJldHVybiBub3QoZXhwcik7IH0sXG4gICAgICAgIHBlZyRjMjEgPSBcIihcIixcbiAgICAgICAgcGVnJGMyMiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIihcIiwgZGVzY3JpcHRpb246IFwiXFxcIihcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyMyA9IFwiKVwiLFxuICAgICAgICBwZWckYzI0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiKVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiKVxcXCJcIiB9LFxuICAgICAgICBwZWckYzI1ID0gZnVuY3Rpb24oZXhwcikgeyByZXR1cm4gYmluZGluZyhleHByKTsgfSxcbiAgICAgICAgcGVnJGMyNiA9IFwifmFcIixcbiAgICAgICAgcGVnJGMyNyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5hXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+YVxcXCJcIiB9LFxuICAgICAgICBwZWckYzI4ID0gZnVuY3Rpb24oKSB7IHJldHVybiBhc3NldEZpbHRlcjsgfSxcbiAgICAgICAgcGVnJGMyOSA9IFwifmVcIixcbiAgICAgICAgcGVnJGMzMCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5lXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+ZVxcXCJcIiB9LFxuICAgICAgICBwZWckYzMxID0gZnVuY3Rpb24oKSB7IHJldHVybiBlcnJvckZpbHRlcjsgfSxcbiAgICAgICAgcGVnJGMzMiA9IFwifnFcIixcbiAgICAgICAgcGVnJGMzMyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5xXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+cVxcXCJcIiB9LFxuICAgICAgICBwZWckYzM0ID0gZnVuY3Rpb24oKSB7IHJldHVybiBub1Jlc3BvbnNlRmlsdGVyOyB9LFxuICAgICAgICBwZWckYzM1ID0gXCJ+c1wiLFxuICAgICAgICBwZWckYzM2ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifnNcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5zXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMzcgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHJlc3BvbnNlRmlsdGVyOyB9LFxuICAgICAgICBwZWckYzM4ID0gXCJ0cnVlXCIsXG4gICAgICAgIHBlZyRjMzkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ0cnVlXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ0cnVlXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNDAgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRydWVGaWx0ZXI7IH0sXG4gICAgICAgIHBlZyRjNDEgPSBcImZhbHNlXCIsXG4gICAgICAgIHBlZyRjNDIgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJmYWxzZVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiZmFsc2VcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0MyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2VGaWx0ZXI7IH0sXG4gICAgICAgIHBlZyRjNDQgPSBcIn5jXCIsXG4gICAgICAgIHBlZyRjNDUgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+Y1wiLCBkZXNjcmlwdGlvbjogXCJcXFwifmNcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0NiA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHJlc3BvbnNlQ29kZShzKTsgfSxcbiAgICAgICAgcGVnJGM0NyA9IFwifmRcIixcbiAgICAgICAgcGVnJGM0OCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5kXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+ZFxcXCJcIiB9LFxuICAgICAgICBwZWckYzQ5ID0gZnVuY3Rpb24ocykgeyByZXR1cm4gZG9tYWluKHMpOyB9LFxuICAgICAgICBwZWckYzUwID0gXCJ+aFwiLFxuICAgICAgICBwZWckYzUxID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifmhcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5oXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNTIgPSBmdW5jdGlvbihzKSB7IHJldHVybiBoZWFkZXIocyk7IH0sXG4gICAgICAgIHBlZyRjNTMgPSBcIn5ocVwiLFxuICAgICAgICBwZWckYzU0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifmhxXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+aHFcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM1NSA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHJlcXVlc3RIZWFkZXIocyk7IH0sXG4gICAgICAgIHBlZyRjNTYgPSBcIn5oc1wiLFxuICAgICAgICBwZWckYzU3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifmhzXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+aHNcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM1OCA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHJlc3BvbnNlSGVhZGVyKHMpOyB9LFxuICAgICAgICBwZWckYzU5ID0gXCJ+bVwiLFxuICAgICAgICBwZWckYzYwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifm1cIiwgZGVzY3JpcHRpb246IFwiXFxcIn5tXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjEgPSBmdW5jdGlvbihzKSB7IHJldHVybiBtZXRob2Qocyk7IH0sXG4gICAgICAgIHBlZyRjNjIgPSBcIn50XCIsXG4gICAgICAgIHBlZyRjNjMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+dFwiLCBkZXNjcmlwdGlvbjogXCJcXFwifnRcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM2NCA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIGNvbnRlbnRUeXBlKHMpOyB9LFxuICAgICAgICBwZWckYzY1ID0gXCJ+dHFcIixcbiAgICAgICAgcGVnJGM2NiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn50cVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifnRxXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjcgPSBmdW5jdGlvbihzKSB7IHJldHVybiByZXF1ZXN0Q29udGVudFR5cGUocyk7IH0sXG4gICAgICAgIHBlZyRjNjggPSBcIn50c1wiLFxuICAgICAgICBwZWckYzY5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifnRzXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+dHNcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3MCA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHJlc3BvbnNlQ29udGVudFR5cGUocyk7IH0sXG4gICAgICAgIHBlZyRjNzEgPSBcIn51XCIsXG4gICAgICAgIHBlZyRjNzIgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+dVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifnVcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3MyA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHVybChzKTsgfSxcbiAgICAgICAgcGVnJGM3NCA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJpbnRlZ2VyXCIgfSxcbiAgICAgICAgcGVnJGM3NSA9IG51bGwsXG4gICAgICAgIHBlZyRjNzYgPSAvXlsnXCJdLyxcbiAgICAgICAgcGVnJGM3NyA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbJ1xcXCJdXCIsIGRlc2NyaXB0aW9uOiBcIlsnXFxcIl1cIiB9LFxuICAgICAgICBwZWckYzc4ID0gL15bMC05XS8sXG4gICAgICAgIHBlZyRjNzkgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWzAtOV1cIiwgZGVzY3JpcHRpb246IFwiWzAtOV1cIiB9LFxuICAgICAgICBwZWckYzgwID0gZnVuY3Rpb24oZGlnaXRzKSB7IHJldHVybiBwYXJzZUludChkaWdpdHMuam9pbihcIlwiKSwgMTApOyB9LFxuICAgICAgICBwZWckYzgxID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcInN0cmluZ1wiIH0sXG4gICAgICAgIHBlZyRjODIgPSBcIlxcXCJcIixcbiAgICAgICAgcGVnJGM4MyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIlxcXCJcIiwgZGVzY3JpcHRpb246IFwiXFxcIlxcXFxcXFwiXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjODQgPSBmdW5jdGlvbihjaGFycykgeyByZXR1cm4gY2hhcnMuam9pbihcIlwiKTsgfSxcbiAgICAgICAgcGVnJGM4NSA9IFwiJ1wiLFxuICAgICAgICBwZWckYzg2ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiJ1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiJ1xcXCJcIiB9LFxuICAgICAgICBwZWckYzg3ID0gdm9pZCAwLFxuICAgICAgICBwZWckYzg4ID0gL15bXCJcXFxcXS8sXG4gICAgICAgIHBlZyRjODkgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW1xcXCJcXFxcXFxcXF1cIiwgZGVzY3JpcHRpb246IFwiW1xcXCJcXFxcXFxcXF1cIiB9LFxuICAgICAgICBwZWckYzkwID0geyB0eXBlOiBcImFueVwiLCBkZXNjcmlwdGlvbjogXCJhbnkgY2hhcmFjdGVyXCIgfSxcbiAgICAgICAgcGVnJGM5MSA9IGZ1bmN0aW9uKGNoYXIpIHsgcmV0dXJuIGNoYXI7IH0sXG4gICAgICAgIHBlZyRjOTIgPSBcIlxcXFxcIixcbiAgICAgICAgcGVnJGM5MyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIlxcXFxcIiwgZGVzY3JpcHRpb246IFwiXFxcIlxcXFxcXFxcXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjOTQgPSAvXlsnXFxcXF0vLFxuICAgICAgICBwZWckYzk1ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsnXFxcXFxcXFxdXCIsIGRlc2NyaXB0aW9uOiBcIlsnXFxcXFxcXFxdXCIgfSxcbiAgICAgICAgcGVnJGM5NiA9IC9eWydcIlxcXFxdLyxcbiAgICAgICAgcGVnJGM5NyA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbJ1xcXCJcXFxcXFxcXF1cIiwgZGVzY3JpcHRpb246IFwiWydcXFwiXFxcXFxcXFxdXCIgfSxcbiAgICAgICAgcGVnJGM5OCA9IFwiblwiLFxuICAgICAgICBwZWckYzk5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiblwiLCBkZXNjcmlwdGlvbjogXCJcXFwiblxcXCJcIiB9LFxuICAgICAgICBwZWckYzEwMCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJcXG5cIjsgfSxcbiAgICAgICAgcGVnJGMxMDEgPSBcInJcIixcbiAgICAgICAgcGVnJGMxMDIgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJyXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJyXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTAzID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIlxcclwiOyB9LFxuICAgICAgICBwZWckYzEwNCA9IFwidFwiLFxuICAgICAgICBwZWckYzEwNSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInRcIiwgZGVzY3JpcHRpb246IFwiXFxcInRcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMDYgPSBmdW5jdGlvbigpIHsgcmV0dXJuIFwiXFx0XCI7IH0sXG5cbiAgICAgICAgcGVnJGN1cnJQb3MgICAgICAgICAgPSAwLFxuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgICAgICA9IDAsXG4gICAgICAgIHBlZyRjYWNoZWRQb3MgICAgICAgID0gMCxcbiAgICAgICAgcGVnJGNhY2hlZFBvc0RldGFpbHMgPSB7IGxpbmU6IDEsIGNvbHVtbjogMSwgc2VlbkNSOiBmYWxzZSB9LFxuICAgICAgICBwZWckbWF4RmFpbFBvcyAgICAgICA9IDAsXG4gICAgICAgIHBlZyRtYXhGYWlsRXhwZWN0ZWQgID0gW10sXG4gICAgICAgIHBlZyRzaWxlbnRGYWlscyAgICAgID0gMCxcblxuICAgICAgICBwZWckcmVzdWx0O1xuXG4gICAgaWYgKFwic3RhcnRSdWxlXCIgaW4gb3B0aW9ucykge1xuICAgICAgaWYgKCEob3B0aW9ucy5zdGFydFJ1bGUgaW4gcGVnJHN0YXJ0UnVsZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3Qgc3RhcnQgcGFyc2luZyBmcm9tIHJ1bGUgXFxcIlwiICsgb3B0aW9ucy5zdGFydFJ1bGUgKyBcIlxcXCIuXCIpO1xuICAgICAgfVxuXG4gICAgICBwZWckc3RhcnRSdWxlRnVuY3Rpb24gPSBwZWckc3RhcnRSdWxlRnVuY3Rpb25zW29wdGlvbnMuc3RhcnRSdWxlXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0ZXh0KCkge1xuICAgICAgcmV0dXJuIGlucHV0LnN1YnN0cmluZyhwZWckcmVwb3J0ZWRQb3MsIHBlZyRjdXJyUG9zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvZmZzZXQoKSB7XG4gICAgICByZXR1cm4gcGVnJHJlcG9ydGVkUG9zO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpbmUoKSB7XG4gICAgICByZXR1cm4gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBlZyRyZXBvcnRlZFBvcykubGluZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb2x1bW4oKSB7XG4gICAgICByZXR1cm4gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBlZyRyZXBvcnRlZFBvcykuY29sdW1uO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4cGVjdGVkKGRlc2NyaXB0aW9uKSB7XG4gICAgICB0aHJvdyBwZWckYnVpbGRFeGNlcHRpb24oXG4gICAgICAgIG51bGwsXG4gICAgICAgIFt7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uIH1dLFxuICAgICAgICBwZWckcmVwb3J0ZWRQb3NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xuICAgICAgdGhyb3cgcGVnJGJ1aWxkRXhjZXB0aW9uKG1lc3NhZ2UsIG51bGwsIHBlZyRyZXBvcnRlZFBvcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBvcykge1xuICAgICAgZnVuY3Rpb24gYWR2YW5jZShkZXRhaWxzLCBzdGFydFBvcywgZW5kUG9zKSB7XG4gICAgICAgIHZhciBwLCBjaDtcblxuICAgICAgICBmb3IgKHAgPSBzdGFydFBvczsgcCA8IGVuZFBvczsgcCsrKSB7XG4gICAgICAgICAgY2ggPSBpbnB1dC5jaGFyQXQocCk7XG4gICAgICAgICAgaWYgKGNoID09PSBcIlxcblwiKSB7XG4gICAgICAgICAgICBpZiAoIWRldGFpbHMuc2VlbkNSKSB7IGRldGFpbHMubGluZSsrOyB9XG4gICAgICAgICAgICBkZXRhaWxzLmNvbHVtbiA9IDE7XG4gICAgICAgICAgICBkZXRhaWxzLnNlZW5DUiA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2ggPT09IFwiXFxyXCIgfHwgY2ggPT09IFwiXFx1MjAyOFwiIHx8IGNoID09PSBcIlxcdTIwMjlcIikge1xuICAgICAgICAgICAgZGV0YWlscy5saW5lKys7XG4gICAgICAgICAgICBkZXRhaWxzLmNvbHVtbiA9IDE7XG4gICAgICAgICAgICBkZXRhaWxzLnNlZW5DUiA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uKys7XG4gICAgICAgICAgICBkZXRhaWxzLnNlZW5DUiA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocGVnJGNhY2hlZFBvcyAhPT0gcG9zKSB7XG4gICAgICAgIGlmIChwZWckY2FjaGVkUG9zID4gcG9zKSB7XG4gICAgICAgICAgcGVnJGNhY2hlZFBvcyA9IDA7XG4gICAgICAgICAgcGVnJGNhY2hlZFBvc0RldGFpbHMgPSB7IGxpbmU6IDEsIGNvbHVtbjogMSwgc2VlbkNSOiBmYWxzZSB9O1xuICAgICAgICB9XG4gICAgICAgIGFkdmFuY2UocGVnJGNhY2hlZFBvc0RldGFpbHMsIHBlZyRjYWNoZWRQb3MsIHBvcyk7XG4gICAgICAgIHBlZyRjYWNoZWRQb3MgPSBwb3M7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwZWckY2FjaGVkUG9zRGV0YWlscztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckZmFpbChleHBlY3RlZCkge1xuICAgICAgaWYgKHBlZyRjdXJyUG9zIDwgcGVnJG1heEZhaWxQb3MpIHsgcmV0dXJuOyB9XG5cbiAgICAgIGlmIChwZWckY3VyclBvcyA+IHBlZyRtYXhGYWlsUG9zKSB7XG4gICAgICAgIHBlZyRtYXhGYWlsUG9zID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHBlZyRtYXhGYWlsRXhwZWN0ZWQgPSBbXTtcbiAgICAgIH1cblxuICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZC5wdXNoKGV4cGVjdGVkKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckYnVpbGRFeGNlcHRpb24obWVzc2FnZSwgZXhwZWN0ZWQsIHBvcykge1xuICAgICAgZnVuY3Rpb24gY2xlYW51cEV4cGVjdGVkKGV4cGVjdGVkKSB7XG4gICAgICAgIHZhciBpID0gMTtcblxuICAgICAgICBleHBlY3RlZC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICBpZiAoYS5kZXNjcmlwdGlvbiA8IGIuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGEuZGVzY3JpcHRpb24gPiBiLmRlc2NyaXB0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB3aGlsZSAoaSA8IGV4cGVjdGVkLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChleHBlY3RlZFtpIC0gMV0gPT09IGV4cGVjdGVkW2ldKSB7XG4gICAgICAgICAgICBleHBlY3RlZC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYnVpbGRNZXNzYWdlKGV4cGVjdGVkLCBmb3VuZCkge1xuICAgICAgICBmdW5jdGlvbiBzdHJpbmdFc2NhcGUocykge1xuICAgICAgICAgIGZ1bmN0aW9uIGhleChjaCkgeyByZXR1cm4gY2guY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKTsgfVxuXG4gICAgICAgICAgcmV0dXJuIHNcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcL2csICAgJ1xcXFxcXFxcJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cIi9nLCAgICAnXFxcXFwiJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHgwOC9nLCAnXFxcXGInKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcdC9nLCAgICdcXFxcdCcpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxuL2csICAgJ1xcXFxuJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXGYvZywgICAnXFxcXGYnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcci9nLCAgICdcXFxccicpXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xceDAwLVxceDA3XFx4MEJcXHgwRVxceDBGXS9nLCBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx4MCcgKyBoZXgoY2gpOyB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHgxMC1cXHgxRlxceDgwLVxceEZGXS9nLCAgICBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx4JyAgKyBoZXgoY2gpOyB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHUwMTgwLVxcdTBGRkZdL2csICAgICAgICAgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxcdTAnICsgaGV4KGNoKTsgfSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx1MTA4MC1cXHVGRkZGXS9nLCAgICAgICAgIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHUnICArIGhleChjaCk7IH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGV4cGVjdGVkRGVzY3MgPSBuZXcgQXJyYXkoZXhwZWN0ZWQubGVuZ3RoKSxcbiAgICAgICAgICAgIGV4cGVjdGVkRGVzYywgZm91bmREZXNjLCBpO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBleHBlY3RlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGV4cGVjdGVkRGVzY3NbaV0gPSBleHBlY3RlZFtpXS5kZXNjcmlwdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cGVjdGVkRGVzYyA9IGV4cGVjdGVkLmxlbmd0aCA+IDFcbiAgICAgICAgICA/IGV4cGVjdGVkRGVzY3Muc2xpY2UoMCwgLTEpLmpvaW4oXCIsIFwiKVxuICAgICAgICAgICAgICArIFwiIG9yIFwiXG4gICAgICAgICAgICAgICsgZXhwZWN0ZWREZXNjc1tleHBlY3RlZC5sZW5ndGggLSAxXVxuICAgICAgICAgIDogZXhwZWN0ZWREZXNjc1swXTtcblxuICAgICAgICBmb3VuZERlc2MgPSBmb3VuZCA/IFwiXFxcIlwiICsgc3RyaW5nRXNjYXBlKGZvdW5kKSArIFwiXFxcIlwiIDogXCJlbmQgb2YgaW5wdXRcIjtcblxuICAgICAgICByZXR1cm4gXCJFeHBlY3RlZCBcIiArIGV4cGVjdGVkRGVzYyArIFwiIGJ1dCBcIiArIGZvdW5kRGVzYyArIFwiIGZvdW5kLlwiO1xuICAgICAgfVxuXG4gICAgICB2YXIgcG9zRGV0YWlscyA9IHBlZyRjb21wdXRlUG9zRGV0YWlscyhwb3MpLFxuICAgICAgICAgIGZvdW5kICAgICAgPSBwb3MgPCBpbnB1dC5sZW5ndGggPyBpbnB1dC5jaGFyQXQocG9zKSA6IG51bGw7XG5cbiAgICAgIGlmIChleHBlY3RlZCAhPT0gbnVsbCkge1xuICAgICAgICBjbGVhbnVwRXhwZWN0ZWQoZXhwZWN0ZWQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmV3IFN5bnRheEVycm9yKFxuICAgICAgICBtZXNzYWdlICE9PSBudWxsID8gbWVzc2FnZSA6IGJ1aWxkTWVzc2FnZShleHBlY3RlZCwgZm91bmQpLFxuICAgICAgICBleHBlY3RlZCxcbiAgICAgICAgZm91bmQsXG4gICAgICAgIHBvcyxcbiAgICAgICAgcG9zRGV0YWlscy5saW5lLFxuICAgICAgICBwb3NEZXRhaWxzLmNvbHVtblxuICAgICAgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VzdGFydCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlT3JFeHByKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzIoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzMSA9IFtdO1xuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjNCgpO1xuICAgICAgICB9XG4gICAgICAgIHMwID0gczE7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMwKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNld3MoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIGlmIChwZWckYzYudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3KTsgfVxuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZWNjKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBpZiAocGVnJGM5LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczAgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTApOyB9XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4KTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlX18oKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gW107XG4gICAgICBzMSA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICB3aGlsZSAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAucHVzaChzMSk7XG4gICAgICAgIHMxID0gcGVnJHBhcnNld3MoKTtcbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzExKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlT3JFeHByKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUFuZEV4cHIoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTI0KSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMTI7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTMpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlT3JFeHByKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMxNChzMSwgczUpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VBbmRFeHByKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VBbmRFeHByKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZU5vdEV4cHIoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzgpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGMxNTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNik7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VBbmRFeHByKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMxNyhzMSwgczUpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgczEgPSBwZWckcGFyc2VOb3RFeHByKCk7XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlQW5kRXhwcigpO1xuICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjMTcoczEsIHMzKTtcbiAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckcGFyc2VOb3RFeHByKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU5vdEV4cHIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDMzKSB7XG4gICAgICAgIHMxID0gcGVnJGMxODtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE5KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VOb3RFeHByKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMyMChzMyk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlQmluZGluZ0V4cHIoKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUJpbmRpbmdFeHByKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQwKSB7XG4gICAgICAgIHMxID0gcGVnJGMyMTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIyKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VPckV4cHIoKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQxKSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckYzIzO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMjUoczMpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VFeHByKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VFeHByKCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZU51bGxhcnlFeHByKCk7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VVbmFyeUV4cHIoKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU51bGxhcnlFeHByKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckcGFyc2VCb29sZWFuTGl0ZXJhbCgpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzI2KSB7XG4gICAgICAgICAgczEgPSBwZWckYzI2O1xuICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNyk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMjgoKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzI5KSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMjk7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzApOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMzEoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMzMikge1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjMzI7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzMyk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzM0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzM1KSB7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzM1O1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzNik7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMzcoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQm9vbGVhbkxpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgNCkgPT09IHBlZyRjMzgpIHtcbiAgICAgICAgczEgPSBwZWckYzM4O1xuICAgICAgICBwZWckY3VyclBvcyArPSA0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzkpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGM0MCgpO1xuICAgICAgfVxuICAgICAgczAgPSBzMTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCA1KSA9PT0gcGVnJGM0MSkge1xuICAgICAgICAgIHMxID0gcGVnJGM0MTtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSA1O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDIpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzQzKCk7XG4gICAgICAgIH1cbiAgICAgICAgczAgPSBzMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVVuYXJ5RXhwcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzQ0KSB7XG4gICAgICAgIHMxID0gcGVnJGM0NDtcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQ1KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VJbnRlZ2VyTGl0ZXJhbCgpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjNDYoczMpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGM0Nykge1xuICAgICAgICAgIHMxID0gcGVnJGM0NztcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDgpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGM0OShzMyk7XG4gICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjNTApIHtcbiAgICAgICAgICAgIHMxID0gcGVnJGM1MDtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1MSk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1MihzMyk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAzKSA9PT0gcGVnJGM1Mykge1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjNTM7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1NCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTUoczMpO1xuICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAzKSA9PT0gcGVnJGM1Nikge1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1NjtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAzO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTcpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1OChzMyk7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjNTkpIHtcbiAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1OTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2MCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2MShzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGM2Mikge1xuICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjI7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2Myk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjQoczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAzKSA9PT0gcGVnJGM2NSkge1xuICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2NTtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAzO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjYpOyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2NyhzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMykgPT09IHBlZyRjNjgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2ODtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDM7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2OSk7IH1cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM3MChzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGM3MSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNzE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3Mik7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNzMoczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzczKHMxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlSW50ZWdlckxpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChwZWckYzc2LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczEgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzcpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzc1O1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIGlmIChwZWckYzc4LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICBzMyA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc5KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICBpZiAocGVnJGM3OC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHMzID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc5KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAocGVnJGM3Ni50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICBzMyA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzcpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzc1O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzgwKHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3NCk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzQpIHtcbiAgICAgICAgczEgPSBwZWckYzgyO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODMpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckcGFyc2VEb3VibGVTdHJpbmdDaGFyKCk7XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlRG91YmxlU3RyaW5nQ2hhcigpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM4MjtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4Myk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM4NChzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzkpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjODU7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg2KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyKCk7XG4gICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU2luZ2xlU3RyaW5nQ2hhcigpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzkpIHtcbiAgICAgICAgICAgICAgczMgPSBwZWckYzg1O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODYpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGM4NChzMik7XG4gICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZWNjKCk7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRjODc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgczMgPSBwZWckcGFyc2VVbnF1b3RlZFN0cmluZ0NoYXIoKTtcbiAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVVucXVvdGVkU3RyaW5nQ2hhcigpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzg0KHMyKTtcbiAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4MSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIGlmIChwZWckYzg4LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODkpOyB9XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjODc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM5MShzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkyKSB7XG4gICAgICAgICAgczEgPSBwZWckYzkyO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5Myk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZUVzY2FwZVNlcXVlbmNlKCk7XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM5MShzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVNpbmdsZVN0cmluZ0NoYXIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIGlmIChwZWckYzk0LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTUpOyB9XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjODc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM5MShzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkyKSB7XG4gICAgICAgICAgczEgPSBwZWckYzkyO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5Myk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZUVzY2FwZVNlcXVlbmNlKCk7XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM5MShzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVVucXVvdGVkU3RyaW5nQ2hhcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczIgPSBwZWckcGFyc2V3cygpO1xuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzg3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgczEgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5MCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjOTEoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VFc2NhcGVTZXF1ZW5jZSgpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIGlmIChwZWckYzk2LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczAgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTcpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTApIHtcbiAgICAgICAgICBzMSA9IHBlZyRjOTg7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzk5KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxMDAoKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTE0KSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTAxO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEwMik7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMxMDMoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExNikge1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjMTA0O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTA1KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjMTA2KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG5cclxuICAgIHZhciBmbG93dXRpbHMgPSByZXF1aXJlKFwiLi4vZmxvdy91dGlscy5qc1wiKTtcclxuXHJcbiAgICBmdW5jdGlvbiBvcihmaXJzdCwgc2Vjb25kKSB7XHJcbiAgICAgICAgLy8gQWRkIGV4cGxpY2l0IGZ1bmN0aW9uIG5hbWVzIHRvIGVhc2UgZGVidWdnaW5nLlxyXG4gICAgICAgIGZ1bmN0aW9uIG9yRmlsdGVyKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmlyc3QuYXBwbHkodGhpcywgYXJndW1lbnRzKSB8fCBzZWNvbmQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgb3JGaWx0ZXIuZGVzYyA9IGZpcnN0LmRlc2MgKyBcIiBvciBcIiArIHNlY29uZC5kZXNjO1xyXG4gICAgICAgIHJldHVybiBvckZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGFuZChmaXJzdCwgc2Vjb25kKSB7XHJcbiAgICAgICAgZnVuY3Rpb24gYW5kRmlsdGVyKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmlyc3QuYXBwbHkodGhpcywgYXJndW1lbnRzKSAmJiBzZWNvbmQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYW5kRmlsdGVyLmRlc2MgPSBmaXJzdC5kZXNjICsgXCIgYW5kIFwiICsgc2Vjb25kLmRlc2M7XHJcbiAgICAgICAgcmV0dXJuIGFuZEZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIG5vdChleHByKSB7XHJcbiAgICAgICAgZnVuY3Rpb24gbm90RmlsdGVyKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gIWV4cHIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbm90RmlsdGVyLmRlc2MgPSBcIm5vdCBcIiArIGV4cHIuZGVzYztcclxuICAgICAgICByZXR1cm4gbm90RmlsdGVyO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gYmluZGluZyhleHByKSB7XHJcbiAgICAgICAgZnVuY3Rpb24gYmluZGluZ0ZpbHRlcigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGV4cHIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYmluZGluZ0ZpbHRlci5kZXNjID0gXCIoXCIgKyBleHByLmRlc2MgKyBcIilcIjtcclxuICAgICAgICByZXR1cm4gYmluZGluZ0ZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIHRydWVGaWx0ZXIoZmxvdykge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgdHJ1ZUZpbHRlci5kZXNjID0gXCJ0cnVlXCI7XHJcbiAgICBmdW5jdGlvbiBmYWxzZUZpbHRlcihmbG93KSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgZmFsc2VGaWx0ZXIuZGVzYyA9IFwiZmFsc2VcIjtcclxuXHJcbiAgICB2YXIgQVNTRVRfVFlQRVMgPSBbXHJcbiAgICAgICAgbmV3IFJlZ0V4cChcInRleHQvamF2YXNjcmlwdFwiKSxcclxuICAgICAgICBuZXcgUmVnRXhwKFwiYXBwbGljYXRpb24veC1qYXZhc2NyaXB0XCIpLFxyXG4gICAgICAgIG5ldyBSZWdFeHAoXCJhcHBsaWNhdGlvbi9qYXZhc2NyaXB0XCIpLFxyXG4gICAgICAgIG5ldyBSZWdFeHAoXCJ0ZXh0L2Nzc1wiKSxcclxuICAgICAgICBuZXcgUmVnRXhwKFwiaW1hZ2UvLipcIiksXHJcbiAgICAgICAgbmV3IFJlZ0V4cChcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIpXHJcbiAgICBdO1xyXG4gICAgZnVuY3Rpb24gYXNzZXRGaWx0ZXIoZmxvdykge1xyXG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgIHZhciBjdCA9IGZsb3d1dGlscy5SZXNwb25zZVV0aWxzLmdldENvbnRlbnRUeXBlKGZsb3cucmVzcG9uc2UpO1xyXG4gICAgICAgICAgICB2YXIgaSA9IEFTU0VUX1RZUEVTLmxlbmd0aDtcclxuICAgICAgICAgICAgd2hpbGUgKGktLSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKEFTU0VUX1RZUEVTW2ldLnRlc3QoY3QpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgYXNzZXRGaWx0ZXIuZGVzYyA9IFwiaXMgYXNzZXRcIjtcclxuICAgIGZ1bmN0aW9uIHJlc3BvbnNlQ29kZShjb2RlKXtcclxuICAgICAgICBmdW5jdGlvbiByZXNwb25zZUNvZGVGaWx0ZXIoZmxvdyl7XHJcbiAgICAgICAgICAgIHJldHVybiBmbG93LnJlc3BvbnNlICYmIGZsb3cucmVzcG9uc2UuY29kZSA9PT0gY29kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVzcG9uc2VDb2RlRmlsdGVyLmRlc2MgPSBcInJlc3AuIGNvZGUgaXMgXCIgKyBjb2RlO1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZUNvZGVGaWx0ZXI7XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBkb21haW4ocmVnZXgpe1xyXG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xyXG4gICAgICAgIGZ1bmN0aW9uIGRvbWFpbkZpbHRlcihmbG93KXtcclxuICAgICAgICAgICAgcmV0dXJuIGZsb3cucmVxdWVzdCAmJiByZWdleC50ZXN0KGZsb3cucmVxdWVzdC5ob3N0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZG9tYWluRmlsdGVyLmRlc2MgPSBcImRvbWFpbiBtYXRjaGVzIFwiICsgcmVnZXg7XHJcbiAgICAgICAgcmV0dXJuIGRvbWFpbkZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGVycm9yRmlsdGVyKGZsb3cpe1xyXG4gICAgICAgIHJldHVybiAhIWZsb3cuZXJyb3I7XHJcbiAgICB9XHJcbiAgICBlcnJvckZpbHRlci5kZXNjID0gXCJoYXMgZXJyb3JcIjtcclxuICAgIGZ1bmN0aW9uIGhlYWRlcihyZWdleCl7XHJcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XHJcbiAgICAgICAgZnVuY3Rpb24gaGVhZGVyRmlsdGVyKGZsb3cpe1xyXG4gICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgKGZsb3cucmVxdWVzdCAmJiBmbG93dXRpbHMuUmVxdWVzdFV0aWxzLm1hdGNoX2hlYWRlcihmbG93LnJlcXVlc3QsIHJlZ2V4KSlcclxuICAgICAgICAgICAgICAgIHx8XHJcbiAgICAgICAgICAgICAgICAoZmxvdy5yZXNwb25zZSAmJiBmbG93dXRpbHMuUmVzcG9uc2VVdGlscy5tYXRjaF9oZWFkZXIoZmxvdy5yZXNwb25zZSwgcmVnZXgpKVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBoZWFkZXJGaWx0ZXIuZGVzYyA9IFwiaGVhZGVyIG1hdGNoZXMgXCIgKyByZWdleDtcclxuICAgICAgICByZXR1cm4gaGVhZGVyRmlsdGVyO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gcmVxdWVzdEhlYWRlcihyZWdleCl7XHJcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XHJcbiAgICAgICAgZnVuY3Rpb24gcmVxdWVzdEhlYWRlckZpbHRlcihmbG93KXtcclxuICAgICAgICAgICAgcmV0dXJuIChmbG93LnJlcXVlc3QgJiYgZmxvd3V0aWxzLlJlcXVlc3RVdGlscy5tYXRjaF9oZWFkZXIoZmxvdy5yZXF1ZXN0LCByZWdleCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXF1ZXN0SGVhZGVyRmlsdGVyLmRlc2MgPSBcInJlcS4gaGVhZGVyIG1hdGNoZXMgXCIgKyByZWdleDtcclxuICAgICAgICByZXR1cm4gcmVxdWVzdEhlYWRlckZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIHJlc3BvbnNlSGVhZGVyKHJlZ2V4KXtcclxuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcclxuICAgICAgICBmdW5jdGlvbiByZXNwb25zZUhlYWRlckZpbHRlcihmbG93KXtcclxuICAgICAgICAgICAgcmV0dXJuIChmbG93LnJlc3BvbnNlICYmIGZsb3d1dGlscy5SZXNwb25zZVV0aWxzLm1hdGNoX2hlYWRlcihmbG93LnJlc3BvbnNlLCByZWdleCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXNwb25zZUhlYWRlckZpbHRlci5kZXNjID0gXCJyZXNwLiBoZWFkZXIgbWF0Y2hlcyBcIiArIHJlZ2V4O1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZUhlYWRlckZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIG1ldGhvZChyZWdleCl7XHJcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XHJcbiAgICAgICAgZnVuY3Rpb24gbWV0aG9kRmlsdGVyKGZsb3cpe1xyXG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoZmxvdy5yZXF1ZXN0Lm1ldGhvZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG1ldGhvZEZpbHRlci5kZXNjID0gXCJtZXRob2QgbWF0Y2hlcyBcIiArIHJlZ2V4O1xyXG4gICAgICAgIHJldHVybiBtZXRob2RGaWx0ZXI7XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBub1Jlc3BvbnNlRmlsdGVyKGZsb3cpe1xyXG4gICAgICAgIHJldHVybiBmbG93LnJlcXVlc3QgJiYgIWZsb3cucmVzcG9uc2U7XHJcbiAgICB9XHJcbiAgICBub1Jlc3BvbnNlRmlsdGVyLmRlc2MgPSBcImhhcyBubyByZXNwb25zZVwiO1xyXG4gICAgZnVuY3Rpb24gcmVzcG9uc2VGaWx0ZXIoZmxvdyl7XHJcbiAgICAgICAgcmV0dXJuICEhZmxvdy5yZXNwb25zZTtcclxuICAgIH1cclxuICAgIHJlc3BvbnNlRmlsdGVyLmRlc2MgPSBcImhhcyByZXNwb25zZVwiO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNvbnRlbnRUeXBlKHJlZ2V4KXtcclxuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcclxuICAgICAgICBmdW5jdGlvbiBjb250ZW50VHlwZUZpbHRlcihmbG93KXtcclxuICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgIChmbG93LnJlcXVlc3QgJiYgcmVnZXgudGVzdChmbG93dXRpbHMuUmVxdWVzdFV0aWxzLmdldENvbnRlbnRUeXBlKGZsb3cucmVxdWVzdCkpKVxyXG4gICAgICAgICAgICAgICAgfHxcclxuICAgICAgICAgICAgICAgIChmbG93LnJlc3BvbnNlICYmIHJlZ2V4LnRlc3QoZmxvd3V0aWxzLlJlc3BvbnNlVXRpbHMuZ2V0Q29udGVudFR5cGUoZmxvdy5yZXNwb25zZSkpKVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb250ZW50VHlwZUZpbHRlci5kZXNjID0gXCJjb250ZW50IHR5cGUgbWF0Y2hlcyBcIiArIHJlZ2V4O1xyXG4gICAgICAgIHJldHVybiBjb250ZW50VHlwZUZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIHJlcXVlc3RDb250ZW50VHlwZShyZWdleCl7XHJcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XHJcbiAgICAgICAgZnVuY3Rpb24gcmVxdWVzdENvbnRlbnRUeXBlRmlsdGVyKGZsb3cpe1xyXG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoZmxvd3V0aWxzLlJlcXVlc3RVdGlscy5nZXRDb250ZW50VHlwZShmbG93LnJlcXVlc3QpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVxdWVzdENvbnRlbnRUeXBlRmlsdGVyLmRlc2MgPSBcInJlcS4gY29udGVudCB0eXBlIG1hdGNoZXMgXCIgKyByZWdleDtcclxuICAgICAgICByZXR1cm4gcmVxdWVzdENvbnRlbnRUeXBlRmlsdGVyO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gcmVzcG9uc2VDb250ZW50VHlwZShyZWdleCl7XHJcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XHJcbiAgICAgICAgZnVuY3Rpb24gcmVzcG9uc2VDb250ZW50VHlwZUZpbHRlcihmbG93KXtcclxuICAgICAgICAgICAgcmV0dXJuIGZsb3cucmVzcG9uc2UgJiYgcmVnZXgudGVzdChmbG93dXRpbHMuUmVzcG9uc2VVdGlscy5nZXRDb250ZW50VHlwZShmbG93LnJlc3BvbnNlKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlc3BvbnNlQ29udGVudFR5cGVGaWx0ZXIuZGVzYyA9IFwicmVzcC4gY29udGVudCB0eXBlIG1hdGNoZXMgXCIgKyByZWdleDtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2VDb250ZW50VHlwZUZpbHRlcjtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIHVybChyZWdleCl7XHJcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XHJcbiAgICAgICAgZnVuY3Rpb24gdXJsRmlsdGVyKGZsb3cpe1xyXG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoZmxvd3V0aWxzLlJlcXVlc3RVdGlscy5wcmV0dHlfdXJsKGZsb3cucmVxdWVzdCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB1cmxGaWx0ZXIuZGVzYyA9IFwidXJsIG1hdGNoZXMgXCIgKyByZWdleDtcclxuICAgICAgICByZXR1cm4gdXJsRmlsdGVyO1xyXG4gICAgfVxyXG5cblxuICAgIHBlZyRyZXN1bHQgPSBwZWckc3RhcnRSdWxlRnVuY3Rpb24oKTtcblxuICAgIGlmIChwZWckcmVzdWx0ICE9PSBwZWckRkFJTEVEICYmIHBlZyRjdXJyUG9zID09PSBpbnB1dC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBwZWckcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGVnJHJlc3VsdCAhPT0gcGVnJEZBSUxFRCAmJiBwZWckY3VyclBvcyA8IGlucHV0Lmxlbmd0aCkge1xuICAgICAgICBwZWckZmFpbCh7IHR5cGU6IFwiZW5kXCIsIGRlc2NyaXB0aW9uOiBcImVuZCBvZiBpbnB1dFwiIH0pO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBwZWckYnVpbGRFeGNlcHRpb24obnVsbCwgcGVnJG1heEZhaWxFeHBlY3RlZCwgcGVnJG1heEZhaWxQb3MpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgU3ludGF4RXJyb3I6IFN5bnRheEVycm9yLFxuICAgIHBhcnNlOiAgICAgICBwYXJzZVxuICB9O1xufSkoKTsiLCJ2YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcblxyXG52YXIgX01lc3NhZ2VVdGlscyA9IHtcclxuICAgIGdldENvbnRlbnRUeXBlOiBmdW5jdGlvbiAobWVzc2FnZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmdldF9maXJzdF9oZWFkZXIobWVzc2FnZSwgL15Db250ZW50LVR5cGUkL2kpO1xyXG4gICAgfSxcclxuICAgIGdldF9maXJzdF9oZWFkZXI6IGZ1bmN0aW9uIChtZXNzYWdlLCByZWdleCkge1xyXG4gICAgICAgIC8vRklYTUU6IENhY2hlIEludmFsaWRhdGlvbi5cclxuICAgICAgICBpZiAoIW1lc3NhZ2UuX2hlYWRlckxvb2t1cHMpXHJcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtZXNzYWdlLCBcIl9oZWFkZXJMb29rdXBzXCIsIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlOiB7fSxcclxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICBpZiAoIShyZWdleCBpbiBtZXNzYWdlLl9oZWFkZXJMb29rdXBzKSkge1xyXG4gICAgICAgICAgICB2YXIgaGVhZGVyO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1lc3NhZ2UuaGVhZGVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCEhbWVzc2FnZS5oZWFkZXJzW2ldWzBdLm1hdGNoKHJlZ2V4KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlciA9IG1lc3NhZ2UuaGVhZGVyc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBtZXNzYWdlLl9oZWFkZXJMb29rdXBzW3JlZ2V4XSA9IGhlYWRlciA/IGhlYWRlclsxXSA6IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG1lc3NhZ2UuX2hlYWRlckxvb2t1cHNbcmVnZXhdO1xyXG4gICAgfSxcclxuICAgIG1hdGNoX2hlYWRlcjogZnVuY3Rpb24gKG1lc3NhZ2UsIHJlZ2V4KSB7XHJcbiAgICAgICAgdmFyIGhlYWRlcnMgPSBtZXNzYWdlLmhlYWRlcnM7XHJcbiAgICAgICAgdmFyIGkgPSBoZWFkZXJzLmxlbmd0aDtcclxuICAgICAgICB3aGlsZSAoaS0tKSB7XHJcbiAgICAgICAgICAgIGlmIChyZWdleC50ZXN0KGhlYWRlcnNbaV0uam9pbihcIiBcIikpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVyc1tpXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbn07XHJcblxyXG52YXIgZGVmYXVsdFBvcnRzID0ge1xyXG4gICAgXCJodHRwXCI6IDgwLFxyXG4gICAgXCJodHRwc1wiOiA0NDNcclxufTtcclxuXHJcbnZhciBSZXF1ZXN0VXRpbHMgPSBfLmV4dGVuZChfTWVzc2FnZVV0aWxzLCB7XHJcbiAgICBwcmV0dHlfaG9zdDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcclxuICAgICAgICAvL0ZJWE1FOiBBZGQgaG9zdGhlYWRlclxyXG4gICAgICAgIHJldHVybiByZXF1ZXN0Lmhvc3Q7XHJcbiAgICB9LFxyXG4gICAgcHJldHR5X3VybDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcclxuICAgICAgICB2YXIgcG9ydCA9IFwiXCI7XHJcbiAgICAgICAgaWYgKGRlZmF1bHRQb3J0c1tyZXF1ZXN0LnNjaGVtZV0gIT09IHJlcXVlc3QucG9ydCkge1xyXG4gICAgICAgICAgICBwb3J0ID0gXCI6XCIgKyByZXF1ZXN0LnBvcnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXF1ZXN0LnNjaGVtZSArIFwiOi8vXCIgKyB0aGlzLnByZXR0eV9ob3N0KHJlcXVlc3QpICsgcG9ydCArIHJlcXVlc3QucGF0aDtcclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgUmVzcG9uc2VVdGlscyA9IF8uZXh0ZW5kKF9NZXNzYWdlVXRpbHMsIHt9KTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFJlc3BvbnNlVXRpbHM6IFJlc3BvbnNlVXRpbHMsXHJcbiAgICBSZXF1ZXN0VXRpbHM6IFJlcXVlc3RVdGlsc1xyXG5cclxufSIsIlxyXG52YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XHJcbnZhciAkID0gcmVxdWlyZShcImpxdWVyeVwiKTtcclxudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcclxuXHJcbnZhciB1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcclxudmFyIGFjdGlvbnMgPSByZXF1aXJlKFwiLi4vYWN0aW9ucy5qc1wiKTtcclxudmFyIGRpc3BhdGNoZXIgPSByZXF1aXJlKFwiLi4vZGlzcGF0Y2hlci5qc1wiKTtcclxuXHJcblxyXG5mdW5jdGlvbiBMaXN0U3RvcmUoKSB7XHJcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcclxuICAgIHRoaXMucmVzZXQoKTtcclxufVxyXG5fLmV4dGVuZChMaXN0U3RvcmUucHJvdG90eXBlLCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XHJcbiAgICBhZGQ6IGZ1bmN0aW9uIChlbGVtKSB7XHJcbiAgICAgICAgaWYgKGVsZW0uaWQgaW4gdGhpcy5fcG9zX21hcCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3Bvc19tYXBbZWxlbS5pZF0gPSB0aGlzLmxpc3QubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMubGlzdC5wdXNoKGVsZW0pO1xyXG4gICAgICAgIHRoaXMuZW1pdChcImFkZFwiLCBlbGVtKTtcclxuICAgIH0sXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChlbGVtKSB7XHJcbiAgICAgICAgaWYgKCEoZWxlbS5pZCBpbiB0aGlzLl9wb3NfbWFwKSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubGlzdFt0aGlzLl9wb3NfbWFwW2VsZW0uaWRdXSA9IGVsZW07XHJcbiAgICAgICAgdGhpcy5lbWl0KFwidXBkYXRlXCIsIGVsZW0pO1xyXG4gICAgfSxcclxuICAgIHJlbW92ZTogZnVuY3Rpb24gKGVsZW1faWQpIHtcclxuICAgICAgICBpZiAoIShlbGVtX2lkIGluIHRoaXMuX3Bvc19tYXApKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5saXN0LnNwbGljZSh0aGlzLl9wb3NfbWFwW2VsZW1faWRdLCAxKTtcclxuICAgICAgICB0aGlzLl9idWlsZF9tYXAoKTtcclxuICAgICAgICB0aGlzLmVtaXQoXCJyZW1vdmVcIiwgZWxlbV9pZCk7XHJcbiAgICB9LFxyXG4gICAgcmVzZXQ6IGZ1bmN0aW9uIChlbGVtcykge1xyXG4gICAgICAgIHRoaXMubGlzdCA9IGVsZW1zIHx8IFtdO1xyXG4gICAgICAgIHRoaXMuX2J1aWxkX21hcCgpO1xyXG4gICAgICAgIHRoaXMuZW1pdChcInJlY2FsY3VsYXRlXCIpO1xyXG4gICAgfSxcclxuICAgIF9idWlsZF9tYXA6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLl9wb3NfbWFwID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxpc3QubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIGVsZW0gPSB0aGlzLmxpc3RbaV07XHJcbiAgICAgICAgICAgIHRoaXMuX3Bvc19tYXBbZWxlbS5pZF0gPSBpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBnZXQ6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubGlzdFt0aGlzLl9wb3NfbWFwW2VsZW1faWRdXTtcclxuICAgIH0sXHJcbiAgICBpbmRleDogZnVuY3Rpb24gKGVsZW1faWQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fcG9zX21hcFtlbGVtX2lkXTtcclxuICAgIH1cclxufSk7XHJcblxyXG5cclxuZnVuY3Rpb24gRGljdFN0b3JlKCkge1xyXG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XHJcbiAgICB0aGlzLnJlc2V0KCk7XHJcbn1cclxuXy5leHRlbmQoRGljdFN0b3JlLnByb3RvdHlwZSwgRXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGljdCkge1xyXG4gICAgICAgIF8ubWVyZ2UodGhpcy5kaWN0LCBkaWN0KTtcclxuICAgICAgICB0aGlzLmVtaXQoXCJyZWNhbGN1bGF0ZVwiKTtcclxuICAgIH0sXHJcbiAgICByZXNldDogZnVuY3Rpb24gKGRpY3QpIHtcclxuICAgICAgICB0aGlzLmRpY3QgPSBkaWN0IHx8IHt9O1xyXG4gICAgICAgIHRoaXMuZW1pdChcInJlY2FsY3VsYXRlXCIpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbmZ1bmN0aW9uIExpdmVTdG9yZU1peGluKHR5cGUpIHtcclxuICAgIHRoaXMudHlwZSA9IHR5cGU7XHJcblxyXG4gICAgdGhpcy5fdXBkYXRlc19iZWZvcmVfZmV0Y2ggPSB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLl9mZXRjaHhociA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuaGFuZGxlID0gdGhpcy5oYW5kbGUuYmluZCh0aGlzKTtcclxuICAgIGRpc3BhdGNoZXIuQXBwRGlzcGF0Y2hlci5yZWdpc3Rlcih0aGlzLmhhbmRsZSk7XHJcblxyXG4gICAgLy8gQXZvaWQgZG91YmxlLWZldGNoIG9uIHN0YXJ0dXAuXHJcbiAgICBpZiAoISh3aW5kb3cud3MgJiYgd2luZG93LndzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5DT05ORUNUSU5HKSkge1xyXG4gICAgICAgIHRoaXMuZmV0Y2goKTtcclxuICAgIH1cclxufVxyXG5fLmV4dGVuZChMaXZlU3RvcmVNaXhpbi5wcm90b3R5cGUsIHtcclxuICAgIGhhbmRsZTogZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09IGFjdGlvbnMuQWN0aW9uVHlwZXMuQ09OTkVDVElPTl9PUEVOKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZldGNoKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChldmVudC50eXBlID09PSB0aGlzLnR5cGUpIHtcclxuICAgICAgICAgICAgaWYgKGV2ZW50LmNtZCA9PT0gYWN0aW9ucy5TdG9yZUNtZHMuUkVTRVQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmV0Y2goZXZlbnQuZGF0YSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdXBkYXRlc19iZWZvcmVfZmV0Y2gpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZGVmZXIgdXBkYXRlXCIsIGV2ZW50KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoLnB1c2goZXZlbnQpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpc1tldmVudC5jbWRdKGV2ZW50LmRhdGEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgZGlzcGF0Y2hlci5BcHBEaXNwYXRjaGVyLnVucmVnaXN0ZXIodGhpcy5oYW5kbGUpO1xyXG4gICAgfSxcclxuICAgIGZldGNoOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiZmV0Y2ggXCIgKyB0aGlzLnR5cGUpO1xyXG4gICAgICAgIGlmICh0aGlzLl9mZXRjaHhocikge1xyXG4gICAgICAgICAgICB0aGlzLl9mZXRjaHhoci5hYm9ydCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl91cGRhdGVzX2JlZm9yZV9mZXRjaCA9IFtdOyAvLyAoSlM6IGVtcHR5IGFycmF5IGlzIHRydWUpXHJcbiAgICAgICAgaWYgKGRhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVfZmV0Y2goZGF0YSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fZmV0Y2h4aHIgPSAkLmdldEpTT04oXCIvXCIgKyB0aGlzLnR5cGUpXHJcbiAgICAgICAgICAgICAgICAuZG9uZShmdW5jdGlvbiAobWVzc2FnZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlX2ZldGNoKG1lc3NhZ2UuZGF0YSk7XHJcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpXHJcbiAgICAgICAgICAgICAgICAuZmFpbChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgRXZlbnRMb2dBY3Rpb25zLmFkZF9ldmVudChcIkNvdWxkIG5vdCBmZXRjaCBcIiArIHRoaXMudHlwZSk7XHJcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBoYW5kbGVfZmV0Y2g6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5fZmV0Y2h4aHIgPSBmYWxzZTtcclxuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnR5cGUgKyBcIiBmZXRjaGVkLlwiLCB0aGlzLl91cGRhdGVzX2JlZm9yZV9mZXRjaCk7XHJcbiAgICAgICAgdGhpcy5yZXNldChkYXRhKTtcclxuICAgICAgICB2YXIgdXBkYXRlcyA9IHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoO1xyXG4gICAgICAgIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoID0gZmFsc2U7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1cGRhdGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlKHVwZGF0ZXNbaV0pO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gTGl2ZUxpc3RTdG9yZSh0eXBlKSB7XHJcbiAgICBMaXN0U3RvcmUuY2FsbCh0aGlzKTtcclxuICAgIExpdmVTdG9yZU1peGluLmNhbGwodGhpcywgdHlwZSk7XHJcbn1cclxuXy5leHRlbmQoTGl2ZUxpc3RTdG9yZS5wcm90b3R5cGUsIExpc3RTdG9yZS5wcm90b3R5cGUsIExpdmVTdG9yZU1peGluLnByb3RvdHlwZSk7XHJcblxyXG5mdW5jdGlvbiBMaXZlRGljdFN0b3JlKHR5cGUpIHtcclxuICAgIERpY3RTdG9yZS5jYWxsKHRoaXMpO1xyXG4gICAgTGl2ZVN0b3JlTWl4aW4uY2FsbCh0aGlzLCB0eXBlKTtcclxufVxyXG5fLmV4dGVuZChMaXZlRGljdFN0b3JlLnByb3RvdHlwZSwgRGljdFN0b3JlLnByb3RvdHlwZSwgTGl2ZVN0b3JlTWl4aW4ucHJvdG90eXBlKTtcclxuXHJcblxyXG5mdW5jdGlvbiBGbG93U3RvcmUoKSB7XHJcbiAgICByZXR1cm4gbmV3IExpdmVMaXN0U3RvcmUoYWN0aW9ucy5BY3Rpb25UeXBlcy5GTE9XX1NUT1JFKTtcclxufVxyXG5cclxuZnVuY3Rpb24gU2V0dGluZ3NTdG9yZSgpIHtcclxuICAgIHJldHVybiBuZXcgTGl2ZURpY3RTdG9yZShhY3Rpb25zLkFjdGlvblR5cGVzLlNFVFRJTkdTX1NUT1JFKTtcclxufVxyXG5cclxuZnVuY3Rpb24gRXZlbnRMb2dTdG9yZSgpIHtcclxuICAgIExpdmVMaXN0U3RvcmUuY2FsbCh0aGlzLCBhY3Rpb25zLkFjdGlvblR5cGVzLkVWRU5UX1NUT1JFKTtcclxufVxyXG5fLmV4dGVuZChFdmVudExvZ1N0b3JlLnByb3RvdHlwZSwgTGl2ZUxpc3RTdG9yZS5wcm90b3R5cGUsIHtcclxuICAgIGZldGNoOiBmdW5jdGlvbigpe1xyXG4gICAgICAgIExpdmVMaXN0U3RvcmUucHJvdG90eXBlLmZldGNoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgICAgIC8vIE1ha2Ugc3VyZSB0byBkaXNwbGF5IHVwZGF0ZXMgZXZlbiBpZiBmZXRjaGluZyBhbGwgZXZlbnRzIGZhaWxlZC5cclxuICAgICAgICAvLyBUaGlzIHdheSwgd2UgY2FuIHNlbmQgXCJmZXRjaCBmYWlsZWRcIiBsb2cgbWVzc2FnZXMgdG8gdGhlIGxvZy5cclxuICAgICAgICBpZih0aGlzLl9mZXRjaHhocil7XHJcbiAgICAgICAgICAgIHRoaXMuX2ZldGNoeGhyLmZhaWwoZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlX2ZldGNoKG51bGwpO1xyXG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBFdmVudExvZ1N0b3JlOiBFdmVudExvZ1N0b3JlLFxyXG4gICAgU2V0dGluZ3NTdG9yZTogU2V0dGluZ3NTdG9yZSxcclxuICAgIEZsb3dTdG9yZTogRmxvd1N0b3JlXHJcbn07IiwiXHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XHJcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcclxuXHJcblxyXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiLi4vdXRpbHMuanNcIik7XHJcblxyXG5mdW5jdGlvbiBTb3J0QnlTdG9yZU9yZGVyKGVsZW0pIHtcclxuICAgIHJldHVybiB0aGlzLnN0b3JlLmluZGV4KGVsZW0uaWQpO1xyXG59XHJcblxyXG52YXIgZGVmYXVsdF9zb3J0ID0gU29ydEJ5U3RvcmVPcmRlcjtcclxudmFyIGRlZmF1bHRfZmlsdCA9IGZ1bmN0aW9uKGVsZW0pe1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBTdG9yZVZpZXcoc3RvcmUsIGZpbHQsIHNvcnRmdW4pIHtcclxuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xyXG4gICAgZmlsdCA9IGZpbHQgfHwgZGVmYXVsdF9maWx0O1xyXG4gICAgc29ydGZ1biA9IHNvcnRmdW4gfHwgZGVmYXVsdF9zb3J0O1xyXG5cclxuICAgIHRoaXMuc3RvcmUgPSBzdG9yZTtcclxuXHJcbiAgICB0aGlzLmFkZCA9IHRoaXMuYWRkLmJpbmQodGhpcyk7XHJcbiAgICB0aGlzLnVwZGF0ZSA9IHRoaXMudXBkYXRlLmJpbmQodGhpcyk7XHJcbiAgICB0aGlzLnJlbW92ZSA9IHRoaXMucmVtb3ZlLmJpbmQodGhpcyk7XHJcbiAgICB0aGlzLnJlY2FsY3VsYXRlID0gdGhpcy5yZWNhbGN1bGF0ZS5iaW5kKHRoaXMpO1xyXG4gICAgdGhpcy5zdG9yZS5hZGRMaXN0ZW5lcihcImFkZFwiLCB0aGlzLmFkZCk7XHJcbiAgICB0aGlzLnN0b3JlLmFkZExpc3RlbmVyKFwidXBkYXRlXCIsIHRoaXMudXBkYXRlKTtcclxuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJyZW1vdmVcIiwgdGhpcy5yZW1vdmUpO1xyXG4gICAgdGhpcy5zdG9yZS5hZGRMaXN0ZW5lcihcInJlY2FsY3VsYXRlXCIsIHRoaXMucmVjYWxjdWxhdGUpO1xyXG5cclxuICAgIHRoaXMucmVjYWxjdWxhdGUoZmlsdCwgc29ydGZ1bik7XHJcbn1cclxuXHJcbl8uZXh0ZW5kKFN0b3JlVmlldy5wcm90b3R5cGUsIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcclxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5yZW1vdmVMaXN0ZW5lcihcImFkZFwiLCB0aGlzLmFkZCk7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5yZW1vdmVMaXN0ZW5lcihcInVwZGF0ZVwiLCB0aGlzLnVwZGF0ZSk7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5yZW1vdmVMaXN0ZW5lcihcInJlbW92ZVwiLCB0aGlzLnJlbW92ZSk7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5yZW1vdmVMaXN0ZW5lcihcInJlY2FsY3VsYXRlXCIsIHRoaXMucmVjYWxjdWxhdGUpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVjYWxjdWxhdGU6IGZ1bmN0aW9uIChmaWx0LCBzb3J0ZnVuKSB7XHJcbiAgICAgICAgaWYgKGZpbHQpIHtcclxuICAgICAgICAgICAgdGhpcy5maWx0ID0gZmlsdC5iaW5kKHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoc29ydGZ1bikge1xyXG4gICAgICAgICAgICB0aGlzLnNvcnRmdW4gPSBzb3J0ZnVuLmJpbmQodGhpcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmxpc3QgPSB0aGlzLnN0b3JlLmxpc3QuZmlsdGVyKHRoaXMuZmlsdCk7XHJcbiAgICAgICAgdGhpcy5saXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc29ydGZ1bihhKSAtIHRoaXMuc29ydGZ1bihiKTtcclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICAgIHRoaXMuZW1pdChcInJlY2FsY3VsYXRlXCIpO1xyXG4gICAgfSxcclxuICAgIGluZGV4OiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHJldHVybiBfLnNvcnRlZEluZGV4KHRoaXMubGlzdCwgZWxlbSwgdGhpcy5zb3J0ZnVuKTtcclxuICAgIH0sXHJcbiAgICBhZGQ6IGZ1bmN0aW9uIChlbGVtKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZmlsdChlbGVtKSkge1xyXG4gICAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5pbmRleChlbGVtKTtcclxuICAgICAgICAgICAgaWYgKGlkeCA9PT0gdGhpcy5saXN0Lmxlbmd0aCkgeyAvL2hhcHBlbnMgb2Z0ZW4sIC5wdXNoIGlzIHdheSBmYXN0ZXIuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmxpc3QucHVzaChlbGVtKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubGlzdC5zcGxpY2UoaWR4LCAwLCBlbGVtKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmVtaXQoXCJhZGRcIiwgZWxlbSwgaWR4KTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHZhciBpZHg7XHJcbiAgICAgICAgdmFyIGkgPSB0aGlzLmxpc3QubGVuZ3RoO1xyXG4gICAgICAgIC8vIFNlYXJjaCBmcm9tIHRoZSBiYWNrLCB3ZSB1c3VhbGx5IHVwZGF0ZSB0aGUgbGF0ZXN0IGVudHJpZXMuXHJcbiAgICAgICAgd2hpbGUgKGktLSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5saXN0W2ldLmlkID09PSBlbGVtLmlkKSB7XHJcbiAgICAgICAgICAgICAgICBpZHggPSBpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChpZHggPT09IC0xKSB7IC8vbm90IGNvbnRhaW5lZCBpbiBsaXN0XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKGVsZW0pO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuZmlsdChlbGVtKSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZShlbGVtLmlkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zb3J0ZnVuKHRoaXMubGlzdFtpZHhdKSAhPT0gdGhpcy5zb3J0ZnVuKGVsZW0pKSB7IC8vc29ydHBvcyBoYXMgY2hhbmdlZFxyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmUodGhpcy5saXN0W2lkeF0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGQoZWxlbSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmxpc3RbaWR4XSA9IGVsZW07XHJcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoXCJ1cGRhdGVcIiwgZWxlbSwgaWR4KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XHJcbiAgICAgICAgdmFyIGlkeCA9IHRoaXMubGlzdC5sZW5ndGg7XHJcbiAgICAgICAgd2hpbGUgKGlkeC0tKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmxpc3RbaWR4XS5pZCA9PT0gZWxlbV9pZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5saXN0LnNwbGljZShpZHgsIDEpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KFwicmVtb3ZlXCIsIGVsZW1faWQsIGlkeCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFN0b3JlVmlldzogU3RvcmVWaWV3XHJcbn07IiwidmFyICQgPSByZXF1aXJlKFwianF1ZXJ5XCIpO1xyXG5cclxuXHJcbnZhciBLZXkgPSB7XHJcbiAgICBVUDogMzgsXHJcbiAgICBET1dOOiA0MCxcclxuICAgIFBBR0VfVVA6IDMzLFxyXG4gICAgUEFHRV9ET1dOOiAzNCxcclxuICAgIEhPTUU6IDM2LFxyXG4gICAgRU5EOiAzNSxcclxuICAgIExFRlQ6IDM3LFxyXG4gICAgUklHSFQ6IDM5LFxyXG4gICAgRU5URVI6IDEzLFxyXG4gICAgRVNDOiAyNyxcclxuICAgIFRBQjogOSxcclxuICAgIFNQQUNFOiAzMixcclxuICAgIEJBQ0tTUEFDRTogOCxcclxufTtcclxuLy8gQWRkIEEtWlxyXG5mb3IgKHZhciBpID0gNjU7IGkgPD0gOTA7IGkrKykge1xyXG4gICAgS2V5W1N0cmluZy5mcm9tQ2hhckNvZGUoaSldID0gaTtcclxufVxyXG5cclxuXHJcbnZhciBmb3JtYXRTaXplID0gZnVuY3Rpb24gKGJ5dGVzKSB7XHJcbiAgICBpZiAoYnl0ZXMgPT09IDApXHJcbiAgICAgICAgcmV0dXJuIFwiMFwiO1xyXG4gICAgdmFyIHByZWZpeCA9IFtcImJcIiwgXCJrYlwiLCBcIm1iXCIsIFwiZ2JcIiwgXCJ0YlwiXTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJlZml4Lmxlbmd0aDsgaSsrKXtcclxuICAgICAgICBpZiAoTWF0aC5wb3coMTAyNCwgaSArIDEpID4gYnl0ZXMpe1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICB2YXIgcHJlY2lzaW9uO1xyXG4gICAgaWYgKGJ5dGVzJU1hdGgucG93KDEwMjQsIGkpID09PSAwKVxyXG4gICAgICAgIHByZWNpc2lvbiA9IDA7XHJcbiAgICBlbHNlXHJcbiAgICAgICAgcHJlY2lzaW9uID0gMTtcclxuICAgIHJldHVybiAoYnl0ZXMvTWF0aC5wb3coMTAyNCwgaSkpLnRvRml4ZWQocHJlY2lzaW9uKSArIHByZWZpeFtpXTtcclxufTtcclxuXHJcblxyXG52YXIgZm9ybWF0VGltZURlbHRhID0gZnVuY3Rpb24gKG1pbGxpc2Vjb25kcykge1xyXG4gICAgdmFyIHRpbWUgPSBtaWxsaXNlY29uZHM7XHJcbiAgICB2YXIgcHJlZml4ID0gW1wibXNcIiwgXCJzXCIsIFwibWluXCIsIFwiaFwiXTtcclxuICAgIHZhciBkaXYgPSBbMTAwMCwgNjAsIDYwXTtcclxuICAgIHZhciBpID0gMDtcclxuICAgIHdoaWxlIChNYXRoLmFicyh0aW1lKSA+PSBkaXZbaV0gJiYgaSA8IGRpdi5sZW5ndGgpIHtcclxuICAgICAgICB0aW1lID0gdGltZSAvIGRpdltpXTtcclxuICAgICAgICBpKys7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gTWF0aC5yb3VuZCh0aW1lKSArIHByZWZpeFtpXTtcclxufTtcclxuXHJcblxyXG52YXIgZm9ybWF0VGltZVN0YW1wID0gZnVuY3Rpb24gKHNlY29uZHMpIHtcclxuICAgIHZhciB0cyA9IChuZXcgRGF0ZShzZWNvbmRzICogMTAwMCkpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICByZXR1cm4gdHMucmVwbGFjZShcIlRcIiwgXCIgXCIpLnJlcGxhY2UoXCJaXCIsIFwiXCIpO1xyXG59O1xyXG5cclxuXHJcbmZ1bmN0aW9uIGdldENvb2tpZShuYW1lKSB7XHJcbiAgICB2YXIgciA9IGRvY3VtZW50LmNvb2tpZS5tYXRjaChcIlxcXFxiXCIgKyBuYW1lICsgXCI9KFteO10qKVxcXFxiXCIpO1xyXG4gICAgcmV0dXJuIHIgPyByWzFdIDogdW5kZWZpbmVkO1xyXG59XHJcbnZhciB4c3JmID0gJC5wYXJhbSh7X3hzcmY6IGdldENvb2tpZShcIl94c3JmXCIpfSk7XHJcblxyXG4vL1Rvcm5hZG8gWFNSRiBQcm90ZWN0aW9uLlxyXG4kLmFqYXhQcmVmaWx0ZXIoZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuICAgIGlmIChbXCJwb3N0XCIsIFwicHV0XCIsIFwiZGVsZXRlXCJdLmluZGV4T2Yob3B0aW9ucy50eXBlLnRvTG93ZXJDYXNlKCkpID49IDAgJiYgb3B0aW9ucy51cmxbMF0gPT09IFwiL1wiKSB7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuZGF0YSkge1xyXG4gICAgICAgICAgICBvcHRpb25zLmRhdGEgKz0gKFwiJlwiICsgeHNyZik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb3B0aW9ucy5kYXRhID0geHNyZjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG4vLyBMb2cgQUpBWCBFcnJvcnNcclxuJChkb2N1bWVudCkuYWpheEVycm9yKGZ1bmN0aW9uIChldmVudCwganFYSFIsIGFqYXhTZXR0aW5ncywgdGhyb3duRXJyb3IpIHtcclxuICAgIHZhciBtZXNzYWdlID0ganFYSFIucmVzcG9uc2VUZXh0O1xyXG4gICAgY29uc29sZS5lcnJvcihtZXNzYWdlLCBhcmd1bWVudHMpO1xyXG4gICAgRXZlbnRMb2dBY3Rpb25zLmFkZF9ldmVudCh0aHJvd25FcnJvciArIFwiOiBcIiArIG1lc3NhZ2UpO1xyXG4gICAgd2luZG93LmFsZXJ0KG1lc3NhZ2UpO1xyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZm9ybWF0U2l6ZTogZm9ybWF0U2l6ZSxcclxuICAgIGZvcm1hdFRpbWVEZWx0YTogZm9ybWF0VGltZURlbHRhLFxyXG4gICAgZm9ybWF0VGltZVN0YW1wOiBmb3JtYXRUaW1lU3RhbXAsXHJcbiAgICBLZXk6IEtleVxyXG59OyJdfQ==
