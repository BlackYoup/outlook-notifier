const Request = require('sdk/request').Request,
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
  _ = require('./vendor/lodash/lodash.min.js'),
  Bacon = require('./baconjs-wrapper.js');

module.exports = function(){
  const self = this;
  const URL = conf.outlookUrl;

  let b_oldInboxEmails = new Bacon.Bus();
  let b_oldFolders = new Bacon.Bus();

  let s_oldInboxEmails = b_oldInboxEmails.toProperty();
  let s_oldFolders = b_oldFolders.toProperty();

  this.logged = null;
  this.oldInboxEmails = [];

  this.buttonClick = function(e){
    ui.open(conf.outlookUrl, 'outlook', true);
  };

  this.loop = function(){
    const refreshSchedule = (conf.refreshSchedule !== null ? conf.refreshSchedule : preferences.get('refresh_schedule')) * 1000;

    let s_document = Bacon
      .repeat(() => Bacon.later(refreshSchedule).flatMapLatest(() => self.fetch(URL)))
      .merge(self.fetch(URL))
      .map(res => DOMParser.parseFromString(res.text, 'text/html'))
      .flatMapLatest(function(document){
        if(self.checkLogged(document)){
          return Bacon.once(document);
        } else{
          ui.drawIcons(-1);
          return new Bacon.End();
        }
      }).toProperty();

    let s_messageNbr = s_document.map(document => self.getMessageNbr(document));
    s_messageNbr.onValue(ui.drawIcons);

    var s_displayNotifications = s_document
      .filter(() => preferences.get('display_notifications') === true);

    var s_folders = s_displayNotifications
      .filter(s_messageNbr)
      .map(self.getFolders);

    var s_firstEvent = s_displayNotifications
      .first()
      .filter(s_messageNbr);

    Bacon.onValues(s_firstEvent, s_messageNbr.first(), s_folders.first(), self.showFirstNotification);

    var s_otherEvents = s_displayNotifications
      .skip(1)
      .sampledBy(s_messageNbr.filter(nbr => nbr > 0));

    var s_unreadInboxEmails = s_otherEvents.map(self.getUnreadInboxMails);

    var s_inboxName = s_otherEvents.map(document => document.querySelector('.leftnavitem .editableLabel.readonly').innerHTML.trim());

    // Emails in Inbox
    var s_nonNotifiedEmails = s_unreadInboxEmails.combine(s_oldInboxEmails, self.getNonNotifiedMails);
    // Emails in other folders
    var s_nonNotifiedFoldersEmails = Bacon.combineWith(self.getNonNotifiedFoldersEmails, s_folders, s_oldFolders, s_inboxName);

    s_nonNotifiedEmails.filter('.length').onValue(self.showNonNotifiedInboxEmailsNotification);
    s_nonNotifiedFoldersEmails.filter('.length').onValue(self.showNonNotifiedFoldersEmailsNotification);

    // Now these streams are not needed anymore so we save their content for next loop
    b_oldFolders.plug(s_folders.sampledBy(s_nonNotifiedFoldersEmails));
    b_oldInboxEmails.plug(s_unreadInboxEmails.sampledBy(s_nonNotifiedEmails));
  };

  this.fetch = function(url){
    return Bacon.fromBinder(function(sink){
      Request({
        url: url,
        onComplete: res => sink(res)
      }).get();

      return function(){};
    });
  };

  this.getMessageNbr = function(document){
    let folders = self.getFolders(document);
    return _.map(folders, function(folder){
      return parseInt(folder.counter);
    }).filter(function(counter){
      return !isNaN(counter);
    }).reduce(function(total, counter){
      return total += counter;
    }, 0);
  };

  this.showFirstNotification = function(document, messageNbr, folders){
    ui.displayNotification({
      title: 'Unread mails: ' + messageNbr,
      text: _.reduce(folders, function(subject, folder){
        return subject += folder.name + ': ' + folder.counter.toString() + '\n\r';
      }, '')
    });
  };

  this.showNonNotifiedInboxEmailsNotification = function(nonNotifiedInboxEmails){
    ui.displayNotification({
      title: 'New mails in Inbox',
      text: _.pluck(nonNotifiedInboxEmails, 'subject')
    });
  };

  this.showNonNotifiedFoldersEmailsNotification = function(nonNotifiedFoldersEmails){
    nonNotifiedFoldersEmails.forEach(function(c){
      ui.displayNotification({
        title: 'New mails (' + c.counter + ') in ' + c.name
      });
    });
  };

  this.getFolders = function(document){
    let dontNotifyTheseFolders = preferences.get('ignore_folders').split(',');

    return _.reduce(document.querySelectorAll('div.leftnav span.Unread.TextSemiBold'), function(folders, folder){
      let name = folder.querySelector('span.editableLabel').innerHTML.trim();
      let dontKeepFolder = _.find(dontNotifyTheseFolders, function(n){
        return name === n.trim();
      });
      if(!dontKeepFolder){
        folders[name] = {
          counter: folder.querySelector('span.count').innerHTML.trim(),
          name: name
        };
      }
      return folders;
    }, {});
  };

  this.getNonNotifiedMails = function(unreadInboxMails, oldInboxEmails){
    if(oldInboxEmails.length > 0){
      return _.reject(unreadInboxMails, function(mail){
        return _.find(oldInboxEmails, function(old){
          return old.id === mail.id;
        });
      });
    } else{
      return unreadInboxMails;
    }
  };

  this.getNonNotifiedFoldersEmails = function(folders, oldFolders, inboxName){
    return _.filter(folders, function(c){
      return (!oldFolders[c.name] || oldFolders[c.name].counter < c.counter) && c.name !== inboxName;
    }).map(function(c){
      return {
        counter: c.counter - (self.oldCategories[c.name] ? self.oldCategories[c.name].counter : 0),
        name: c.name
      };
    }).filter(function(c){
      return c.counter > 0;
    });
  };

  this.getUnreadInboxMails = function(document){
    const mailsTables = document.querySelectorAll('ul.mailList.InboxTableBody');
    const mailsTablesChilds = _.map(mailsTables, function(table){
      return table.children;
    });
    let mailsIDs = [];
    let mailStrings = [];

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
