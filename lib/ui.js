var app = require('sdk/self'),
    {Cc, Ci, Cu} = require('chrome'),
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

    this.init = function(notifier_){
        notifier = notifier_;
        this.createButton();
    };
}

module.exports = new UI();
