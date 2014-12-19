var app = require('sdk/self'),
  {Cc, Ci, Cu} = require('chrome'),
  tabs = require('sdk/tabs'),
  notifications = require('sdk/notifications'),
  _ = require('./vendor/underscore-min'),
  preferences = require('./preferences'),
  notifier = null;

Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/Services.jsm');

function UI(){
  var self = this;

  let io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService),
  appButton = null;

  this.buttonID = 'outlook-notifier-btn';
  this.checkText = '...';
  this.defaultToolTip = 'Click to open Outlook.com in a new tab';
  this._ss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  this._uri = io.newURI(app.data.url('css/style.css'), null, null);
  this.tabs = {};

  this.createButton = function(){
    CustomizableUI.destroyWidget('outlook-notifier-btn');

    CustomizableUI.addListener({
      onWidgetBeforeDOMChange: function(node, nextNode, container, getRemoved){
        if(node.id !== self.buttonID){
          return;
        }

        node.addEventListener('click', notifier.buttonClick, true);

        let menuPopup = self.buildContextMenu(node);
        node.appendChild(menuPopup);

        node.addEventListener('contextmenu', function(e){
          e.preventDefault();
          e.stopPropagation();
          self.showContextMenu(menuPopup, node);
        });
      }
    });

    appButton = CustomizableUI.createWidget({
      id: this.buttonID,
      defaultArea: CustomizableUI.AREA_NAVBAR,
      label: 'Outlook notifier',
      tooltiptext: this.defaultToolTip
    });

    if(this._ss.sheetRegistered(this._uri, this._ss.USER_SHEET)) {
      this._ss.unregisterSheet(this._uri, this._ss.USER_SHEET);
    }
    this._ss.loadAndRegisterSheet(this._uri, this._ss.USER_SHEET);
  };

  this.buildContextMenu = function(node){
    const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let doc = node.ownerDocument.defaultView.document,
    menuPopup = doc.createElementNS(NS_XUL, 'menupopup'),
    menu = doc.createElementNS(NS_XUL, 'menu'),
    menuSeparator = doc.createElementNS(NS_XUL, 'menuseparator'),
    item = doc.createElementNS(NS_XUL, 'menuitem');

    this.addChild(menuPopup, item, { label: 'Refresh' }, notifier.fetch.bind(notifier));
    menuPopup.appendChild(menuSeparator.cloneNode(true));
    this.addChild(menuPopup, item, { label: 'Settings' }, this.showSettings);

    return menuPopup;
  };

  this.addChild = function(menuPopup, item, data, command){
    var item_ = item.cloneNode(true);
    item_.setAttribute('label', data.label);
    item_.setAttribute('value', data.value);
    menuPopup.appendChild(item_);
    item_.addEventListener('command', command);
    return item_;
  };

  this.showContextMenu = function(menuPopup, node){
    menuPopup.openPopup(node, "after_end", 0, 0, false);
  };

  this.drawIcons = function(text){
    text = text.toString().trim();

    if(!isNaN(parseInt(text)) && parseInt(text) > 9999){
      text = '9999';
    } else if(text === '0'){
      text = '';
    }

    appButton.instances.forEach(function(instance){
      var elem = instance.anchor.ownerDocument.defaultView.document.getElementById('outlook-notifier-btn');
      elem.setAttribute('value', text);
      elem.setAttribute('valueLength', text.length);

      if(notifier.logged === false){
        elem.style.listStyleImage = "url('resource://jid1-uzhilmjzsvxuug-at-jetpack/outlook-notifier/data/img/outlook-16-black-white.png')";
        elem.setAttribute('tooltiptext', 'You are not logged in. Click to open Outlook.com and sign in !');
      } else if(notifier.logged){
        if(text === ''){
          elem.style.listStyleImage = "url('resource://jid1-uzhilmjzsvxuug-at-jetpack/outlook-notifier/data/img/outlook-16-black-white.png')";
        } else{
          elem.style.listStyleImage = "url('resource://jid1-uzhilmjzsvxuug-at-jetpack/outlook-notifier/data/img/outlook-16.png')";
        }
        elem.setAttribute('tooltiptext', self.defaultToolTip);
      }
    });
  };

  this.showSettings = function(){
    Services.wm.getMostRecentWindow('navigator:browser').BrowserOpenAddonsMgr();
  };

  this.open = function(url, name, injectScript){
    var tabID = this.tabs[name];
    if(tabID){
      if(this.tabExists(tabID)){
        this.focusTab(tabID);
      } else{
        this.removeTab(name);
        this.open(url, name, injectScript);
      }
    } else{
      tabs.open({
        url: url,
        onOpen: function(tab){
          self.tabs[name] = tab.id;
        },
        onClose: function(tab){
          self.removeTab(name);
        },
        onPageShow: function(tab){
          tab.attach({
            contentScript: "(" + notifier.injectTabScript.toString() + ")()",
            onMessage: notifier.onInjectedScriptMessage,
            onError: function(err){
              console.log(err);
            }
          });
        }
      });
    }
  };

  this.focusTab = function(tabID){
    for each(var tab_ in tabs){
      if(tab_.id === tabID){
        tab_.activate();
        break;
      }
    }
  };

  this.removeTab = function(name){
    delete this.tabs[name];
  };

  this.tabExists = function(ID){
    var found = false;

    for each(tab in tabs){
      if(tab.url == notifier.url){
        found = true;
        break;
      }
    }
    return found;
  };

  this.lookForOpenedTabs = function(){
    for each(tab in tabs){
      if(tab.url == notifier.url){
        this.tabs['outlook'] = tab.id;
        break;
      }
    }
  };

  this.displayNotification = function(options){
    options.iconURL =  'resource://jid1-uzhilmjzsvxuug-at-jetpack/outlook-notifier/data/img/outlook-64.png';

    if(_.isArray(options.text)){
      // Yes, I know, space characters, but... whatever
      options.text = options.text.join('\n\t      ------------\n');
    }

    if(!options.onClick){
      options.onClick = function(){
        self.open('https://mail.live.com', 'outlook', true);
      };
    }

    notifications.notify(options);

    if(preferences.get('play_notification_sound') === true){
      this.playSound();
    }
  };

  this.playSound = function(){
    var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    var sound = ios.newURI("resource://jid1-uzhilmjzsvxuug-at-jetpack/outlook-notifier/data/sound/notification.wav", null, null);
    var player = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);

    player.play(sound);
  };

  this.init = function(notifier_){
    notifier = notifier_;
    this.createButton();
    this.lookForOpenedTabs();
  };
}

module.exports = new UI();
