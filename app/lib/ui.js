let app = require('sdk/self'),
  {Cc, Ci, Cu} = require('chrome'),
  tabs = require('sdk/tabs'),
  notifications = require('sdk/notifications'),
  { ActionButton } = require('sdk/ui/button/action'),
  _ = require('./vendor/lodash.min.js'),
  preferences = require('./preferences'),
  conf = require('./conf/conf.js'),
  notifier = null;

Cu.import('resource://gre/modules/Services.jsm');

function UI(){
  const defaultIcons = {
    '16': './img/outlook-16.png',
    '32': './img/outlook-32.png',
    '64': './img/outlook-64.png',
  };

  let self = this;
  let appButton = null;

  this.buttonID = 'outlook-notifier-btn';
  this.checkText = '...';
  this.defaultToolTip = 'Click to open Outlook.com in a new tab';
  this.tabs = {};

  this.createButton = function(){
    appButton = ActionButton({
      id: this.buttonID,
      label: self.defaultToolTip,
      icon: defaultIcons,
      onClick: notifier.buttonClick,
      badgeColor: '#235BCD'
    });
  };

  this.drawIcons = function(value){
    let strText;

    if(value > 9999){
      strText = '9999';
    } else if(value === 0){
      strText = '';
    } else if(value < 0){
      strText = '?';
    } else{
      strText = value.toString();
    }

    appButton.badge = strText;

    if(notifier.logged === false){
      appButton.icon = './img/outlook-16-black-white.png';
      appButton.label = 'You are not logged in. Click to open Outlook.com and sign in !';
    } else if(notifier.logged){
      if(strText === ''){
        appButton.icon = './img/outlook-16-black-white.png';
      } else{
        appButton.icon = defaultIcons;
      }
      appButton.label = self.defaultToolTip;
    }
  };

  this.showSettings = function(){
    Services.wm.getMostRecentWindow('navigator:browser').BrowserOpenAddonsMgr();
  };

  this.open = function(url, name, injectScript){
    let tabID = this.tabs[name];
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
          if(injectScript){
            tab.attach({
              contentScript: "(" + notifier.injectTabScript.toString() + ")()",
              onMessage: notifier.onInjectedScriptMessage,
              onError: function(err){
                console.log(err);
              }
            });
          }
        }
      });
    }
  };

  this.focusTab = function(tabID){
    for each(let tab_ in tabs){
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
    let found = false;

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
        self.open(conf.outlookUrl, 'outlook', true);
      };
    }

    notifications.notify(options);

    if(preferences.get('play_notification_sound') === true){
      this.playSound();
    }
  };

  this.playSound = function(){
    let ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    let sound = ios.newURI("resource://jid1-uzhilmjzsvxuug-at-jetpack/outlook-notifier/data/sound/notification.wav", null, null);
    let player = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);

    player.play(sound);
  };

  this.init = function(notifier_){
    notifier = notifier_;
    this.createButton();
    this.lookForOpenedTabs();
  };
}

module.exports = new UI();
