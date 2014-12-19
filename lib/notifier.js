var Request = require('sdk/request').Request,
  {Cc, Ci, Cu} = require('chrome'),
  DOMParser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser),
  timers = require('sdk/timers'),
  app = require('sdk/self'),
  preferences = require('./preferences'),
  storage = require('./storage'),
  utils = require('./utils'),
  ui = require('./ui'),
  _ = require('./vendor/lodash.min.js');

module.exports = function(){
  var self = this;

  this.interval = null;
  this.logged = null;
  this.url = 'https://dub131.mail.live.com/default.aspx';
  this.mailsIDs = [];

  this.buttonClick = function(e){
    switch(e.button){
      case 0:
        if(e.target.id === 'outlook-notifier-btn'){
        ui.open('https://mail.live.com', 'outlook', true);
      }
      break;
      default:
        console.log('no options for click : ' + e.button);
      break;
    }
  };

  this.loop = function(){
    timers.clearInterval(this.interval);
    this.fetch();
    this.interval = timers.setInterval(function(){
      self.fetch();
    }, preferences.get('refresh_schedule') * 1000);
  };

  this.fetch = function(){
    Request({
      url: this.url,
      onComplete: this.parseRes.bind(this)
    }).get();
  };

  this.parseRes = function(res){
    var document = DOMParser.parseFromString(res.text, 'text/html'),
    div = document.querySelector('.count'),
    messageNbr;

    if(this.checkLogged(div)){
      messageNbr = div.innerHTML.trim();
      messageNbr = messageNbr === '' ? 0 : parseInt(messageNbr);
    } else{
      messageNbr = '?';
    }

    ui.drawIcons(messageNbr);

    if(preferences.get('display_notifications') === true && parseInt(messageNbr) > 0){
      this.parseMailSubjects(document);
    }
  };

  this.parseMailSubjects = function(document){
    var mailsTables = document.querySelectorAll('ul.mailList.InboxTableBody'),
    mailsTablesChilds = _.map(mailsTables, function(table){
      return table.children;
    });

    var unreadMails = _.flatten(_.map(mailsTablesChilds, function(nodeList){
      return _.filter(nodeList, function(elem){
        var classes = elem.className.split(' ');

        return _.some(classes, function(className){
          return className === 'mlUnrd';
        });
      });
    }));

    var incomedNewMails = _.reject(unreadMails, function(elem){
      var id = elem.id;
      return _.contains(self.mailsIDs, id);
    });

    if(incomedNewMails.length > 0){
      this.mailsIDs = _.map(unreadMails, function(elem){
        return elem.id;
      });

      var mailsSubjects = _.map(incomedNewMails, function(elem){
        return elem.querySelector('.Sb').textContent.trim();
      });

      var mailStrings = _.map(mailsSubjects, function(subject){
        if(subject.length > 30){
          subject = subject.substr(0, 26) + '...';
        }
        return subject;
      });

      ui.displayNotification({
        title: 'New mails (' + mailStrings.length + ')',
        text: mailStrings
      });
    }
  };

  this.checkLogged = function(div){
    this.logged = div !== null;
    return this.logged;
  };

  this.listenPrefsChange = function(){
    preferences.on('refresh_schedule', this.onScheduleTimeChange);
  };

  this.onScheduleTimeChange = function(){
    var newSchedule = preferences.get('refresh_schedule');
    if(parseInt(newSchedule) === 0){
      preferences.set('refresh_schedule', 1);
    }
    self.loop();
  };

  this.checkNewVersion = function(){
    var showChangelog = preferences.get('show_changelog');
    if(showChangelog === true){
      var actualVersion = utils.splitVersion(app.version),
      savedVersion = utils.splitVersion(storage.get('saved_version'));

      if(savedVersion && utils.checkVersions(actualVersion, savedVersion) === 'updated'){
        utils.showChangeLog();
      }
    }

    storage.set('saved_version', app.version);
  };

  this.injectTabScript = function(){
    if(window.location.host.match('.(mail\.live\.com)$') === null){
      return;
    }

    var updateCounter = function(){
      self.postMessage({
        type: 'countUpdate',
        value: div.textContent.trim()
      });
    };

    var div = document.querySelector('.count'),
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
        ui.drawIcons(message.value);
      break;
      default:
        console.log('No action for this injected message');
      break;
    }
  };

  this.init = function(){
    ui.init(this);
    this.listenPrefsChange();
    this.loop();
    this.checkNewVersion();
    return this;
  };
};
