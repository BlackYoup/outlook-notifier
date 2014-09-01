var tabs = require('sdk/tabs'),
    Request = require('sdk/request').Request,
    {Cc, Ci, Cu} = require('chrome'),
    DOMParser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser),
    timers = require('sdk/timers'),
    app = require('sdk/self'),
    preferences = require('./preferences'),
    storage = require('./storage'),
    utils = require('./utils'),
    ui = require('./ui');

module.exports = function(){
    var self = this;

    this.interval = null;
    this.logged = null;
    this.defaultToolTip = 'Click to open Outlook.com in a new tab';

    this.buttonClick = function(e){
        switch(e.button){
            case 0:
                if(e.target.id === 'outlook-notifier-btn'){
                    tabs.open('https://mail.live.com');
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
        ui.drawIcons(ui.checkText);
        Request({
            url: 'https://mail.live.com',
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

    this.init = function(){
        ui.init(this);
        this.listenPrefsChange();
        this.loop();
        this.checkNewVersion();
        return this;
    };
};
