var buttons = require('sdk/ui/button/action'),
    tabs = require('sdk/tabs'),
    Request = require('sdk/request').Request,
    {Cc, Ci, Cu} = require('chrome'),
    DOMParser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser),
    timers = require('sdk/timers'),
    app = require('sdk/self');

    Cu.import('resource:///modules/CustomizableUI.jsm');
    Cu.import('resource://gre/modules/Services.jsm');

module.exports = function(){
    var self = this;

    this.button = null;
    this.interval = null;
    this.logged = false;
    this.currentText = '...';

    this.createButton = function(){
        CustomizableUI.destroyWidget('outlook-notifier-btn');

        CustomizableUI.addListener({
            onWidgetBeforeDOMChange: function(node, nextNode, container, getRemoved){
                node.addEventListener('click', function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    self.buttonClick();
                }, true);
            }
        });

       this.button = CustomizableUI.createWidget({
            id: 'outlook-notifier-btn',
            defaultArea: CustomizableUI.AREA_NAVBAR,
            label: 'Outlook notifier',
            tooltiptext: 'Click to open Outlook in a new tab'
        });

            
        let io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        this._ss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        this._uri = io.newURI(app.data.url('style.css'), null, null);
        if(this._ss.sheetRegistered(this._uri, this._ss.USER_SHEET)) {
            this._ss.unregisterSheet(this._uri, this._ss.USER_SHEET);
        }
        this._ss.loadAndRegisterSheet(this._uri, this._ss.USER_SHEET);

        this.drawIcons();
    };

    this.buttonClick = function(){
        tabs.open('https://mail.live.com');    
    };

    this.loop = function(){
        self.fetch();
        this.interval = timers.setInterval(function(){
            self.fetch();
        }, 60000);
    };

    this.fetch = function(){
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
        }

        this.currentText = messageNbr;

        this.drawIcons();
    };

    this.checkLogged = function(div){
        this.logged = div !== null;
        return this.logged;
    };

    this.drawIcons = function(){
        var text = this.currentText.toString();

        if(!isNaN(parseInt(text)) && parseInt(text) > 9999){
            text = '9999';
        }

        this.button.instances.forEach(function(instance){
            var elem = instance.anchor.ownerDocument.defaultView.document.getElementById('outlook-notifier-btn');
            elem.setAttribute('value', text);
            elem.setAttribute('valueLength', text.length);
        });
    };

    this.init = function(){
        this.createButton();
        this.loop();
        return this;
    };
};
