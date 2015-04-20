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
  this.oldCategories = [];
  this.oldInboxEmails = [];
  this.firstCheck = true;
  this.inboxName = null;

  this.buttonClick = function(e){
    ui.open(conf.outlookUrl, 'outlook', true);
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
    let document = DOMParser.parseFromString(res.text, 'text/html');

    if(!this.checkLogged(document)){
      ui.drawIcons(-1);
      return;
    }

    let dontNotifyTheseCategories = preferences.get('ignore_folders').split(',');

    let categories = _.reduce(document.querySelectorAll('div.leftnav span.Unread.TextSemiBold'), function(categories, categorie){
      let name = categorie.querySelector('span.editableLabel').innerHTML.trim();
      let dontKeepCategorie = _.find(dontNotifyTheseCategories, function(n){
        return name === n.trim();
      });
      if(!dontKeepCategorie){
        categories[name] = {
          counter: categorie.querySelector('span.count').innerHTML.trim(),
          name: name
        };
      }
      return categories;
    }, {});

    let unreadInboxMails = this.getUnreadInboxMails(document);
    this.inboxName = this.inboxName || document.querySelector('.leftnavitem .editableLabel.readonly').innerHTML.trim();

    if(unreadInboxMails.length <= 0){
      this.oldInboxEmails = [];
    }

    let messageNbr = _.map(categories, function(categorie){
      return parseInt(categorie.counter);
    }).filter(function(counter){
      return !isNaN(counter);
    }).reduce(function(total, counter){
      return total += counter;
    }, 0);

    ui.drawIcons(messageNbr);

    if(preferences.get('display_notifications') === true && parseInt(messageNbr) > 0){
      if(this.firstCheck){
        if(messageNbr > 0){
          ui.displayNotification({
            title: 'Unread mails: ' + messageNbr,
            text: _.reduce(categories, function(subject, categorie){
              return subject += categorie.name + ': ' + categorie.counter.toString() + '\n\r';
            }, '')
          });
        }
      } else{
        // Emails in inbox
        let nonNotifiedInboxEmails = this.getNonNotifiedMails(unreadInboxMails);
        // Emails in other folders
        let nonNotifiedFoldersEmails = _.filter(categories, function(c){
          return (!self.oldCategories[c.name] || self.oldCategories[c.name].counter < c.counter) && c.name !== self.inboxName;
        }).map(function(c){
          return {
            counter: c.counter - (self.oldCategories[c.name] ? self.oldCategories[c.name].counter : 0),
            name: c.name
          };
        }).filter(function(c){
          return c.counter > 0;
        });

        if(nonNotifiedInboxEmails.length > 0){
          ui.displayNotification({
            title: 'New mails in Inbox',
            text: _.pluck(nonNotifiedInboxEmails, 'subject')
          });
        }
        if(nonNotifiedFoldersEmails.length > 0){
          nonNotifiedFoldersEmails.forEach(function(c){
            ui.displayNotification({
              title: 'New mails (' + c.counter + ') in ' + c.name
            });
          });
        }
      }
    }
    if(unreadInboxMails.length > 0){
      this.oldInboxEmails = unreadInboxMails;
    }

    this.oldCategories = categories;
    this.firstCheck = false;
  };

  this.getNonNotifiedMails = function(unreadInboxMails){
    let ret = null;
    if(this.oldInboxEmails.length > 0){
      ret = _.reject(unreadInboxMails, function(mail){
        return _.find(self.oldInboxEmails, function(old){
          return old.id === mail.id;
        });
      });
    } else{
      ret = unreadInboxMails;
    }
    return ret;
  };

  this.getUnreadInboxMails = function(document){
    let mailsTables = document.querySelectorAll('ul.mailList.InboxTableBody'),
    mailsTablesChilds = _.map(mailsTables, function(table){
      return table.children;
    }),
    mailsIDs = [],
    mailStrings = [];

    let unreadInboxMails = _.flatten(_.map(mailsTablesChilds, function(nodeList){
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
    return unreadInboxMails;
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
        type: 'countUpdate'
      });
    };

    let counters = document.querySelectorAll('.count');
    for(var i = 0, j = counters.length; i < j; i++){
      let div = counters[i];
      let config = {
        childList: true
      };
      let observer = new MutationObserver(updateCounter);
      observer.observe(div, config);
      window.onbeforeunload = function(){
        observer.disconnect();
      };
    }
    updateCounter();
  };

  this.onInjectedScriptMessage = function(message){
    switch(message.type){
      case 'countUpdate':
        self.fetch.call(self);
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
