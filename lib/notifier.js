var buttons = require('sdk/ui/button/action'),
    tabs = require('sdk/tabs'),
    Request = require('sdk/request').Request,
    {Cc, Ci} = require('chrome'),
    DOMParser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser),
    timers = require('sdk/timers');

module.exports = function(){
    var self = this;

    this.button = null;
    this.interval = null;

    this.createButton = function(){
        this.button = buttons.ActionButton({
            id: 'outlook-notifier',
            label: 'Open Outlook.com',
            icon: {
                '16': './outlook-16.png',
                '32': './outlook-32.png',
                '64': './outlook-64.png'
            },
            onClick: this.buttonClick
        });
    };

    this.buttonClick = function(){
        tabs.open('https://mail.live.com');
    };

    this.loop = function(){
        this.interval = timers.setInterval(function(){
            self.fetch();
        }, 60000);
    };

    this.fetch = function(){
        Request({
            url: 'https://mail.live.com',
            onComplete: function(res){
                var document = DOMParser.parseFromString(res.text, 'text/html');
                    messageNbr = document.querySelector('.count').innerHTML.trim();
                
                messageNbr = messageNbr === '' ? 0 : parseInt(messageNbr);

                console.log('You have ' + messageNbr + ' email in your mailbox');
            }
        }).get();
    };

    this.init = function(){
        this.createButton();
        this.loop();
        return this;
    };
};
