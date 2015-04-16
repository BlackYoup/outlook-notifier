let Request = require('sdk/request').Request,
  {Cc, Ci} = require('chrome'),
  DOMParser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser),
  timers = require('sdk/timers'),
  app = require('sdk/self'),
  preferences = require('./preferences'),
  storage = require('./storage'),
  utils = require('./utils'),
  ui = require('./ui'),
  conf = require('./conf/conf.js'),
  Mail = require('./mail.js'),
  _ = require('./vendor/lodash.min.js');

module.exports = function(){
  let self = this;

  this.interval = null;
  this.logged = null;
  this.url = conf.outlookUrl;
  this.oldEmails = [];
  this.resetedMails = [];

  this.buttonClick = function(e){
    switch(e.button){
      case 0:
        if(e.target.id === 'outlook-notifier-btn'){
          let injectScript = true;
          if(preferences.get('reset_counter_click') === true){
            injectScript = false;
            ui.drawIcons(0);
            self.resetedMails = self.resetedMails.concat(self.oldEmails);
          }
          ui.open(conf.outlookUrl, 'outlook', injectScript);
        }
      break;
      default:
        console.log('no options for click : ' + e.button);
      break;
    }
  };

  this.loop = function(){
    timers.clearInterval(this.interval);
    let refreshSchedule = conf.refreshSchedule !== null ? conf.refreshSchedule : preferences.get('refresh_schedule');

    this.fetch();
    this.interval = timers.setInterval(function(){
      self.fetch();
    }, refreshSchedule * 1000);
  };

  this.fetch = function(){
    Request({
      url: this.url,
      onComplete: this.parseRes.bind(this)
    }).get();
  };

  this.parseRes = function(res){
    let document = DOMParser.parseFromString(res.text, 'text/html'),
      counters = document.querySelectorAll('span.Unread span.count'),
      messageNbr = null,
      unreadMails = [];

    if(this.checkLogged(document)){
      unreadMails = this.getUnreadMails(document);
      if(unreadMails.length <= 0){
        this.resetedMails = [];
        this.oldEmails = [];
      }
      if(preferences.get('reset_counter_click') === true){
        let unResetedMails = this.computeUnResetedMails(unreadMails);
        messageNbr = unResetedMails.length;
      } else{
        messageNbr = _.map(counters, function(counter){
          return parseInt(counter.innerHTML.trim());
        }).filter(function(counter){
          return !isNaN(counter);
        }).reduce(function(total, counter){
          return total += counter;
        }, 0);
      }
    } else{
      messageNbr = -1;
    }

    ui.drawIcons(messageNbr);

    if(preferences.get('display_notifications') === true && parseInt(messageNbr) > 0 && unreadMails.length > 0){
      let nonNotifiedEmails = this.getNonNotifiedMails(unreadMails);
      if(nonNotifiedEmails.length > 0){
        ui.displayNotification({
          title: 'New mails (' + nonNotifiedEmails.length + ')',
          text: _.pluck(nonNotifiedEmails, 'subject')
        });
      }
    }
    if(unreadMails.length > 0){
      this.oldEmails = unreadMails;
    }
  };

  this.getNonNotifiedMails = function(unreadMails){
    let ret = null;
    if(this.oldEmails.length > 0){
      ret = _.reject(unreadMails, function(mail){
        return _.find(self.oldEmails, function(old){
          return old.id === mail.id;
        });
      });
    } else{
      ret = unreadMails;
    }
    return ret;
  };

  this.computeUnResetedMails = function(unreadMails){
    let resetedIDs = _.pluck(this.resetedMails, 'id');
    return _.reject(unreadMails, function(mail){
      return _.contains(resetedIDs, mail.id);
    });
  };

  this.getUnreadMails = function(document){
    let mailsTables = document.querySelectorAll('ul.mailList.InboxTableBody'),
    mailsTablesChilds = _.map(mailsTables, function(table){
      return table.children;
    }),
    mailsIDs = [],
    mailStrings = [];

    let unreadMails = _.flatten(_.map(mailsTablesChilds, function(nodeList){
      let mails = _.filter(nodeList, function(elem){
        let classes = elem.className.split(' ');

        return _.some(classes, function(className){
          return className === 'mlUnrd';
        });
      });
      return _.map(mails, function(mail){
        return new Mail(mail).init();
      });
    }));
    return unreadMails;
  };

  this.checkLogged = function(document){
    this.logged = document.querySelector('.c_search_box') !== null;
    return this.logged;
  };

  this.listenPrefsChange = function(){
    preferences.on('refresh_schedule', this.onScheduleTimeChange);
  };

  this.onScheduleTimeChange = function(){
    let newSchedule = preferences.get('refresh_schedule');
    if(parseInt(newSchedule) === 0){
      preferences.set('refresh_schedule', 1);
    }
    self.loop();
  };

  this.checkNewVersion = function(){
    let showChangelog = preferences.get('show_changelog');
    if(showChangelog === true){
      let actualVersion = utils.splitVersion(app.version),
      savedVersion = utils.splitVersion(storage.get('saved_version'));

      if(savedVersion && utils.checkVersions(actualVersion, savedVersion) === 'updated'){
        utils.showChangeLog(app.version);
      }
    }

    storage.set('saved_version', app.version);
  };

  this.injectTabScript = function(){
    if(window.location.host.match('.(mail\.live\.com)$') === null){
      return;
    }

    let updateCounter = function(){
      self.postMessage({
        type: 'countUpdate',
        value: div.textContent.trim()
      });
    };

    let div = document.querySelector('.count'),
    config = {
      childList: true
    },
    observer = new MutationObserver(updateCounter);

    observer.observe(div, config);
    window.onbeforeunload = function(){
      observer.disconnect();
    };
    updateCounter();
  };

  this.onInjectedScriptMessage = function(message){
    switch(message.type){
      case 'countUpdate':
        let value = parseInt(message.value);
        if(!isNaN(value)){
          ui.drawIcons(value);
        }
      break;
      default:
        console.log('No action for this injected message');
      break;
    }
  };

  this.logout = function(){
    Request({
      url: 'https://login.live.com/logout.srf',
      onComplete: this.fetch.bind(this)
    }).get();
  };

  this.init = function(){
    ui.init(this);
    let startDelay = conf.startDelay !== null ? conf.startDelay : preferences.get('start_delay');
    timers.setTimeout(function(){
      self.listenPrefsChange();
      self.loop();
      self.checkNewVersion();
    }, startDelay * 1000);
  };
};
